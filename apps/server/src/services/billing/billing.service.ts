import { prisma } from "../../lib/prisma";
import type { Prisma } from "@prisma/client";
import { getPlan, normalizePlanId, PLANS, type PlanFeatures, type PlanId } from "./plans";

type TenantSettings = Record<string, unknown>;

function readSettings(raw: unknown): TenantSettings {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as TenantSettings;
  return {};
}

function readBillingSettings(settings: TenantSettings) {
  const billing =
    settings.billing && typeof settings.billing === "object" && !Array.isArray(settings.billing)
      ? (settings.billing as Record<string, unknown>)
      : {};
  return {
    trialEndsAt: billing.trialEndsAt ? new Date(String(billing.trialEndsAt)) : null,
    subscriptionStatus: String(billing.subscriptionStatus ?? "active"),
    provider: billing.provider ? String(billing.provider) : null,
    externalCustomerId: billing.externalCustomerId ? String(billing.externalCustomerId) : null
  };
}

export async function getEffectiveLimits(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Empresa nao encontrada");

  const settings = readSettings(tenant.settings);
  const plan = getPlan(tenant.plan);

  const maxUsers = Number(settings.maxUsers ?? plan.maxUsers);
  const maxInstances = Number(settings.maxInstances ?? plan.maxInstances);
  const maxConversationsPerMonth =
    settings.maxConversationsPerMonth != null
      ? Number(settings.maxConversationsPerMonth)
      : plan.maxConversationsPerMonth;

  return {
    plan,
    maxUsers: Number.isFinite(maxUsers) ? maxUsers : plan.maxUsers,
    maxInstances: Number.isFinite(maxInstances) ? maxInstances : plan.maxInstances,
    maxConversationsPerMonth:
      maxConversationsPerMonth == null || Number.isNaN(maxConversationsPerMonth)
        ? plan.maxConversationsPerMonth
        : maxConversationsPerMonth,
    features: plan.features
  };
}

export async function getTenantUsage(tenantId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [users, instances, conversationsThisMonth] = await Promise.all([
    prisma.user.count({
      where: { tenantId, status: { in: ["active", "invited"] } }
    }),
    prisma.whatsAppInstance.count({ where: { tenantId } }),
    prisma.conversation.count({
      where: { tenantId, createdAt: { gte: monthStart } }
    })
  ]);

  return { users, instances, conversationsThisMonth };
}

export async function getTenantBillingOverview(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Empresa nao encontrada");

  const settings = readSettings(tenant.settings);
  const billingMeta = readBillingSettings(settings);
  const limits = await getEffectiveLimits(tenantId);
  const usage = await getTenantUsage(tenantId);

  const seatsAvailable = Math.max(0, limits.maxUsers - usage.users);
  const instancesAvailable = Math.max(0, limits.maxInstances - usage.instances);

  const trialActive = billingMeta.trialEndsAt ? billingMeta.trialEndsAt.getTime() > Date.now() : false;

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug
    },
    plan: {
      id: limits.plan.id,
      name: limits.plan.name,
      description: limits.plan.description,
      priceLabel: limits.plan.priceLabel,
      features: limits.plan.features
    },
    limits: {
      maxUsers: limits.maxUsers,
      maxInstances: limits.maxInstances,
      maxConversationsPerMonth: limits.maxConversationsPerMonth
    },
    usage,
    seats: {
      used: usage.users,
      limit: limits.maxUsers,
      available: seatsAvailable
    },
    channels: {
      used: usage.instances,
      limit: limits.maxInstances,
      available: instancesAvailable
    },
    billing: {
      status: tenant.billingStatus,
      dueAt: tenant.billingDueAt,
      blockedAt: tenant.blockedAt,
      trialEndsAt: billingMeta.trialEndsAt,
      trialActive,
      subscriptionStatus: billingMeta.subscriptionStatus,
      provider: billingMeta.provider,
      externalCustomerId: billingMeta.externalCustomerId
    },
    capabilities: {
      canAddUser: seatsAvailable > 0 && tenant.billingStatus !== "blocked" && !tenant.blockedAt,
      canAddInstance: instancesAvailable > 0 && tenant.billingStatus !== "blocked" && !tenant.blockedAt,
      withinConversationQuota:
        limits.maxConversationsPerMonth == null || usage.conversationsThisMonth <= limits.maxConversationsPerMonth
    }
  };
}

