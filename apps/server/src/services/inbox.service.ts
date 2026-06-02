import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { normalizeInboxUpload } from "../lib/media-upload";
import { appLog } from "../lib/app-log";
import { env } from "../config/env";
import { emitToTenant } from "../lib/realtime";
import { prepareOutboundInstance } from "./whatsapp/whatsapp-instance.service";
import {
  emitIntegrationEvent,
  publicConversationPayload,
  publicMessagePayload
} from "./integrations/integration-events.service";
import { assertWithinConversationQuota } from "./billing/billing.service";
import { applyOutgoingSignature, getMessagingSettings } from "./messaging/message-signature.service";
import { MENU_DONE_TAG, MENU_PENDING_TAG } from "./menu-bot.service";
import { assertTeamInTenant, assertUserInTenant } from "../lib/tenant-guard";
import { recordConversationTransfer } from "./inbox-collaboration.service";
import { runConversationAutomations } from "./automation.service";
import { auditLog } from "./audit.service";

type MessageActor = { id: string; name: string; role: string };

function conversationTagsWithMenuDone(tags: unknown, actor?: MessageActor) {
  if (!actor || actor.id === "menu-bot" || actor.role === "system") return undefined;
  const current = Array.isArray(tags) ? tags.filter((item): item is string => typeof item === "string") : [];
  if (current.includes(MENU_DONE_TAG)) return undefined;
  const set = new Set(current);
  set.add(MENU_DONE_TAG);
  set.delete(MENU_PENDING_TAG);
  return Array.from(set);
}

function extractProviderId(result: unknown) {
  if (!result || typeof result !== "object") return null;
  const record = result as Record<string, unknown>;
  const key = record.key;
  if (key && typeof key === "object" && "id" in key) {
    const id = (key as { id?: unknown }).id;
    if (id != null) return String(id);
  }
  const message = record.message;
  if (message && typeof message === "object" && "key" in message) {
    const messageKey = (message as { key?: { id?: unknown } }).key;
    if (messageKey?.id != null) return String(messageKey.id);
  }
  return null;
}

