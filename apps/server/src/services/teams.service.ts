import { prisma } from "../lib/prisma";

export const INBOUND_TEAM_NAME = "Novos";

export async function ensureInboundTeam(tenantId: string) {
  const existing = await prisma.team.findFirst({
    where: { tenantId, name: INBOUND_TEAM_NAME },
    select: { id: true, name: true }
  });
  if (existing) return existing;
  try {
    return await prisma.team.create({
      data: { tenantId, name: INBOUND_TEAM_NAME },
      select: { id: true, name: true }
    });
  } catch {
    return prisma.team.findFirst({
      where: { tenantId, name: INBOUND_TEAM_NAME },
      select: { id: true, name: true }
    });
  }
}

export async function pickAssigneeForTeam(tenantId: string, teamId?: string | null) {
  const teamScopedAgents = teamId
    ? await prisma.user.findMany({
        where: { tenantId, status: "active", role: "agent", teamId },
        select: { id: true, teamId: true }
      })
    : [];
  const primaryAgents =
    teamScopedAgents.length > 0
      ? teamScopedAgents
      : await prisma.user.findMany({
          where: { tenantId, status: "active", role: "agent" },
          select: { id: true, teamId: true }
        });
  const candidates =
    primaryAgents.length > 0
      ? primaryAgents
      : await prisma.user.findMany({
          where: { tenantId, status: "active", role: { in: ["supervisor", "admin", "owner"] } },
          select: { id: true, teamId: true }
        });
  if (!candidates.length) return null;
  const openCounts = await prisma.conversation.groupBy({
    by: ["assignedToId"],
    where: { tenantId, status: "open", assignedToId: { in: candidates.map((c) => c.id) } },
    _count: { _all: true }
  });
  const countMap = new Map(openCounts.map((row) => [row.assignedToId, row._count._all]));
  candidates.sort(
    (a, b) => (countMap.get(a.id) ?? 0) - (countMap.get(b.id) ?? 0) || a.id.localeCompare(b.id)
  );
  return candidates[0] ?? null;
}