export async function assertCanAddUser(tenantId: string) {
  const overview = await getTenantBillingOverview(tenantId);
  if (!overview.capabilities.canAddUser) {
    if (overview.billing.status === "blocked" || overview.billing.blockedAt) {
      throw new Error("Conta bloqueada por pendencia de pagamento.");
    }
    throw new Error(
      `Limite de usuarios do plano ${overview.plan.name} atingido (${overview.seats.used}/${overview.seats.limit}). Faca upgrade para adicionar mais seats.`
    );
  }
}

export async function assertCanAddInstance(tenantId: string) {
  const overview = await getTenantBillingOverview(tenantId);
  if (!overview.capabilities.canAddInstance) {
    if (overview.billing.status === "blocked" || overview.billing.blockedAt) {
      throw new Error("Conta bloqueada por pendencia de pagamento.");
    }
    throw new Error(
      `Limite de numeros WhatsApp do plano ${overview.plan.name} atingido (${overview.channels.used}/${overview.channels.limit}). Faca upgrade para adicionar mais canais.`
    );
  }
}

export async function assertWithinConversationQuota(tenantId: string) {
  const overview = await getTenantBillingOverview(tenantId);
  if (overview.capabilities.withinConversationQuota) return;
  const limit = overview.limits.maxConversationsPerMonth;
  throw new Error(
    `Limite mensal de conversas do plano ${overview.plan.name} atingido (${overview.usage.conversationsThisMonth}/${limit ?? "?"}) . Faca upgrade ou aguarde o proximo ciclo.`
  );
}

export async function assertPlanFeature(tenantId: string, feature: keyof PlanFeatures) {
  const limits = await getEffectiveLimits(tenantId);
  if (!limits.features[feature]) {
    throw new Error(`Recurso "${feature}" nao disponivel no plano ${limits.plan.name}. Faca upgrade.`);
  }
}

export async function updateTenantPlan(tenantId: string, planId: PlanId, actorId?: string) {
  const plan = getPlan(planId);
  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { plan: plan.id }
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      actorId: actorId ?? null,
      entity: "Tenant",
      entityId: tenantId,
      action: "plan_updated",
      metadata: { plan: plan.id, planName: plan.name }
    }
  });

  return tenant;
}

export async function startTrial(tenantId: string, days = 14) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Empresa nao encontrada");

  const settings = readSettings(tenant.settings);
  const trialEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const billing = {
    ...(settings.billing && typeof settings.billing === "object" ? (settings.billing as object) : {}),
    trialEndsAt: trialEndsAt.toISOString(),
    subscriptionStatus: "trialing"
  };

  return prisma.tenant.update({
    where: { id: tenantId },
    data: {
      plan: normalizePlanId(tenant.plan),
      billingStatus: "active",
      settings: { ...settings, billing } as Prisma.InputJsonObject
    }
  });
}

export async function applySubscriptionWebhook(input: {
  tenantSlug: string;
  event?: string;
  plan?: string;
  billingStatus?: "active" | "overdue" | "blocked";
  externalCustomerId?: string;
  provider?: string;
}) {
  const tenant = await prisma.tenant.findFirst({ where: { slug: input.tenantSlug } });
  if (!tenant) throw new Error("Tenant nao encontrado");

  const settings = readSettings(tenant.settings);
  const billing = {
    ...(settings.billing && typeof settings.billing === "object" ? (settings.billing as object) : {}),
    provider: input.provider ?? (settings.billing as Record<string, unknown> | undefined)?.provider ?? null,
    externalCustomerId:
      input.externalCustomerId ??
      (settings.billing as Record<string, unknown> | undefined)?.externalCustomerId ??
      null,
    subscriptionStatus:
      input.event === "subscription.canceled"
        ? "canceled"
        : input.billingStatus === "blocked"
          ? "past_due"
          : "active"
  };

  return prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      ...(input.plan ? { plan: normalizePlanId(input.plan) } : {}),
      ...(input.billingStatus
        ? {
            billingStatus: input.billingStatus,
            blockedAt: input.billingStatus === "blocked" ? new Date() : null
          }
        : {}),
      settings: { ...settings, billing } as Prisma.InputJsonObject
    }
  });
}

export function listPlansCatalog() {
  return Object.values(PLANS).map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    priceLabel: plan.priceLabel,
    maxUsers: plan.maxUsers,
    maxInstances: plan.maxInstances,
    maxConversationsPerMonth: plan.maxConversationsPerMonth,
    features: plan.features
  }));
}
