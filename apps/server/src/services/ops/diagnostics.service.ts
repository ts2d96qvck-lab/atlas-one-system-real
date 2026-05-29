import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { isRedisReady } from "../../lib/redis";
import { getLastEvolutionWebhook } from "./webhook-diagnostics";
import { otpDeliversForReal, otpDeliveryLabel } from "../sms.service";

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

export async function getTenantDiagnostics(tenantId: string) {
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

  const mappedInstances = instances.map((item) => ({
    ...item,
    connectionStatus: mapConnectionStatus(item.status, item.phone),
    webhookConfigured: Boolean(env.webhookPublicUrl)
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
      smsProvider: env.smsProvider
    },
    whatsapp: {
      instances: mappedInstances.length,
      connected: connectedCount,
      webhookPublicUrl: env.webhookPublicUrl.replace(/token=[^&]+/gi, "token=***"),
      lastEvolutionWebhook: webhookMeta
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
