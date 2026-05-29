import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { isRedisReady } from "../../lib/redis";
import { getLastEvolutionWebhook } from "./webhook-diagnostics";
import { otpDeliversForReal, otpDeliveryLabel } from "../sms.service";
import { createEvolutionProvider } from "../whatsapp/providers/evolution.provider";
import { normalizeProviderKind } from "../whatsapp/whatsapp-instance.service";
import {
  buildEvolutionWebhookUrl,
  describeEvolutionWebhookConfig,
  probeHttpsAvailability,
  redactWebhookToken
} from "../../lib/evolution-webhook-url";

function mapConnectionStatus(status: string | null | undefined, phone: string | null | undefined) {
  const value = String(status ?? "").toLowerCase();
  if (["open", "connected"].includes(value)) return "connected";
  if (["connecting", "created", "qrcode", "pairing"].includes(value)) return "connecting";
  if (["closed", "logout", "disconnected"].includes(value)) return "disconnected";
  if (!phone) return "needs_setup";
  return "error";
}

async function checkEvolution() {
  try {
    const response = await fetch(`${env.evolutionUrl.replace(/\/$/, "")}/`, {
      headers: env.evolutionApiKey ? { apikey: env.evolutionApiKey } : undefined,
      signal: AbortSignal.timeout(4000)
    });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function checkSmsProviderConfigured() {
  const provider = env.smsProvider;
  if (provider === "twilio") {
    const configured = Boolean(env.smsTwilioSid && env.smsTwilioToken && env.smsTwilioFrom);
    return { provider, channel: "SMS", configured, deliversForReal: otpDeliversForReal() };
  }
  if (provider === "webhook") {
    const configured = Boolean(env.smsWebhookUrl);
    return { provider, channel: "SMS", configured, deliversForReal: otpDeliversForReal() };
  }
  if (provider === "whatsapp" || provider === "console") {
    return {
      provider,
      channel: otpDeliveryLabel(),
      configured: true,
      deliversForReal: otpDeliversForReal(),
      note: provider === "console" ? "console routes OTP via WhatsApp/Evolution" : undefined
    };
  }
  return { provider, channel: otpDeliveryLabel(), configured: false, deliversForReal: otpDeliversForReal() };
}

async function buildInstanceDiagnostics(
  tenantId: string,
  dbInstances: Array<{
    id: string;
    name: string;
    label: string;
    status: string;
    phone: string | null;
    lastSyncAt: Date | null;
    provider: string;
  }>
) {
  const provider = createEvolutionProvider();
  const evolutionRows = await provider.fetchInstances();
  const mismatches: Array<{
    dbName: string;
    evolutionName: string;
    renamedSuggestion: string;
    phone?: string | null;
  }> = [];

  for (const dbInst of dbInstances) {
    if (normalizeProviderKind(dbInst.provider) !== "evolution") continue;
    try {
      const evolutionName = await provider.resolveInstanceName(dbInst.name, dbInst.phone ?? undefined);
      if (evolutionName !== dbInst.name) {
        mismatches.push({
          dbName: dbInst.name,
          evolutionName,
          renamedSuggestion: evolutionName,
          phone: dbInst.phone
        });
      }
    } catch {
      mismatches.push({
        dbName: dbInst.name,
        evolutionName: "(unresolved)",
        renamedSuggestion: dbInst.name,
        phone: dbInst.phone
      });
    }
  }

  return {
    evolutionInstances: evolutionRows.map((row) => ({
      name: row.name,
      connectionStatus: row.connectionStatus,
      number: row.number || null,
      note: "UUID folders on disk are internal; Evolution API uses the name field above."
    })),
    instanceMismatches: mismatches,
    dbInstances: dbInstances.map((item) => item.name)
  };
}

export async function getTenantDiagnostics(tenantId: string, tenantSlug?: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true }
  });
  const slug = tenantSlug ?? tenant?.slug ?? "";

  const [database, redis, evolution, sms, instances, lastInbound, lastOutbound, lastCampaign, webhookMeta] =
    await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => ({ ok: true })).catch((error) => ({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      })),
      env.redisUrl
        ? isRedisReady().then((ok) => ({ ok, configured: true }))
        : Promise.resolve({ ok: null, configured: false }),
      checkEvolution(),
      Promise.resolve(checkSmsProviderConfigured()),
      prisma.whatsAppInstance.findMany({
        where: { tenantId },
        select: { id: true, name: true, label: true, status: true, phone: true, lastSyncAt: true, provider: true }
      }),
      prisma.message.findFirst({
        where: { direction: "in", conversation: { tenantId } },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true, conversationId: true }
      }),
      prisma.message.findFirst({
        where: { direction: "out", conversation: { tenantId } },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true, conversationId: true }
      }),
      prisma.campaign.findFirst({
        where: { tenantId, startedAt: { not: null } },
        orderBy: { startedAt: "desc" },
        select: { id: true, name: true, status: true, startedAt: true }
      }),
      Promise.resolve(getLastEvolutionWebhook())
    ]);

  const instanceDiagnostics = await buildInstanceDiagnostics(tenantId, instances);

  const webhookConfig = slug ? describeEvolutionWebhookConfig(slug) : null;
  const configuredUrl = slug ? buildEvolutionWebhookUrl(slug) : null;
  const httpsProbe =
    configuredUrl && webhookConfig?.protocol === "https"
      ? await probeHttpsAvailability(configuredUrl)
      : env.webhookPublicUrl.startsWith("https://")
        ? await probeHttpsAvailability(env.webhookPublicUrl)
        : null;

  const webhookWarnings = [...(webhookConfig?.warnings ?? [])];
  if (httpsProbe && !httpsProbe.ok) {
    webhookWarnings.push(
      `HTTPS port 443 appears unavailable (${httpsProbe.error ?? "probe failed"}). Use HTTP or EVOLUTION_WEBHOOK_BASE_URL=http://nginx until TLS is live.`
    );
  }

  const mappedInstances = instances.map((item) => ({
    ...item,
    connectionStatus: mapConnectionStatus(item.status, item.phone),
    webhookConfigured: Boolean(configuredUrl)
  }));

  const connectedCount = mappedInstances.filter((item) => item.connectionStatus === "connected").length;

  return {
    ok: database.ok && (!env.redisUrl || redis.ok === true),
    at: new Date().toISOString(),
    checks: {
      api: true,
      postgresql: database,
      redis,
      evolution,
      sms
    },
    environment: {
      nodeEnv: env.nodeEnv,
      enterpriseMode: env.enterpriseMode,
      disableSuspicious2fa: env.disableSuspicious2fa,
      qaBypass2fa: env.qaBypass2fa,
      allowLocalSms: env.allowLocalSms,
      smsProvider: env.smsProvider,
      webhookUseHttps: env.webhookUseHttps
    },
    whatsapp: {
      instances: mappedInstances.length,
      connected: connectedCount,
      webhookPublicUrl: redactWebhookToken(env.webhookPublicUrl),
      evolutionWebhookBaseUrl: env.evolutionWebhookBaseUrl.trim() || null,
      webhook: webhookConfig
        ? {
            ...webhookConfig,
            warnings: webhookWarnings,
            httpsReachable: httpsProbe
          }
        : null,
      configuredWebhookUrl: configuredUrl ? redactWebhookToken(configuredUrl) : null,
      lastEvolutionWebhook: webhookMeta,
      ...instanceDiagnostics
    },
    activity: {
      lastInboundMessageAt: lastInbound?.createdAt?.toISOString() ?? null,
      lastOutboundMessageAt: lastOutbound?.createdAt?.toISOString() ?? null,
      lastCampaignStarted: lastCampaign
        ? {
            id: lastCampaign.id,
            name: lastCampaign.name,
            status: lastCampaign.status,
            at: lastCampaign.startedAt?.toISOString() ?? null
          }
        : null
    }
  };
}

export { mapConnectionStatus };
