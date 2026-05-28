import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { isRedisReady } from "../../lib/redis";
import { getLastEvolutionWebhook } from "./webhook-diagnostics";

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
    return response.ok;
  } catch {
    return false;
  }
}

export async function getTenantDiagnostics(tenantId: string) {
  const [database, redis, evolution, instances, lastInbound, lastOutbound, lastCampaign, webhookMeta] =
    await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      env.redisUrl ? isRedisReady() : Promise.resolve(null),
      checkEvolution(),
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
    ok: database && (!env.redisUrl || redis === true),
    at: new Date().toISOString(),
    checks: {
      api: true,
      database,
      redis: env.redisUrl ? redis : null,
      evolution
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
