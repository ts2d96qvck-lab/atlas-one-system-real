import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { buildWebhookPublicUrl } from "@atlas-one/lib";
import { registerRoutes } from "./routes";
import { env } from "./config/env";
import { initRealtime } from "./lib/realtime";
import { corsOptions } from "./lib/cors";
import { mkdir } from "node:fs/promises";
import { uploadsRoot } from "./lib/media-storage";
import { handleEvolutionWebhook, handleMetaCloudWebhook, handleMetaCloudWebhookVerify } from "./services/webhook.service";
import { verifyEvolutionWebhook } from "./lib/webhook-auth";
import { prisma } from "./lib/prisma";
import { validateProductionEnv } from "./lib/security/validate-env";
import { appLog } from "./lib/app-log";
import { processWebhookRetries } from "./services/integrations/webhook-dispatcher.service";
import { processCampaignDispatchBatch } from "./services/campaign-dispatch.service";
import { processWebhookQueueBatch } from "./lib/webhook-queue";
import { getRedis, closeRedis, isRedisReady } from "./lib/redis";
import { registerRequestContext } from "./lib/request-context";
import { verifyMetaWebhookSignature } from "./lib/security/meta-webhook-signature";

try {
  validateProductionEnv();
  appLog.info("env_validated", { production: env.isProduction });
} catch (error) {
  appLog.error("env_validation_failed", {
    message: error instanceof Error ? error.message : String(error)
  });
  throw error;
}

let webhookRetryTimer: ReturnType<typeof setInterval> | null = null;
let webhookQueueTimer: ReturnType<typeof setInterval> | null = null;
let campaignDispatchTimer: ReturnType<typeof setInterval> | null = null;