function whatsappJid(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

function normalizeWhatsAppNumber(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

function phoneCandidates(raw: string) {
  const normalized = normalizeWhatsAppNumber(raw);
  const set = new Set<string>();
  if (!normalized) return [];
  set.add(normalized);

  const withNoCountry = normalized.startsWith("55") ? normalized.slice(2) : normalized;
  if (withNoCountry) {
    set.add(withNoCountry);
    set.add(`55${withNoCountry}`);
  }

  // BR: support with/without extra 9 to avoid duplicate threads.
  if (withNoCountry.length === 10) {
    const withNine = `${withNoCountry.slice(0, 2)}9${withNoCountry.slice(2)}`;
    set.add(withNine);
    set.add(`55${withNine}`);
  }
  if (withNoCountry.length === 11 && withNoCountry[2] === "9") {
    const withoutNine = `${withNoCountry.slice(0, 2)}${withNoCountry.slice(3)}`;
    set.add(withoutNine);
    set.add(`55${withoutNine}`);
  }

  return Array.from(set).filter(Boolean);
}

function outboundNumberCandidates(raw: string) {
  const normalized = normalizeWhatsAppNumber(raw);
  const candidates = phoneCandidates(raw);
  if (!candidates.includes(normalized)) candidates.unshift(normalized);
  return Array.from(new Set(candidates)).filter(Boolean);
}

async function resolveSendInstance(tenantId: string, conversationInstanceId: string) {
  const current = await prisma.whatsAppInstance.findFirst({
    where: { tenantId, id: conversationInstanceId }
  });
  if (!current) return null;
  const currentStatus = String(current.status ?? "").toLowerCase();
  if (currentStatus === "open" || currentStatus === "connected") return current;

  const fallback = await prisma.whatsAppInstance.findFirst({
    where: {
      tenantId,
      status: { in: ["open", "connected", "OPEN", "CONNECTED"] }
    },
    orderBy: [{ updatedAt: "desc" }]
  });
  return fallback ?? current;
}

export const createConversationSchema = z.object({
  instanceName: z.string().default(env.defaultInstance),
  customerName: z.string().min(1),
  customerPhone: z.string().min(10),
  avatarUrl: z.string().url().optional(),
  assignedToId: z.string().optional(),
  priority: z.string().default("normal"),
  tags: z.array(z.string()).default([])
});

export const sendMessageSchema = z.object({
  text: z.string().min(1).max(4096).optional(),
  replyToMessageId: z.string().optional(),
  mediatype: z.enum(["image", "video", "audio", "document"]).optional(),
  mimetype: z.string().optional(),
  media: z.string().optional(),
  caption: z.string().optional(),
  fileName: z.string().optional()
});

const ACTIVE_CONVERSATION_STATUSES = ["open", "waiting_customer", "waiting_internal"];
const HISTORY_CONVERSATION_STATUSES = ["resolved", "closed", "archived"];

export async function listConversations(
  tenantId: string,
  scope?: { assignedToId?: string; bucket?: "active" | "history" | "all" }
) {
  let statusFilter: { status?: { in: string[] } } = {};
  if (scope?.bucket === "active") statusFilter = { status: { in: ACTIVE_CONVERSATION_STATUSES } };
  else if (scope?.bucket === "history") statusFilter = { status: { in: HISTORY_CONVERSATION_STATUSES } };

  return prisma.conversation.findMany({
    where: {
      tenantId,
      ...statusFilter,
      ...(scope?.assignedToId ? { assignedToId: scope.assignedToId } : {})
    },
    include: {
      assignedTo: { select: { id: true, name: true, role: true } },
      team: { select: { id: true, name: true } },
      instance: { select: { id: true, name: true, label: true, status: true } },
      lead: { select: { id: true, company: true, status: true, value: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 }
    },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }]
  });
}

export async function getConversation(tenantId: string, id: string, scope?: { assignedToId?: string }) {
  return prisma.conversation.findFirst({
    where: {
      tenantId,
      id,
      ...(scope?.assignedToId ? { assignedToId: scope.assignedToId } : {})
    },
    include: {
      assignedTo: { select: { id: true, name: true, role: true } },
      team: { select: { id: true, name: true } },
      instance: true,
      lead: true,
      messages: { orderBy: { createdAt: "asc" } }
    }
  });
}

export async function createConversation(
  tenantId: string,
  input: unknown,
  actor?: { id: string; role?: string; teamId?: string | null }
) {
  const data = createConversationSchema.parse(input);
  let instance = await prisma.whatsAppInstance.findFirst({
    where: { tenantId, name: data.instanceName }
  });
  if (!instance) {
    instance = await prisma.whatsAppInstance.findFirst({
      where: { tenantId },
      orderBy: [{ updatedAt: "desc" }]
    });
  }
  if (!instance) throw new Error("Nenhum numero WhatsApp configurado. Cadastre um numero no painel Admin.");
  const normalizedPhone = normalizeWhatsAppNumber(data.customerPhone);
  const candidates = phoneCandidates(data.customerPhone);

  const existing = await prisma.conversation.findFirst({
    where: {
      tenantId,
      instanceId: instance.id,
      customerPhone: { in: candidates.length ? candidates : [normalizedPhone] }
    }
  });
  if (existing) return existing;

  await assertWithinConversationQuota(tenantId);

  const tags = [...data.tags];
  if (data.avatarUrl) {
    tags.push(`avatar:${data.avatarUrl}`);
  }

  return prisma.conversation.create({
    data: {
      tenantId,
      instanceId: instance.id,
      assignedToId: data.assignedToId ?? actor?.id ?? null,
      teamId: data.assignedToId ? undefined : actor?.teamId ?? null,
      customerName: data.customerName,
      customerPhone: normalizedPhone,
      priority: data.priority,
      tags,
      status: "open",
      lastMessageAt: new Date()
    }
  }).then((created) => {
    emitIntegrationEvent(tenantId, "conversation.created", publicConversationPayload(created));
    return created;
  });
}

export async function archiveConversation(tenantId: string, id: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { tenantId, id },
    select: { id: true }
  });
  if (!conversation) throw new Error("Conversa nao encontrada");

  return prisma.conversation.update({
    where: { id },
    data: {
      status: "archived",
      assignedToId: null
    }
  });
}

/** Permanent archive — conversations are never hard-deleted. */
export async function deleteConversation(tenantId: string, id: string) {
  return archiveConversation(tenantId, id);
}

