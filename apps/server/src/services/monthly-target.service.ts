import { prisma } from "../lib/prisma";

function currentMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

async function upsertTargetRow(tenantId: string, month: string, teamId: string | null, targetValue: number) {
  const existing = await prisma.monthlyTarget.findFirst({
    where: teamId ? { tenantId, teamId, month } : { tenantId, teamId: null, month }
  });
  if (existing) {
    return prisma.monthlyTarget.update({ where: { id: existing.id }, data: { targetValue } });
  }
  return prisma.monthlyTarget.create({
    data: { tenantId, teamId, month, targetValue }
  });
}

export async function getMonthlyTargetOverview(tenantId: string) {
  const month = currentMonthKey();
  const [tenantTarget, teamTargets, teams] = await Promise.all([
    prisma.monthlyTarget.findFirst({ where: { tenantId, teamId: null, month } }),
    prisma.monthlyTarget.findMany({
      where: { tenantId, teamId: { not: null }, month },
      include: { team: { select: { id: true, name: true } } }
    }),
    prisma.team.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } })
  ]);

  return {
    month,
    tenantTargetValue: Number(tenantTarget?.targetValue ?? 0),
    teamTargets: teamTargets.map((row) => ({
      teamId: row.teamId,
      teamName: row.team?.name ?? "Departamento",
      targetValue: Number(row.targetValue ?? 0)
    })),
    teams
  };
}

export async function upsertMonthlyTargets(
  tenantId: string,
  input: { month?: string; tenantTargetValue?: number; teamTargets?: Array<{ teamId: string; targetValue: number }> }
) {
  const month = input.month?.trim() || currentMonthKey();
  const tenantTargetValue = Math.max(0, Number(input.tenantTargetValue ?? 0));

  await upsertTargetRow(tenantId, month, null, tenantTargetValue);

  for (const row of input.teamTargets ?? []) {
    const targetValue = Math.max(0, Number(row.targetValue ?? 0));
    if (!row.teamId) continue;
    await upsertTargetRow(tenantId, month, row.teamId, targetValue);
  }

  return getMonthlyTargetOverview(tenantId);
}
