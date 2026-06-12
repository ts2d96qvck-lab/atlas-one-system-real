import { DEFAULT_PLAN, getPlan, TRIAL_DAYS, type PlanId } from "../services/billing/plans";
import { isTrialExpiredForTenant } from "../services/billing/billing.service";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { assertPassword } from "../lib/security/password-policy";
import { signBootstrapTicket } from "../lib/security/bootstrap-ticket";

const onboardingSchema = z.object({
  companyName: z.string().min(2),
  companyDocument: z.string().min(11).max(20).optional(),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(12),
  maxUsers: z.coerce.number().int().min(1).max(1000).default(5),
  maxInstances: z.coerce.number().int().min(1).max(200).default(1),
  allowManagerAccess: z.boolean().default(true),
  whatsappInstanceName: z.string().min(2).default("principal"),
  whatsappLabel: z.string().min(2).default("WhatsApp Comercial")
});

const billingStatusSchema = z.enum(["active", "overdue", "blocked"]);
const updateTenantBillingSchema = z.object({
  billingStatus: billingStatusSchema,
  billingDueAt: z.string().datetime().optional().nullable()
});

const updateTenantLimitsSchema = z.object({
  maxUsers: z.coerce.number().int().min(1).max(1000),
  maxInstances: z.coerce.number().int().min(1).max(200),
  allowManagerAccess: z.boolean().optional()
});

const updateTenantControlsSchema = z.object({
  plan: z.enum(["starter", "pro", "enterprise"]).optional(),
  maxUsers: z.coerce.number().int().min(1).max(1000).optional(),
  maxInstances: z.coerce.number().int().min(1).max(200).optional(),
  trialEndsAt: z.string().datetime().nullable().optional()
});

function settingsObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

function billingObject(settings: Record<string, unknown>) {
  if (settings.billing && typeof settings.billing === "object" && !Array.isArray(settings.billing)) {
    return settings.billing as Record<string, unknown>;
  }
  return {};
}

type TenantWithCounts = Awaited<ReturnType<typeof listTenants>>[number];

export function mapTenantForPlatformAdmin(tenant: TenantWithCounts) {
  const settings = settingsObject(tenant.settings);
  const plan = getPlan(tenant.plan);
  const billing = billingObject(settings);
  const maxUsers = Number(settings.maxUsers ?? plan.maxUsers);
  const maxInstances = Number(settings.maxInstances ?? plan.maxInstances);
  const trialEndsAtRaw = billing.trialEndsAt ? String(billing.trialEndsAt) : null;
  const trialEndsAtDate = trialEndsAtRaw ? new Date(trialEndsAtRaw) : null;
  const subscriptionStatus = String(billing.subscriptionStatus ?? "active");
  const trialDaysRemaining =
    trialEndsAtDate && !Number.isNaN(trialEndsAtDate.getTime())
      ? Math.max(0, Math.ceil((trialEndsAtDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    plan: tenant.plan,
    billingStatus: tenant.billingStatus as "active" | "overdue" | "blocked",
    billingDueAt: tenant.billingDueAt?.toISOString() ?? null,
    blockedAt: tenant.blockedAt?.toISOString() ?? null,
    maxUsers: Number.isFinite(maxUsers) ? maxUsers : plan.maxUsers,
    maxInstances: Number.isFinite(maxInstances) ? maxInstances : plan.maxInstances,
    trialEndsAt: trialEndsAtRaw,
    trialDaysRemaining,
    subscriptionStatus,
    trialActive:
      subscriptionStatus === "trialing" && trialEndsAtDate
        ? trialEndsAtDate.getTime() > Date.now()
        : false,
    trialExpired: isTrialExpiredForTenant(tenant),
    _count: tenant._count
  };
}

export async function listTenants() {
  return prisma.tenant.findMany({
    include: {
      _count: {
        select: {
          users: true,
          conversations: true,
          leads: true,
          instances: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function ownerTenantOverview() {
  const tenants = await prisma.tenant.findMany({
    include: {
      _count: {
        select: {
          users: true,
          conversations: true,
          leads: true,
          instances: true
        }
      }
    }
  });

  const summary = {
    tenants: tenants.length,
    active: tenants.filter((row) => row.billingStatus === "active" && !row.blockedAt).length,
    overdue: tenants.filter((row) => row.billingStatus === "overdue" && !row.blockedAt).length,
    blocked: tenants.filter((row) => row.billingStatus === "blocked" || Boolean(row.blockedAt)).length,
    users: tenants.reduce((sum, row) => sum + row._count.users, 0),
    numbers: tenants.reduce((sum, row) => sum + row._count.instances, 0)
  };

  return { summary, tenants: tenants.map(mapTenantForPlatformAdmin) };
}

export async function updateTenantControls(tenantId: string, input: unknown) {
  const data = updateTenantControlsSchema.parse(input);
  const exists = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!exists) throw new Error("Tenant nao encontrado");

  const currentSettings = settingsObject(exists.settings);
  const currentBilling = billingObject(currentSettings);
  const settings = {
    ...currentSettings,
    ...(data.maxUsers != null ? { maxUsers: data.maxUsers } : {}),
    ...(data.maxInstances != null ? { maxInstances: data.maxInstances } : {}),
    billing: {
      ...currentBilling,
      ...(data.trialEndsAt !== undefined ? { trialEndsAt: data.trialEndsAt } : {})
    }
  };

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      ...(data.plan ? { plan: data.plan as PlanId } : {}),
      settings
    },
    include: {
      _count: {
        select: {
          users: true,
          conversations: true,
          leads: true,
          instances: true
        }
      }
    }
  });

  return mapTenantForPlatformAdmin(updated);
}

export async function updateTenantBilling(tenantId: string, input: unknown) {
  const data = updateTenantBillingSchema.parse(input);
  const exists = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!exists) throw new Error("Tenant nao encontrado");

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      billingStatus: data.billingStatus,
      billingDueAt: data.billingDueAt ? new Date(data.billingDueAt) : null,
      blockedAt: data.billingStatus === "blocked" ? new Date() : null
    },
    include: {
      _count: {
        select: {
          users: true,
          conversations: true,
          leads: true,
          instances: true
        }
      }
    }
  });

  return mapTenantForPlatformAdmin(updated);
}

