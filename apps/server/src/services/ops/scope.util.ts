import { prisma } from "../../lib/prisma";

export type TenantScope = {
  conversationWhere: { tenantId: string; assignedToId?: { in: string[] } };
  leadWhere: { tenantId: string; assignedToId?: { in: string[] } };
};

export async function resolveTenantScope(
  tenantId: string,
  scope?: { userId?: string; role?: string }
): Promise<TenantScope> {
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
      const teamIdSet = new Set<string>();
      if (manager.teamId) teamIdSet.add(manager.teamId);
      for (const id of manager.managedTeams.map((team) => team.id)) teamIdSet.add(id);
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
  const leadWhere = scopedUserIds ? { tenantId, assignedToId: { in: scopedUserIds } } : { tenantId };

  return { conversationWhere, leadWhere };
}
