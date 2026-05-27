import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { normalizeWhatsAppNumber, parseRecipientLines } from "../lib/whatsapp-phone";
import { assertPlanFeature } from "./billing/billing.service";

const campaignConfigSchema = z.object({
  messagesPerMinute: z.coerce.number().min(1).max(120).default(15),
  onlyBusinessHours: z.boolean().default(false),
  respectOptOut: z.boolean().default(true)
});

export const createCampaignSchema = z.object({
  name: z.string().min(2).max(120),
  instanceId: z.string().min(1),
  messageKind: z.enum(["session", "template"]).default("session"),
  message: z.string().max(4096).optional(),
  templateName: z.string().max(120).optional(),
  templateLanguage: z.string().max(16).default("pt_BR"),
  scheduledAt: z.string().datetime().optional().nullable(),
  config: campaignConfigSchema.optional(),
  recipients: z
    .array(
      z.object({
        phone: z.string().min(8),
        name: z.string().optional()
      })
    )
    .optional(),
  recipientsText: z.string().max(500_000).optional()
});

export const updateCampaignSchema = createCampaignSchema.partial();

function parseConfig(raw: unknown) {
  const parsed = campaignConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : campaignConfigSchema.parse({});
}

function recipientStats(recipients: Array<{ status: string }>) {
  const stats = { pending: 0, sent: 0, failed: 0, skipped: 0, total: recipients.length };
  for (const row of recipients) {
    if (row.status === "sent") stats.sent += 1;
    else if (row.status === "failed") stats.failed += 1;
    else if (row.status === "skipped") stats.skipped += 1;
    else stats.pending += 1;
  }
  return stats;
}

