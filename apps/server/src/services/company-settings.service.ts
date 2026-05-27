import { z } from "zod";
import { prisma } from "../lib/prisma";
import { parseMessagingSettings } from "./messaging/message-signature.service";

const updateCompanySettingsSchema = z.object({
  name: z.string().min(2).optional(),
  settings: z
    .object({
      timezone: z.string().optional(),
      businessHoursStart: z.string().optional(),
      businessHoursEnd: z.string().optional(),
      welcomeMessage: z.string().max(500).optional(),
      slaFirstResponseMinutes: z.coerce.number().min(1).max(240).optional(),
      slaResolutionHours: z.coerce.number().min(1).max(168).optional(),
      messaging: z
        .object({
          showAgentNameToCustomer: z.boolean().optional(),
          showBotNameToCustomer: z.boolean().optional(),
          agentSignatureFormat: z.string().max(120).optional(),
          botSignatureFormat: z.string().max(120).optional(),
          signaturePlacement: z.enum(["before", "after", "disabled"]).optional()
        })
        .partial()
        .optional()
    })
    .partial()
    .optional()
});

function settingsObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

export async function getCompanySettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      status: true,
      settings: true,
      createdAt: true
    }
  });
  if (!tenant) throw new Error("Empresa nao encontrada.");

  const settings = settingsObject(tenant.settings);
  const messaging = parseMessagingSettings(tenant.settings);
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    plan: tenant.plan,
    status: tenant.status,
    timezone: typeof settings.timezone === "string" ? settings.timezone : "America/Sao_Paulo",
    businessHoursStart: typeof settings.businessHoursStart === "string" ? settings.businessHoursStart : "08:00",
    businessHoursEnd: typeof settings.businessHoursEnd === "string" ? settings.businessHoursEnd : "18:00",
    welcomeMessage: typeof settings.welcomeMessage === "string" ? settings.welcomeMessage : "",
    slaFirstResponseMinutes:
      typeof settings.slaFirstResponseMinutes === "number"
        ? settings.slaFirstResponseMinutes
        : Number(settings.slaFirstResponseMinutes ?? 15) || 15,
    slaResolutionHours:
      typeof settings.slaResolutionHours === "number"
        ? settings.slaResolutionHours
        : Number(settings.slaResolutionHours ?? 24) || 24,
    messaging
  };
}

export async function updateCompanySettings(tenantId: string, input: unknown) {
  const data = updateCompanySettingsSchema.parse(input);
  const current = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  if (!current) throw new Error("Empresa nao encontrada.");

  const merged = {
    ...settingsObject(current.settings),
    ...(data.settings ?? {}),
    ...(data.settings?.messaging
      ? {
          messaging: {
            ...settingsObject(settingsObject(current.settings).messaging),
            ...data.settings.messaging
          }
        }
      : {})
  };

  return prisma.tenant.update({
    where: { id: tenantId },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
      settings: merged
    },
    select: { id: true, name: true, slug: true, plan: true, settings: true }
  });
}

export async function getWhatsAppChannelSettings(tenantId: string) {
  const instances = await prisma.whatsAppInstance.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      label: true,
      phone: true,
      provider: true,
      status: true,
      lastSyncAt: true
    },
    orderBy: { createdAt: "asc" }
  });
  return { instances };
}
