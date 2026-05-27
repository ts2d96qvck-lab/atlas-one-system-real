import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { getTenantBillingOverview } from "./billing.service";

function settingsObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function billingObject(settings: Record<string, unknown>) {
  return settingsObject(settings.billing);
}

export async function getCommercialAccessOverview(tenantId: string) {
  const overview = await getTenantBillingOverview(tenantId);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true, billingDueAt: true } });
  const settings = settingsObject(tenant?.settings);
  const billing = billingObject(settings);
  const paymentHistory = Array.isArray(billing.paymentHistory) ? billing.paymentHistory : [];

  const users = await prisma.user.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      phone: true,
      createdAt: true,
      team: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "asc" }
  });

  const pendingAccess = await prisma.user.count({
    where: { tenantId, status: { in: ["invited", "pending"] } }
  });

  const lastLogins = await prisma.auditLog.findMany({
    where: { tenantId, action: "auth_login_success" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { actorId: true, createdAt: true }
  });

  return {
    ...overview,
    billing: {
      ...overview.billing,
      dueAt: overview.billing.dueAt ?? tenant?.billingDueAt ?? null,
      provider: overview.billing.provider ?? (typeof billing.provider === "string" ? billing.provider : null),
      externalCustomerId:
        overview.billing.externalCustomerId ??
        (typeof billing.externalCustomerId === "string" ? billing.externalCustomerId : null),
      notes: typeof billing.notes === "string" ? billing.notes : "",
      paymentHistory
    },
    access: {
      users,
      pendingAccessRequests: pendingAccess,
      activeUsers: users.filter((user) => user.status === "active").length,
      inactiveUsers: users.filter((user) => user.status !== "active").length,
      lastLogins
    }
  };
}

export async function recordManualPayment(
  tenantId: string,
  input: {
    status: "active" | "overdue" | "blocked";
    note?: string;
    amount?: number;
    paidAt?: string;
    actorId: string;
  }
) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  if (!tenant) throw new Error("Empresa nao encontrada.");

  const settings = settingsObject(tenant.settings);
  const billing = billingObject(settings);
  const paymentHistory = Array.isArray(billing.paymentHistory) ? [...billing.paymentHistory] : [];
  paymentHistory.unshift({
    at: new Date().toISOString(),
    status: input.status,
    note: input.note ?? null,
    amount: input.amount ?? null,
    paidAt: input.paidAt ?? null,
    actorId: input.actorId
  });

  const nextSettings = {
    ...settings,
    billing: {
      ...billing,
      notes: input.note ?? billing.notes ?? "",
      paymentHistory: paymentHistory.slice(0, 50),
      lastManualUpdateAt: new Date().toISOString(),
      lastManualUpdateBy: input.actorId
    }
  };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      billingStatus: input.status,
      blockedAt: input.status === "blocked" ? new Date() : null,
      billingDueAt: input.status === "active" ? null : undefined,
      settings: nextSettings as Prisma.InputJsonObject
    }
  });

  return getCommercialAccessOverview(tenantId);
}