function normalizeTagList(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function mergeTagList(existing: unknown, addTags: string[]) {
  const base = normalizeTagList(existing);
  const seen = new Set(base.map((tag) => tag.toLowerCase()));
  for (const tag of addTags) {
    const trimmed = tag.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    base.push(trimmed);
  }
  return base;
}

type BulkActor = { id: string; name: string; role: string; permissions: string[] };

function canManageConversation(actor: BulkActor, assignedToId: string | null) {
  if (actor.role === "owner" || actor.role === "admin" || actor.role === "supervisor") return true;
  if (actor.permissions.includes("*") || actor.permissions.includes("conversation:takeover")) return true;
  return assignedToId === actor.id;
}

export async function bulkUpdateConversations(
  tenantId: string,
  actor: BulkActor,
  input: {
    ids: string[];
    assignedToId?: string | null;
    teamId?: string | null;
    status?: string;
    addTags?: string[];
    archive?: boolean;
    transferNote?: string;
  }
) {
  const ids = [...new Set(input.ids.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) throw new Error("Selecione ao menos uma conversa.");
  if (ids.length > 100) throw new Error("Selecione no maximo 100 conversas por vez.");

  if (input.assignedToId !== undefined) await assertUserInTenant(tenantId, input.assignedToId ?? undefined);
  if (input.teamId !== undefined) await assertTeamInTenant(tenantId, input.teamId ?? undefined);

  const conversations = await prisma.conversation.findMany({
    where: { tenantId, id: { in: ids } },
    select: {
      id: true,
      assignedToId: true,
      teamId: true,
      status: true,
      tags: true
    }
  });

  if (conversations.length !== ids.length) throw new Error("Uma ou mais conversas nao foram encontradas.");

  for (const conversation of conversations) {
    if (!canManageConversation(actor, conversation.assignedToId)) {
      throw new Error("Voce nao tem permissao para alterar uma ou mais conversas selecionadas.");
    }
  }

  const updatedIds: string[] = [];
  for (const conversation of conversations) {
    const data: {
      assignedToId?: string | null;
      teamId?: string | null;
      status?: string;
      tags?: string[];
    } = {};

    if (input.archive) {
      data.status = "archived";
      data.assignedToId = null;
    } else {
      if (input.assignedToId !== undefined) data.assignedToId = input.assignedToId;
      if (input.teamId !== undefined) data.teamId = input.teamId;
      if (input.status) data.status = input.status;
      if (input.addTags?.length) data.tags = mergeTagList(conversation.tags, input.addTags);
    }

    if (!Object.keys(data).length) continue;

    await prisma.conversation.update({
      where: { id: conversation.id },
      data
    });

    if (input.assignedToId !== undefined && input.assignedToId !== conversation.assignedToId) {
      await recordConversationTransfer({
        tenantId,
        actorId: actor.id,
        conversationId: conversation.id,
        fromUserId: conversation.assignedToId,
        toUserId: input.assignedToId ?? null,
        teamId: input.teamId ?? conversation.teamId ?? null,
        note: input.transferNote
      });
    }

    if (conversation.assignedToId && input.assignedToId === null) {
      await runConversationAutomations(tenantId, conversation.id, "conversation.unassigned");
    }

    updatedIds.push(conversation.id);
  }

  await auditLog({
    tenantId,
    actorId: actor.id,
    entity: "Conversation",
    entityId: updatedIds.join(","),
    action: "bulk_updated",
    metadata: {
      count: updatedIds.length,
      archive: Boolean(input.archive),
      status: input.status ?? null,
      assignedToId: input.assignedToId ?? null,
      teamId: input.teamId ?? null,
      addTags: input.addTags ?? null
    }
  });

  return { updated: updatedIds.length, ids: updatedIds };
}

export async function sendMessage(tenantId: string, conversationId: string, input: unknown, actor?: MessageActor) {
  const payload = sendMessageSchema.parse(input);
  const conversation = await prisma.conversation.findFirst({
    where: { tenantId, id: conversationId },
    include: { instance: true }
  });
  if (!conversation) throw new Error("Conversa nao encontrada");

  const sendingInstance = await resolveSendInstance(tenantId, conversation.instanceId);
  if (!sendingInstance) throw new Error("Instancia WhatsApp nao encontrada para envio");

  const outbound = await prepareOutboundInstance(tenantId, conversationId, sendingInstance);
  const { provider, instance: evolutionInstance, sendName: evolutionName } = outbound;

  let result: unknown;
  let type = "text";
  let text: string | null = payload.text ?? null;
  let mediaUrl: string | undefined;
  const numberOptions = outboundNumberCandidates(conversation.customerPhone);
  let lastSendError: unknown = null;
  const attemptedNumbers: string[] = [];
  let replyTo: Prisma.InputJsonValue | null = null;
  let quotedForSend: { providerId: string; remoteJid: string; fromMe: boolean } | undefined;

  if (payload.replyToMessageId) {
    const quoted = await prisma.message.findFirst({
      where: {
        conversationId: conversation.id,
        id: payload.replyToMessageId
      }
    });
    if (quoted) {
      replyTo = {
        id: quoted.id,
        type: quoted.type,
        text: quoted.text ?? `[${quoted.type}]`,
        direction: quoted.direction
      } as Prisma.InputJsonValue;
      if (quoted.providerId) {
        quotedForSend = {
          providerId: quoted.providerId,
          remoteJid: whatsappJid(conversation.customerPhone),
          fromMe: quoted.direction === "out"
        };
      }
    }
  }

  let mediaBase64Raw: string | undefined;

  if (payload.mediatype && payload.media && payload.mimetype) {
    type = payload.mediatype;
    text = payload.caption?.trim() || null;
    mediaBase64Raw = payload.media.replace(/^data:[^;]+;base64,/, "");
    for (const number of numberOptions) {
      try {
        attemptedNumbers.push(number);
        result = await provider.sendMedia({
          instanceName: evolutionName,
          instancePhone: evolutionInstance.phone ?? undefined,
          number,
          mediatype: payload.mediatype,
          mimetype: payload.mimetype,
          media: mediaBase64Raw,
          caption: payload.caption,
          fileName: payload.fileName
        });
        lastSendError = null;
        break;
      } catch (error) {
        lastSendError = error;
      }
    }
    if (lastSendError) throw lastSendError;
    if (!result) throw new Error("Nao foi possivel enviar midia para este numero");
  } else if (payload.text != null && payload.text.length > 0) {
    const contentRaw = payload.text;
    const messagingSettings = await getMessagingSettings(tenantId);
    const actorInfo = actor ?? { id: "system", name: "Sistema", role: "system" };
    const { providerText, signatureApplied, signatureLine } = applyOutgoingSignature(contentRaw, actorInfo, messagingSettings);

    for (const number of numberOptions) {
      try {
        attemptedNumbers.push(number);
        result = await provider.sendText({
          instanceName: evolutionName,
          instancePhone: evolutionInstance.phone ?? undefined,
          number,
          text: providerText,
          quoted: quotedForSend
        });
        lastSendError = null;
        break;
      } catch (error) {
        lastSendError = error;
      }
    }
    if (lastSendError) {
      const base = lastSendError instanceof Error ? lastSendError.message : String(lastSendError);
      throw new Error(
        `Falha no envio via ${evolutionName}. Numeros testados: ${attemptedNumbers.join(", ")}. Detalhe: ${base}`
      );
    }
    if (!result) throw new Error("Nao foi possivel enviar mensagem para este numero");
    text = contentRaw;
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "out",
        type,
        text,
        mediaUrl,
        providerId: extractProviderId(result),
        status: "sent",
        raw: {
          provider: (result ?? null) as Prisma.InputJsonValue,
          contentRaw,
          providerText,
          signatureApplied: signatureApplied ?? false,
          signatureLine: signatureLine ?? null,
          sentById: actor?.id ?? null,
          sentByName: actor?.name ?? null,
          sentByRole: actor?.role ?? null,
          senderType: actor?.id === "menu-bot" ? "bot" : "agent",
          deliveryStatus: "sent",
          remoteJid: whatsappJid(conversation.customerPhone),
          recipientName: conversation.customerName,
          recipientPhone: conversation.customerPhone,
          replyTo
        }
      }
    });

    const nextTags = conversationTagsWithMenuDone(conversation.tags, actor);
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: "waiting_customer",
        lastMessageAt: new Date(),
        ...(nextTags ? { tags: nextTags } : {})
      },
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        team: { select: { id: true, name: true } },
        instance: { select: { id: true, name: true, label: true, status: true } },
        lead: { select: { id: true, company: true, status: true, value: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });

    emitToTenant(tenantId, "inbox:message", {
      conversation: updatedConversation,
      message
    });

    emitIntegrationEvent(tenantId, "message.created", publicMessagePayload(message));

    return message;
  } else {
    throw new Error("Informe texto ou midia");
  }

  const providerId = extractProviderId(result);

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "out",
      type,
      text,
      mediaUrl,
      providerId,
      status: "sent",
      raw: {
        provider: (result ?? null) as Prisma.InputJsonValue,
        sentById: actor?.id ?? null,
        sentByName: actor?.name ?? null,
        sentByRole: actor?.role ?? null,
        deliveryStatus: "sent",
        remoteJid: whatsappJid(conversation.customerPhone),
        recipientName: conversation.customerName,
        recipientPhone: conversation.customerPhone,
        replyTo
      }
    }
  });

  if (mediaBase64Raw) {
    const { saveMediaBase64 } = await import("../lib/media-storage");
    mediaUrl = await saveMediaBase64(tenantId, message.id, mediaBase64Raw, payload.mimetype);
    await prisma.message.update({ where: { id: message.id }, data: { mediaUrl } });
    message.mediaUrl = mediaUrl;
  }

  const nextTags = conversationTagsWithMenuDone(conversation.tags, actor);
  const updatedConversation = await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      status: "waiting_customer",
      lastMessageAt: new Date(),
      ...(nextTags ? { tags: nextTags } : {})
    },
    include: {
      assignedTo: { select: { id: true, name: true, role: true } },
      team: { select: { id: true, name: true } },
      instance: { select: { id: true, name: true, label: true, status: true } },
      lead: { select: { id: true, company: true, status: true, value: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });

  emitToTenant(tenantId, "inbox:message", {
    conversation: updatedConversation,
    message
  });

  emitIntegrationEvent(tenantId, "message.created", publicMessagePayload(message));

  return message;
}

