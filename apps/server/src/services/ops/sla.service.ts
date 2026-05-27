import { prisma } from "../../lib/prisma";
import { resolveTenantScope } from "./scope.util";

export type SlaConfig = {
  firstResponseMinutes: number;
  resolutionHours: number;
};

export type SlaMetrics = {
  config: SlaConfig;
  periodDays: number;
  conversationsAnalyzed: number;
  avgFirstResponseMinutes: number | null;
  avgResolutionHours: number | null;
  firstResponseWithinSlaPercent: number;
  resolutionWithinSlaPercent: number;
  openOverSlaCount: number;
  agentPerformance: Array<{
    name: string;
    conversations: number;
    avgFirstResponseMinutes: number | null;
    withinSlaPercent: number;
  }>;
};

function settingsObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

export async function getTenantSlaConfig(tenantId: string): Promise<SlaConfig> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const settings = settingsObject(tenant?.settings);
  const firstResponseMinutes =
    typeof settings.slaFirstResponseMinutes === "number"
      ? settings.slaFirstResponseMinutes
      : Number(settings.slaFirstResponseMinutes ?? 15) || 15;
  const resolutionHours =
    typeof settings.slaResolutionHours === "number"
      ? settings.slaResolutionHours
      : Number(settings.slaResolutionHours ?? 24) || 24;
  return { firstResponseMinutes, resolutionHours };
}

function emptySla(config: SlaConfig): SlaMetrics {
  return {
    config,
    periodDays: 30,
    conversationsAnalyzed: 0,
    avgFirstResponseMinutes: null,
    avgResolutionHours: null,
    firstResponseWithinSlaPercent: 0,
    resolutionWithinSlaPercent: 0,
    openOverSlaCount: 0,
    agentPerformance: []
  };
}

export async function getSlaMetrics(
  tenantId: string,
  scope?: { userId?: string; role?: string },
  periodDays = 30
): Promise<SlaMetrics> {
  const config = await getTenantSlaConfig(tenantId);
  const { conversationWhere } = await resolveTenantScope(tenantId, scope);
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const conversations = await prisma.conversation.findMany({
    where: {
      ...conversationWhere,
      createdAt: { gte: since }
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      assignedTo: { select: { name: true } },
      messages: {
        select: { direction: true, createdAt: true },
        orderBy: { createdAt: "asc" }
      }
    },
    take: 500,
    orderBy: { createdAt: "desc" }
  });

  if (!conversations.length) return emptySla(config);

  const resolutionLimitMs = config.resolutionHours * 60 * 60 * 1000;
  const firstResponseLimitMs = config.firstResponseMinutes * 60 * 1000;
  const now = Date.now();

  let firstResponseTotal = 0;
  let firstResponseCount = 0;
  let firstResponseWithin = 0;
  let resolutionTotalMs = 0;
  let resolutionCount = 0;
  let resolutionWithin = 0;
  let openOverSla = 0;

  const agentMap = new Map<
    string,
    { name: string; conversations: number; firstResponseTotal: number; firstResponseCount: number; within: number }
  >();

  for (const conversation of conversations) {
    const agentName = conversation.assignedTo?.name ?? "Sem responsavel";
    const agent =
      agentMap.get(agentName) ??
      { name: agentName, conversations: 0, firstResponseTotal: 0, firstResponseCount: 0, within: 0 };
    agent.conversations += 1;

    const firstInbound = conversation.messages.find((m) => m.direction === "in");
    const firstOutboundAfterInbound = firstInbound
      ? conversation.messages.find((m) => m.direction === "out" && m.createdAt > firstInbound.createdAt)
      : conversation.messages.find((m) => m.direction === "out");

    if (firstInbound && firstOutboundAfterInbound) {
      const diffMs = firstOutboundAfterInbound.createdAt.getTime() - firstInbound.createdAt.getTime();
      const diffMinutes = diffMs / 60000;
      firstResponseTotal += diffMinutes;
      firstResponseCount += 1;
      agent.firstResponseTotal += diffMinutes;
      agent.firstResponseCount += 1;
      if (diffMs <= firstResponseLimitMs) {
        firstResponseWithin += 1;
        agent.within += 1;
      }
    }

    const isResolved = ["closed", "resolved"].includes(conversation.status);
    if (isResolved) {
      const diffMs = conversation.updatedAt.getTime() - conversation.createdAt.getTime();
      resolutionTotalMs += diffMs;
      resolutionCount += 1;
      if (diffMs <= resolutionLimitMs) resolutionWithin += 1;
    } else {
      const ageMs = now - conversation.createdAt.getTime();
      const waitingFirstResponse =
        firstInbound &&
        !firstOutboundAfterInbound &&
        now - firstInbound.createdAt.getTime() > firstResponseLimitMs;
      const waitingResolution = ageMs > resolutionLimitMs;
      if (waitingFirstResponse || waitingResolution) openOverSla += 1;
    }

    agentMap.set(agentName, agent);
  }

  return {
    config,
    periodDays,
    conversationsAnalyzed: conversations.length,
    avgFirstResponseMinutes:
      firstResponseCount > 0 ? Number((firstResponseTotal / firstResponseCount).toFixed(1)) : null,
    avgResolutionHours:
      resolutionCount > 0 ? Number((resolutionTotalMs / resolutionCount / 3600000).toFixed(1)) : null,
    firstResponseWithinSlaPercent:
      firstResponseCount > 0 ? Number(((firstResponseWithin / firstResponseCount) * 100).toFixed(1)) : 0,
    resolutionWithinSlaPercent:
      resolutionCount > 0 ? Number(((resolutionWithin / resolutionCount) * 100).toFixed(1)) : 0,
    openOverSlaCount: openOverSla,
    agentPerformance: Array.from(agentMap.values())
      .map((row) => ({
        name: row.name,
        conversations: row.conversations,
        avgFirstResponseMinutes:
          row.firstResponseCount > 0
            ? Number((row.firstResponseTotal / row.firstResponseCount).toFixed(1))
            : null,
        withinSlaPercent:
          row.firstResponseCount > 0
            ? Number(((row.within / row.firstResponseCount) * 100).toFixed(1))
            : 0
      }))
      .sort((a, b) => b.conversations - a.conversations)
  };
}
