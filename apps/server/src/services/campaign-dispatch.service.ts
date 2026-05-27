import type { TemplateComponent } from "@atlas-one/lib";
import { prisma } from "../lib/prisma";
import { applyMessageTemplate, normalizeWhatsAppNumber } from "../lib/whatsapp-phone";
import { prepareInstanceForCampaign } from "./whatsapp/whatsapp-instance.service";

function businessHoursNow() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  return day >= 1 && day <= 5 && hour >= 8 && hour <= 18;
}

function parseCampaignConfig(raw: unknown) {
  const row = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    messagesPerMinute: Math.min(120, Math.max(1, Number(row.messagesPerMinute ?? 15) || 15)),
    onlyBusinessHours: row.onlyBusinessHours === true,
    respectOptOut: row.respectOptOut !== false
  };
}

function extractProviderId(result: unknown) {
  if (!result || typeof result !== "object") return null;
  const record = result as Record<string, unknown>;
  const messages = record.messages;
  if (Array.isArray(messages) && messages[0] && typeof messages[0] === "object") {
    const id = (messages[0] as { id?: unknown }).id;
    if (id != null) return String(id);
  }
  const key = record.key;
  if (key && typeof key === "object" && "id" in key) {
    const id = (key as { id?: unknown }).id;
    if (id != null) return String(id);
  }
  return null;
}

async function isOptedOut(tenantId: string, phone: string) {
  const normalized = normalizeWhatsAppNumber(phone);
  const conversation = await prisma.conversation.findFirst({
    where: { tenantId, customerPhone: normalized },
    select: { tags: true }
  });
  if (!conversation) return false;
  const tags = Array.isArray(conversation.tags) ? conversation.tags : [];
  return tags.some(
    (tag) => typeof tag === "string" && /opt.?out|bloqueado|nao.?perturbe/i.test(tag)
  );
}

async function ensureConversation(
  tenantId: string,
  instanceId: string,
  phone: string,
  name: string | null | undefined
) {
  const normalized = normalizeWhatsAppNumber(phone);
  const existing = await prisma.conversation.findFirst({
    where: { tenantId, instanceId, customerPhone: normalized }
  });
  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      tenantId,
      instanceId,
      customerName: name?.trim() || normalized,
      customerPhone: normalized,
      status: "open",
      priority: "normal",
      tags: ["campaign"],
      lastMessageAt: new Date()
    }
  });
}

async function dispatchRecipient(campaign: {
  id: string;
  tenantId: string;
  instanceId: string;
  messageKind: string;
  message: string | null;
  templateName: string | null;
  templateLanguage: string | null;
  templateBody: unknown;
  config: unknown;
}, recipient: { id: string; phone: string; name: string | null; variables: unknown }) {
  const config = parseCampaignConfig(campaign.config);
  if (config.onlyBusinessHours && !businessHoursNow()) {
    return { skipped: true, reason: "outside_business_hours" as const };
  }
  if (config.respectOptOut && (await isOptedOut(campaign.tenantId, recipient.phone))) {
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { status: "skipped", error: "opt_out" }
    });
    return { skipped: true, reason: "opt_out" as const };
  }

  const { provider, kind, instance, sendName } = await prepareInstanceForCampaign(
    campaign.tenantId,
    campaign.instanceId
  );

  const context = {
    customer_name: recipient.name ?? "",
    phone: recipient.phone,
    ...(recipient.variables && typeof recipient.variables === "object" && !Array.isArray(recipient.variables)
      ? (recipient.variables as Record<string, string>)
      : {})
  };

  const conversation = await ensureConversation(
    campaign.tenantId,
    instance.id,
    recipient.phone,
    recipient.name
  );

  let providerId: string | null = null;

  if (campaign.messageKind === "template" && campaign.templateName) {
    if (typeof provider.sendTemplate === "function") {
      const components = Array.isArray(campaign.templateBody)
        ? (campaign.templateBody as TemplateComponent[])
        : undefined;
      const result = await provider.sendTemplate({
        instanceName: sendName,
        instancePhone: instance.phone ?? undefined,
        number: recipient.phone,
        templateName: campaign.templateName,
        languageCode: campaign.templateLanguage ?? "pt_BR",
        components
      });
      providerId = extractProviderId(result);
    } else if (campaign.message?.trim()) {
      const text = applyMessageTemplate(campaign.message, context).trim();
      const result = await provider.sendText({
        instanceName: sendName,
        instancePhone: instance.phone ?? undefined,
        number: recipient.phone,
        text
      });
      providerId = extractProviderId(result);
    } else {
      throw new Error("Template Meta requer provider meta_cloud ou mensagem fallback.");
    }
  } else {
    const text = applyMessageTemplate(campaign.message ?? "", context).trim();
    if (!text) throw new Error("Mensagem vazia.");
    const result = await provider.sendText({
      instanceName: sendName,
      instancePhone: instance.phone ?? undefined,
      number: recipient.phone,
      text
    });
    providerId = extractProviderId(result);
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "out",
      type: "text",
      text: campaign.message,
      providerId,
      status: "sent",
      raw: { source: "campaign", campaignId: campaign.id, providerKind: kind }
    }
  });

  await prisma.campaignRecipient.update({
    where: { id: recipient.id },
    data: {
      status: "sent",
      providerId,
      conversationId: conversation.id,
      messageId: message.id,
      sentAt: new Date(),
      error: null
    }
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() }
  });

  return { sent: true as const };
}

async function finalizeCampaignIfDone(campaignId: string) {
  const pending = await prisma.campaignRecipient.count({
    where: { campaignId, status: { in: ["pending", "sending"] } }
  });
  if (pending > 0) return;
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "completed", completedAt: new Date() }
  });
}

export async function processCampaignDispatchBatch(maxRecipients = 10) {
  const now = new Date();

  await prisma.campaign.updateMany({
    where: {
      status: "scheduled",
      scheduledAt: { lte: now }
    },
    data: { status: "running", startedAt: now }
  });

  const campaigns = await prisma.campaign.findMany({
    where: { status: "running" },
    take: 3,
    orderBy: { startedAt: "asc" }
  });

  let processed = 0;

  for (const campaign of campaigns) {
    const config = parseCampaignConfig(campaign.config);
    const batchSize = Math.min(maxRecipients, config.messagesPerMinute);

    if (config.onlyBusinessHours && !businessHoursNow()) continue;

    const recipients = await prisma.campaignRecipient.findMany({
      where: { campaignId: campaign.id, status: { in: ["pending", "failed"] } },
      take: batchSize,
      orderBy: { createdAt: "asc" }
    });

    for (const recipient of recipients) {
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "sending" }
      });

      try {
        const result = await dispatchRecipient(campaign, recipient);
        if (!result.skipped) processed += 1;
      } catch (error) {
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "failed",
            error: error instanceof Error ? error.message : "Falha ao enviar"
          }
        });
      }
    }

    await finalizeCampaignIfDone(campaign.id);
  }

  return { processed, campaigns: campaigns.length };
}
