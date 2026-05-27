import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { appLog } from "./app-log";

declare module "fastify" {
  interface FastifyRequest {
    requestId?: string;
    rawBody?: string;
  }
}

export function registerRequestContext(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    const incoming = request.headers["x-request-id"];
    const requestId = typeof incoming === "string" && incoming.trim() ? incoming.trim() : randomUUID();
    request.requestId = requestId;
    reply.header("x-request-id", requestId);
  });

  app.addHook("onResponse", async (request, reply) => {
    appLog.info("http_request", {
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: reply.elapsedTime
    });
  });
}
