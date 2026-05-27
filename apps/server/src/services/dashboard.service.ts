import { prisma } from "../lib/prisma";
import { getSlaMetrics } from "./ops/sla.service";

const DEFAULT_PIPELINE = [
  "Novos leads",
  "Contato feito",
  "Reuniao marcada",
  "Proposta enviada",
  "Negociacao",
  "Fechado",
  "Perdido"
] as const;

function emptyDashboard() {
  const pipeline = Object.fromEntries(
    DEFAULT_PIPELINE.map((stage) => [stage, { count: 0, value: 0 }])
  ) as Record<string, { count: number; value: number }>;

  return {
    metrics: {
      conversationTotal: 0,
      openConversations: 0,
      resolvedConversations: 0,
      leads: 0,
      sentMessages: 0,
      totalLeadValue: 0,
      closedRevenueMonth: 0,
      projectedRevenueMonth: 0,
      targetRevenue: 0,
      targetProgressPercent: 0,
      averageTicket: 0,
      conversionRate: 0,
      closedDealsMonth: 0,
      projectedDealsMonth: 0,
      gapToTarget: 0,
      weightedPipeline: 0,
      confidenceLevel: 0
    },
    pipeline,
    salesForecast: {
      conservative: 0,
      realistic: 0,
      optimistic: 0,
      runRateRevenue: 0
    },
    teamPerformance: [],
    instances: [],
    sla: {
      config: { firstResponseMinutes: 15, resolutionHours: 24 },
      periodDays: 30,
      conversationsAnalyzed: 0,
      avgFirstResponseMinutes: null,
      avgResolutionHours: null,
      firstResponseWithinSlaPercent: 0,
      resolutionWithinSlaPercent: 0,
      openOverSlaCount: 0,
      agentPerformance: []
    }
  };
}