export async function sendMediaMessage(
  tenantId: string,
  conversationId: string,
  file: { buffer: Buffer; mimetype: string; filename?: string },
  caption?: string,
  actor?: MessageActor
) {
  const normalized = normalizeInboxUpload(file);

  const conversation = await prisma.conversation.findFirst({
    where: { tenantId, id: conversationId },
    include: { instance: true }
  });
  if (!conversation) throw new Error("Conversa nao encontrada");

  const sendingInstance = await resolveSendInstance(tenantId, conversation.instanceId);
  if (!sendingInstance) throw new Error("Instancia WhatsApp nao encontrada para envio");

  const outbound = await prepareOutboundInstance(tenantId, conversationId, sendingInstance);
  const { provider, instance: evolutionInstance, sendName: evolutionName } = outbound;

  const { mediatype, mimetype, filename, buffer, sizeBytes } = normalized;
  const base64 = buffer.toString("base64");
  const numberOptions = outboundNumberCandidates(conversation.customerPhone);
  let result: unknown;
  let lastSendError: unknown = null;
  const attemptedNumbers: string[] = [];
  for (const number of numberOptions) {
    try {
      attemptedNumbers.push(number);
      result = await provider.sendMedia({
        instanceName: evolutionName,
        instancePhone: evolutionInstance.phone ?? undefined,
        number,
        mediatype,
        mimetype,
        media: base64,
        caption,
        fileName: filename
      });
      lastSendError = null;
      break;
    } catch (error) {
      lastSendError = error;
    }
  }
  if (lastSendError) {
    const base = lastSendError instanceof Error ? lastSendError.message : String(lastSendError);
    appLog.error("inbox_media_send_failed", {
      tenantId,
      conversationId,
      mimetype,
      filename,
      mediatype,
      sizeBytes,
      attemptedNumbers,
      error: base
    });
    throw new Error(
      `Falha no envio de midia via ${evolutionName}. Numeros testados: ${attemptedNumbers.join(", ")}. Detalhe: ${base}`
    );
  }
  if (!result) throw new Error("Nao foi possivel enviar midia para este numero");

  const providerId = extractProviderId(result);

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "out",
      type: mediatype,
      text: caption?.trim() || null,
      providerId,
      status: "sent",
      raw: {
        provider: (result ?? null) as Prisma.InputJsonValue,
        sentById: actor?.id ?? null,
        sentByName: actor?.name ?? null,
        sentByRole: actor?.role ?? null,
        deliveryStatus: "sent",
        remoteJid: whatsappJid(conversation.customerPhone),
        recipientName: conversation.customerName,
        recipientPhone: conversation.customerPhone,
        fileName: filename,
        mimeType: mimetype
      }
    }
  });

  const { saveMediaBase64 } = await import("../lib/media-storage");
  const mediaUrl = await saveMediaBase64(tenantId, message.id, base64, mimetype);
  const stored = await prisma.message.update({
    where: { id: message.id },
    data: { mediaUrl }
  });

  const nextTags = conversationTagsWithMenuDone(conversation.tags, actor);
  const updatedConversation = await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      status: "waiting_customer",
      lastMessageAt: new Date(),
      ...(nextTags ? { tags: nextTags } : {})
    },
    include: {
      assignedTo: { select: { id: true, name: true, role: true } },
      team: { select: { id: true, name: true } },
      instance: { select: { id: true, name: true, label: true, status: true } },
      lead: { select: { id: true, company: true, status: true, value: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });

  emitToTenant(tenantId, "inbox:message", { conversation: updatedConversation, message: stored });
  emitIntegrationEvent(tenantId, "message.created", publicMessagePayload(stored));
  return stored;
}