export async function buildServer() {
  const app = Fastify({
    trustProxy: true,
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });

  registerRequestContext(app);

  // Accept POST/PATCH with Content-Type application/json and empty body (e.g. /campaigns/:id/start).
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
    try {
      if (body === "" || body === undefined || body === null) {
        done(null, {});
        return;
      }
      done(null, JSON.parse(body as string));
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  await app.register(cors, corsOptions);
  await app.register(helmet, { crossOriginResourcePolicy: { policy: "cross-origin" } });
  await mkdir(uploadsRoot(), { recursive: true });
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });

  const redis = env.redisUrl && (await isRedisReady()) ? getRedis() : null;
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
    ...(redis ? { redis } : {})
  });

  const readyHandler = async (
    _request: unknown,
    reply: { status: (code: number) => { send: (body: unknown) => unknown }; send: (body: unknown) => unknown }
  ) => {
    const checks: Record<string, boolean> = { api: true, database: false, evolution: false, redis: true };

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      return reply.status(503).send({ ok: false, ready: false, checks, timestamp: new Date().toISOString() });
    }

    if (env.redisUrl) {
      checks.redis = await isRedisReady();
    }

    try {
      const response = await fetch(`${env.evolutionUrl.replace(/\/$/, "")}/`, {
        headers: env.evolutionApiKey ? { apikey: env.evolutionApiKey } : undefined,
        signal: AbortSignal.timeout(4000)
      });
      checks.evolution = response.ok;
    } catch {
      checks.evolution = false;
    }

    const ready = checks.database && (!env.isProduction || !env.redisUrl || checks.redis);
    return reply.status(ready ? 200 : 503).send({
      ok: ready,
      ready,
      checks,
      timestamp: new Date().toISOString()
    });
  };

  app.get("/ready", readyHandler);
  app.get("/api/ready", readyHandler);

  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    appLog.error("request_failed", {
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      statusCode,
      message: error.message
    });
    const message = statusCode >= 500 ? "Erro interno do servidor" : error.message || "Erro na requisicao";
    reply.status(statusCode).send({
      error: message,
      requestId: request.requestId,
      ...(!env.isProduction && statusCode >= 500 ? { details: error.message } : {})
    });
  });

  await app.register(async (webhookScope) => {
    await webhookScope.register(rateLimit, { max: 5000, timeWindow: "1 minute" });

    webhookScope.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
      const raw = typeof body === "string" ? body : body.toString("utf8");
      request.rawBody = raw;
      try {
        done(null, JSON.parse(raw));
      } catch (error) {
        done(error as Error, undefined);
      }
    });

    const evolutionWebhookHandler = async (
      request: { body: unknown; headers: Record<string, unknown>; requestId?: string },
      reply: { status: (code: number) => { send: (body: unknown) => unknown }; send: (body: unknown) => unknown },
      tenantSlug?: string
    ) => {
      const event =
        request.body && typeof request.body === "object"
          ? String((request.body as Record<string, unknown>).event ?? "unknown")
          : "unknown";
      appLog.info("evolution_webhook_received", {
        requestId: request.requestId,
        tenantSlug: tenantSlug ?? null,
        event
      });

      if (!verifyEvolutionWebhook(request as never)) {
        appLog.warn("evolution_webhook_rejected", {
          requestId: request.requestId,
          tenantSlug: tenantSlug ?? null,
          event,
          reason: "webhook_unauthorized"
        });
        return reply.status(401).send({ ok: false, error: "webhook_unauthorized" });
      }
      const result = await handleEvolutionWebhook(request.body, tenantSlug);
      appLog.info("evolution_webhook_processed", {
        requestId: request.requestId,
        tenantSlug: tenantSlug ?? null,
        event,
        result
      });
      return reply.send(result);
    };

    webhookScope.post("/webhook/evolution", async (request, reply) => evolutionWebhookHandler(request, reply));
    webhookScope.post("/webhook/evolution/:tenantSlug", async (request, reply) => {
      const { tenantSlug } = request.params as { tenantSlug: string };
      return evolutionWebhookHandler(request, reply, tenantSlug);
    });

    webhookScope.get("/webhook/meta", async (request, reply) => {
      const query = request.query as Record<string, string | undefined>;
      const result = handleMetaCloudWebhookVerify(query);
      if (!result.ok) return reply.status(403).send(result);
      return reply.status(200).send(result.challenge);
    });

    webhookScope.post("/webhook/meta", async (request, reply) => {
      const signature = request.headers["x-hub-signature-256"];
      const rawBody = request.rawBody ?? JSON.stringify(request.body ?? {});
      if (!verifyMetaWebhookSignature(rawBody, typeof signature === "string" ? signature : undefined)) {
        return reply.status(401).send({ ok: false, error: "invalid_meta_signature" });
      }
      const result = await handleMetaCloudWebhook(request.body);
      return reply.send(result);
    });
  });

  await registerRoutes(app);
  return app;
}

async function shutdown(app: Awaited<ReturnType<typeof buildServer>>, signal: string) {
  appLog.info("shutdown_started", { signal });
  if (webhookRetryTimer) clearInterval(webhookRetryTimer);
  if (webhookQueueTimer) clearInterval(webhookQueueTimer);
  if (campaignDispatchTimer) clearInterval(campaignDispatchTimer);
  await app.close().catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
  await closeRedis();
  appLog.info("shutdown_complete", { signal });
  process.exit(0);
}

const app = await buildServer();

app.addHook("onReady", async () => {
  appLog.info("server_ready", {
    host: env.host,
    port: env.port,
    webhook: buildWebhookPublicUrl(env.webhookPublicUrl)
  });

  webhookRetryTimer = setInterval(() => {
    void processWebhookRetries().catch(() => {});
    void processWebhookQueueBatch(20).catch(() => {});
  }, 60_000);

  webhookQueueTimer = setInterval(() => {
    void processWebhookQueueBatch(10).catch(() => {});
  }, 5_000);

  campaignDispatchTimer = setInterval(() => {
    void processCampaignDispatchBatch(12).catch(() => {});
  }, 4_000);
});

process.on("uncaughtException", (error) => {
  appLog.error("uncaught_exception", { message: error.message, stack: error.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  appLog.error("unhandled_rejection", {
    message: reason instanceof Error ? reason.message : String(reason)
  });
  if (env.isProduction) process.exit(1);
});

process.on("SIGTERM", () => void shutdown(app, "SIGTERM"));
process.on("SIGINT", () => void shutdown(app, "SIGINT"));

await app.listen({ port: env.port, host: env.host });
initRealtime(app.server);