export async function listCampaigns(tenantId: string) {
  const rows = await prisma.campaign.findMany({
    where: { tenantId },
    include: {
      instance: { select: { id: true, name: true, label: true, status: true } },
      recipients: { select: { status: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    messageKind: row.messageKind,
    message: row.message,
    templateName: row.templateName,
    templateLanguage: row.templateLanguage,
    scheduledAt: row.scheduledAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    config: row.config,
    instance: row.instance,
    stats: recipientStats(row.recipients),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

export async function getCampaign(tenantId: string, id: string) {
  const row = await prisma.campaign.findFirst({
    where: { tenantId, id },
    include: {
      instance: { select: { id: true, name: true, label: true, status: true } },
      recipients: { orderBy: { createdAt: "asc" } }
    }
  });
  if (!row) throw new Error("Campanha nao encontrada");
  return {
    ...row,
    stats: recipientStats(row.recipients)
  };
}

function resolveRecipients(input: z.infer<typeof createCampaignSchema>) {
  const fromArray =
    input.recipients?.map((row) => ({
      phone: normalizeWhatsAppNumber(row.phone),
      name: row.name?.trim() || null
    })) ?? [];
  const fromText = input.recipientsText ? parseRecipientLines(input.recipientsText) : [];
  const merged = [...fromArray, ...fromText.map((row) => ({ phone: row.phone, name: row.name ?? null }))];
  const unique = new Map<string, { phone: string; name: string | null }>();
  for (const row of merged) {
    if (!row.phone) continue;
    if (!unique.has(row.phone)) unique.set(row.phone, row);
  }
  return Array.from(unique.values());
}

export async function createCampaign(tenantId: string, actorId: string | undefined, input: unknown) {
  await assertPlanFeature(tenantId, "campaigns");
  const data = createCampaignSchema.parse(input);

  const instance = await prisma.whatsAppInstance.findFirst({
    where: { tenantId, id: data.instanceId }
  });
  if (!instance) throw new Error("Instancia WhatsApp nao encontrada.");

  const recipients = resolveRecipients(data);
  if (!recipients.length) throw new Error("Informe pelo menos um destinatario.");

  if (data.messageKind === "session" && !data.message?.trim()) {
    throw new Error("Informe a mensagem da campanha.");
  }
  if (data.messageKind === "template" && !data.templateName?.trim()) {
    throw new Error("Informe o nome do template Meta.");
  }

  const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
  const status = scheduledAt && scheduledAt.getTime() > Date.now() ? "scheduled" : "draft";

  return prisma.campaign.create({
    data: {
      tenantId,
      instanceId: instance.id,
      name: data.name.trim(),
      status,
      messageKind: data.messageKind,
      message: data.message?.trim() || null,
      templateName: data.templateName?.trim() || null,
      templateLanguage: data.templateLanguage || "pt_BR",
      config: parseConfig(data.config) as Prisma.InputJsonObject,
      scheduledAt,
      createdById: actorId ?? null,
      recipients: {
        create: recipients.map((row) => ({
          tenantId,
          phone: row.phone,
          name: row.name,
          status: "pending"
        }))
      }
    },
    include: {
      instance: { select: { id: true, name: true, label: true, status: true } },
      recipients: { select: { status: true } }
    }
  });
}

export async function updateCampaign(tenantId: string, id: string, input: unknown) {
  const existing = await prisma.campaign.findFirst({ where: { tenantId, id } });
  if (!existing) throw new Error("Campanha nao encontrada.");
  if (!["draft", "scheduled", "paused"].includes(existing.status)) {
    throw new Error("Campanha em andamento nao pode ser editada.");
  }

  const data = updateCampaignSchema.parse(input);
  const recipients = data.recipients || data.recipientsText ? resolveRecipients(data as z.infer<typeof createCampaignSchema>) : null;

  return prisma.$transaction(async (tx) => {
    if (recipients?.length) {
      await tx.campaignRecipient.deleteMany({ where: { campaignId: id } });
      await tx.campaignRecipient.createMany({
        data: recipients.map((row) => ({
          campaignId: id,
          tenantId,
          phone: row.phone,
          name: row.name,
          status: "pending"
        }))
      });
    }

    const scheduledAt =
      data.scheduledAt === null ? null : data.scheduledAt ? new Date(data.scheduledAt) : existing.scheduledAt;

    return tx.campaign.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        instanceId: data.instanceId,
        messageKind: data.messageKind,
        message: data.message === undefined ? undefined : data.message?.trim() || null,
        templateName: data.templateName === undefined ? undefined : data.templateName?.trim() || null,
        templateLanguage: data.templateLanguage,
        scheduledAt,
        config: data.config ? (parseConfig(data.config) as Prisma.InputJsonObject) : undefined
      },
      include: {
        instance: { select: { id: true, name: true, label: true, status: true } },
        recipients: { select: { status: true } }
      }
    });
  });
}

export async function startCampaign(tenantId: string, id: string) {
  const campaign = await prisma.campaign.findFirst({ where: { tenantId, id } });
  if (!campaign) throw new Error("Campanha nao encontrada.");
  if (!["draft", "scheduled", "paused"].includes(campaign.status)) {
    throw new Error("Campanha nao pode ser iniciada neste status.");
  }

  const pending = await prisma.campaignRecipient.count({
    where: { campaignId: id, status: { in: ["pending", "failed"] } }
  });
  if (!pending) throw new Error("Nenhum destinatario pendente.");

  return prisma.campaign.update({
    where: { id },
    data: {
      status: "running",
      startedAt: campaign.startedAt ?? new Date(),
      completedAt: null
    }
  });
}

export async function pauseCampaign(tenantId: string, id: string) {
  const campaign = await prisma.campaign.findFirst({ where: { tenantId, id } });
  if (!campaign) throw new Error("Campanha nao encontrada.");
  if (campaign.status !== "running") throw new Error("Somente campanhas em execucao podem ser pausadas.");
  return prisma.campaign.update({ where: { id }, data: { status: "paused" } });
}

export async function cancelCampaign(tenantId: string, id: string) {
  const campaign = await prisma.campaign.findFirst({ where: { tenantId, id } });
  if (!campaign) throw new Error("Campanha nao encontrada.");
  if (campaign.status === "completed") throw new Error("Campanha ja concluida.");
  return prisma.campaign.update({
    where: { id },
    data: { status: "cancelled", completedAt: new Date() }
  });
}

export async function deleteCampaign(tenantId: string, id: string) {
  const campaign = await prisma.campaign.findFirst({ where: { tenantId, id } });
  if (!campaign) throw new Error("Campanha nao encontrada.");
  if (campaign.status === "running") throw new Error("Pause a campanha antes de excluir.");
  await prisma.campaign.delete({ where: { id } });
  return { id };
}