function getMonthDateRange(reference = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function stageWeight(stage: string) {
  const s = stage.toLowerCase();
  if (s.includes("novo")) return 0.15;
  if (s.includes("contato")) return 0.28;
  if (s.includes("reuniao")) return 0.45;
  if (s.includes("proposta")) return 0.65;
  if (s.includes("negoci")) return 0.82;
  if (s.includes("fechado")) return 1;
  return 0.2;
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

export async function getDashboard(
  tenantId: string,
  scope?: { userId?: string; role?: string }
) {
  try {
    const isManagerScope = scope?.role === "manager" || scope?.role === "team_manager";
    let scopedUserIds: string[] | null = null;

    if (isManagerScope && scope?.userId) {
      const manager = await prisma.user.findFirst({
        where: { tenantId, id: scope.userId },
        select: {
          id: true,
          teamId: true,
          managedTeams: { select: { id: true } }
        }
      });
      if (manager) {
        const managedTeamIds = manager.managedTeams.map((team) => team.id);
        const teamIdSet = new Set<string>();
        if (manager.teamId) teamIdSet.add(manager.teamId);
        for (const id of managedTeamIds) teamIdSet.add(id);
        if (teamIdSet.size) {
          const members = await prisma.user.findMany({
            where: { tenantId, teamId: { in: Array.from(teamIdSet) } },
            select: { id: true }
          });
          scopedUserIds = Array.from(new Set([scope.userId, ...members.map((m) => m.id)]));
        } else {
          scopedUserIds = [scope.userId];
        }
      }
    }

    const conversationWhere = scopedUserIds
      ? { tenantId, assignedToId: { in: scopedUserIds } }
      : { tenantId };
    const leadWhere = scopedUserIds
      ? { tenantId, assignedToId: { in: scopedUserIds } }
      : { tenantId };
    const { start, end } = getMonthDateRange();

    const [conversationTotal, openConversations, closedConversations, leads, sentMessages, instances, monthlyTargetRows] = await Promise.all([
      prisma.conversation.count({ where: conversationWhere }),
      prisma.conversation.count({ where: { ...conversationWhere, status: { in: ["open", "pending", "waiting_customer"] } } }),
      prisma.conversation.count({ where: { ...conversationWhere, status: { in: ["closed", "resolved"] } } }),
      prisma.lead.findMany({
        where: leadWhere,
        select: {
          status: true,
          value: true,
          closedAt: true,
          lostAt: true,
          expectedCloseDate: true,
          assignedTo: { select: { id: true, name: true } }
        }
      }),
      prisma.message.count({
        where: {
          direction: "out",
          conversation: conversationWhere
        }
      }),
      prisma.whatsAppInstance.findMany({
        where: { tenantId },
        select: { name: true, label: true, status: true, phone: true, lastSyncAt: true }
      }),
      prisma.monthlyTarget.findMany({
        where: {
          tenantId,
          month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`
        },
        select: { targetValue: true, teamId: true }
      })
    ]);

    const pipeline = emptyDashboard().pipeline;
    let totalLeadValue = 0;
    let weightedPipeline = 0;
    let openPipelineValue = 0;
    let closedRevenueMonth = 0;
    let closedDealsMonth = 0;
    let lostDealsMonth = 0;
    const teamStats = new Map<string, { name: string; leads: number; closed: number; revenue: number; weighted: number }>();

    for (const lead of leads) {
      const stage = lead.status in pipeline ? lead.status : "Novos leads";
      const bucket = pipeline[stage] ?? { count: 0, value: 0 };
      const leadValue = toNumber(lead.value);
      bucket.count += 1;
      bucket.value += leadValue;
      pipeline[stage] = bucket;
      totalLeadValue += leadValue;

      const weight = stageWeight(lead.status);
      const weightedValue = leadValue * weight;
      const isClosed = lead.status.toLowerCase().includes("fechado") || (lead.closedAt && lead.closedAt >= start && lead.closedAt <= end);
      const isLost = lead.status.toLowerCase().includes("perdido") || (lead.lostAt && lead.lostAt >= start && lead.lostAt <= end);

      if (isClosed) {
        closedDealsMonth += 1;
        closedRevenueMonth += leadValue;
      } else if (!isLost) {
        openPipelineValue += leadValue;
        weightedPipeline += weightedValue;
      }
      if (isLost) lostDealsMonth += 1;

      const owner = lead.assignedTo?.name ?? "Sem responsavel";
      const current = teamStats.get(owner) ?? { name: owner, leads: 0, closed: 0, revenue: 0, weighted: 0 };
      current.leads += 1;
      current.weighted += weightedValue;
      if (isClosed) {
        current.closed += 1;
        current.revenue += leadValue;
      }
      teamStats.set(owner, current);
    }

    const daysInMonth = end.getDate();
    const dayOfMonth = Math.max(1, Math.min(daysInMonth, new Date().getDate()));
    const runRateRevenue = (closedRevenueMonth / dayOfMonth) * daysInMonth;
    const projectedRevenueMonth = Math.round(closedRevenueMonth + weightedPipeline * 0.55);
    const projectedDealsMonth = Math.round(closedDealsMonth + Math.max(0, leads.length - closedDealsMonth - lostDealsMonth) * 0.45);
    const averageTicket = closedDealsMonth ? closedRevenueMonth / closedDealsMonth : 0;
    const conversionRate = leads.length ? (closedDealsMonth / leads.length) * 100 : 0;

    const targetRevenue = monthlyTargetRows.reduce((sum, row) => sum + toNumber(row.targetValue), 0);
    const targetProgressPercent = targetRevenue > 0 ? Math.min(100, (closedRevenueMonth / targetRevenue) * 100) : 0;
    const gapToTarget = Math.max(0, targetRevenue - projectedRevenueMonth);
    const confidenceLevel = openPipelineValue > 0 ? Math.min(99, (weightedPipeline / openPipelineValue) * 100) : 0;

    const conservative = Math.round(closedRevenueMonth + weightedPipeline * 0.4);
    const realistic = Math.round(closedRevenueMonth + weightedPipeline * 0.55);
    const optimistic = Math.round(closedRevenueMonth + weightedPipeline * 0.75);

    const sla = await getSlaMetrics(tenantId, scope, 30);

    return {
      metrics: {
        ...emptyDashboard().metrics,
        conversationTotal,
        openConversations,
        resolvedConversations: closedConversations,
        leads: leads.length,
        sentMessages,
        totalLeadValue,
        closedRevenueMonth,
        projectedRevenueMonth,
        targetRevenue,
        targetProgressPercent: Number(targetProgressPercent.toFixed(1)),
        averageTicket: Math.round(averageTicket),
        conversionRate: Number(conversionRate.toFixed(1)),
        closedDealsMonth,
        projectedDealsMonth,
        gapToTarget,
        weightedPipeline: Math.round(weightedPipeline),
        confidenceLevel: Number(confidenceLevel.toFixed(1))
      },
      pipeline,
      salesForecast: {
        conservative,
        realistic,
        optimistic,
        runRateRevenue: Math.round(runRateRevenue)
      },
      teamPerformance: Array.from(teamStats.values())
        .sort((a, b) => b.revenue - a.revenue)
        .map((row) => ({
          ...row,
          conversionRate: row.leads ? Number(((row.closed / row.leads) * 100).toFixed(1)) : 0
        })),
      instances,
      sla
    };
  } catch {
    return emptyDashboard();
  }
}