export async function updateTenantLimits(tenantId: string, input: unknown) {
  const data = updateTenantLimitsSchema.parse(input);
  const exists = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!exists) throw new Error("Tenant nao encontrado");

  const currentSettings =
    exists.settings && typeof exists.settings === "object" && !Array.isArray(exists.settings)
      ? (exists.settings as Record<string, unknown>)
      : {};
  const settings = {
    ...currentSettings,
    maxUsers: data.maxUsers,
    maxInstances: data.maxInstances,
    allowManagerAccess: data.allowManagerAccess ?? Boolean(currentSettings.allowManagerAccess ?? true)
  };

  return prisma.tenant.update({
    where: { id: tenantId },
    data: { settings },
    include: {
      _count: {
        select: {
          users: true,
          conversations: true,
          leads: true,
          instances: true
        }
      }
    }
  });
}

const DEFAULT_STAGES = [
  "Novos leads",
  "Contato feito",
  "Reuniao marcada",
  "Proposta enviada",
  "Negociacao",
  "Fechado",
  "Perdido"
];

export async function onboardTenant(input: unknown) {
  const data = onboardingSchema.parse(input);
  assertPassword(data.ownerPassword);

  const existing = await prisma.tenant.findUnique({ where: { slug: data.slug } });
  if (existing) throw new Error("Slug de tenant ja existe");

  const passwordHash = await bcrypt.hash(data.ownerPassword, 12);

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: data.companyName,
        slug: data.slug,
        plan: DEFAULT_PLAN,
        settings: {
          companyDocument: data.companyDocument ?? null,
          maxUsers: data.maxUsers,
          maxInstances: data.maxInstances,
          allowManagerAccess: data.allowManagerAccess,
          billing: {
            trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
            subscriptionStatus: "trialing"
          }
        }
      }
    });

    const owner = await tx.user.create({
      data: {
        tenantId: tenant.id,
        name: data.ownerName,
        email: data.ownerEmail.toLowerCase(),
        passwordHash,
        role: "owner",
        status: "active",
        permissions: ["*"]
      }
    });

    await tx.whatsAppInstance.create({
      data: {
        tenantId: tenant.id,
        name: data.whatsappInstanceName,
        label: data.whatsappLabel,
        status: "created"
      }
    });

    const pipeline = await tx.pipeline.create({
      data: {
        tenantId: tenant.id,
        name: "Pipeline Comercial"
      }
    });

    await Promise.all(
      DEFAULT_STAGES.map((name, index) =>
        tx.pipelineStage.create({
          data: {
            pipelineId: pipeline.id,
            name,
            order: index,
            color: index >= 5 ? "#12b981" : "#1f6fff"
          }
        })
      )
    );

    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorId: owner.id,
        entity: "Tenant",
        entityId: tenant.id,
        action: "onboarded",
        metadata: {
          slug: tenant.slug,
          ownerEmail: owner.email,
          companyDocument: data.companyDocument ?? null
        }
      }
    });

    return {
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan },
      owner: { id: owner.id, name: owner.name, email: owner.email }
    };
  });
}

export function createBootstrapOnboardingLink(input: { tenantSlug?: string; baseUrl?: string }) {
  const signed = signBootstrapTicket({ tenantSlug: input.tenantSlug, ttlHours: 72 });
  const base = (input.baseUrl ?? env.appPublicUrl).replace(/\/$/, "");
  const params = new URLSearchParams({ auth: "register", setup: signed.token });
  const slug = input.tenantSlug?.trim().toLowerCase();
  if (slug) params.set("tenant", slug);
  return { url: `${base}/?${params.toString()}`, expiresAt: signed.expiresAt };
}
