import { z } from "zod";
import { Prisma } from "@prisma/client";
import type { Message } from "@prisma/client";
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
  clientMessageId: z.string().min(8).max(64).optional(),
  mediatype: z.enum(["image", "video", "audio", "document"]).optional(),
  mimetype: z.string().optional(),
  media: z.string().optional(),
  caption: z.string().optional(),
  fileName: z.string().optional()
});

const OUTBOUND_SUCCESS_STATUSES = new Set(["sent", "delivered", "read"]);
const PENDING_RESUME_MS = 120_000;

const conversationEmitInclude = {
  assignedTo: { select: { id: true, name: true, role: true } },
  team: { select: { id: true, name: true } },
  instance: { select: { id: true, name: true, label: true, status: true } },
  lead: { select: { id: true, company: true, status: true, value: true } },
  messages: { orderBy: { createdAt: "desc" as const }, take: 1 }
};

function messageRawRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? ({ ...(raw as Record<string, unknown>) } as Record<string, unknown>) : {};
}

function outboundActorRaw(actor?: MessageActor) {
  return {
    sentById: actor?.id ?? null,
    sentByName: actor?.name ?? null,
    sentByRole: actor?.role ?? null,
    senderType: actor?.id === "menu-bot" ? "bot" : "agent"
  };
}

async function findOutboundByClientMessageId(conversationId: string, clientMessageId: string) {
  return prisma.message.findFirst({ where: { conversationId, clientMessageId } });
}

function isClientMessageIdConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function createOutboundPendingMessage(
  conversationId: string,
  clientMessageId: string | undefined,
  data: Parameters<typeof prisma.message.create>[0]["data"]
): Promise<{ message: Message; created: boolean }> {
  try {
    const message = await prisma.message.create({ data });
    return { message, created: true };
  } catch (error) {
    if (clientMessageId && isClientMessageIdConflict(error)) {
      const existing = await findOutboundByClientMessageId(conversationId, clientMessageId);
      if (existing) return { message: existing, created: false };
    }
    throw error;
  }
}

async function resolveIdempotentOutbound(conversationId: string, clientMessageId?: string) {
  if (!clientMessageId) return { action: "create" as const };
  const existing = await findOutboundByClientMessageId(conversationId, clientMessageId);
  if (!existing) return { action: "create" as const };
  const status = existing.status.toLowerCase();
  if (OUTBOUND_SUCCESS_STATUSES.has(status)) return { action: "return" as const, message: existing };
  if (status === "failed") return { action: "resume" as const, message: existing };
  if (status === "pending") {
    const age = Date.now() - existing.createdAt.getTime();
    if (age < PENDING_RESUME_MS) return { action: "return" as const, message: existing };
    return { action: "resume" as const, message: existing };
  }
  return { action: "return" as const, message: existing };
}

async function resetMessageToPending(messageId: string, raw: Record<string, unknown>) {
  return prisma.message.update({
    where: { id: messageId },
    data: {
      status: "pending",
      raw: {
        ...raw,
        deliveryStatus: "pending",
        failureReason: null
      } as Prisma.InputJsonValue
    }
  });
}

async function markMessageFailed(messageId: string, raw: Record<string, unknown>, reason: string) {
  return prisma.message.update({
    where: { id: messageId },
    data: {
      status: "failed",
      raw: {
        ...raw,
        deliveryStatus: "failed",
        failureReason: reason.slice(0, 500)
      } as Prisma.InputJsonValue
    }
  });
}

async function markMessageSent(
  messageId: string,
  providerId: string | null,
  raw: Record<string, unknown>,
  providerResult: unknown
) {
  return prisma.message.update({
    where: { id: messageId },
    data: {
      status: "sent",
      providerId,
      raw: {
        ...raw,
        deliveryStatus: "sent",
        failureReason: null,
        provider: (providerResult ?? null) as Prisma.InputJsonValue
      } as Prisma.InputJsonValue
    }
  });
}

async function emitOutboundMessage(
  tenantId: string,
  conversation: { id: string; tags: unknown },
  message: { id: string; status: string; direction: string; type: string; text: string | null; mediaUrl: string | null; providerId: string | null; raw: unknown; createdAt: Date; conversationId: string; clientMessageId?: string | null },
  actor?: MessageActor
) {
  const nextTags = conversationTagsWithMenuDone(conversation.tags, actor);
  const updatedConversation = await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      status: "waiting_customer",
      lastMessageAt: new Date(),
      ...(nextTags ? { tags: nextTags } : {})
    },
    include: conversationEmitInclude
  });
  emitToTenant(tenantId, "inbox:message", { conversation: updatedConversation, message });
  if (message.status === "sent") {
    emitIntegrationEvent(tenantId, "message.created", publicMessagePayload(message));
  }
  return message;
}

async function resolveReplyContext(conversationId: string, customerPhone: string, replyToMessageId?: string) {
  let replyTo: Prisma.InputJsonValue | null = null;
  let quotedForSend: { providerId: string; remoteJid: string; fromMe: boolean } | undefined;
  if (!replyToMessageId) return { replyTo, quotedForSend };

  const quoted = await prisma.message.findFirst({
    where: { conversationId, id: replyToMessageId }
  });
  if (!quoted) return { replyTo, quotedForSend };

  replyTo = {
    id: quoted.id,
    type: quoted.type,
    text: quoted.text ?? `[${quoted.type}]`,
    direction: quoted.direction
  } as Prisma.InputJsonValue;
  if (quoted.providerId) {
    quotedForSend = {
      providerId: quoted.providerId,
      remoteJid: whatsappJid(customerPhone),
      fromMe: quoted.direction === "out"
    };
  }
  return { replyTo, quotedForSend };
}

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

  const numberOptions = outboundNumberCandidates(conversation.customerPhone);
  const { replyTo, quotedForSend } = await resolveReplyContext(
    conversation.id,
    conversation.customerPhone,
    payload.replyToMessageId
  );

  const idem = await resolveIdempotentOutbound(conversation.id, payload.clientMessageId);
  if (idem.action === "return") return idem.message;

  const baseRaw = {
    ...outboundActorRaw(actor),
    deliveryStatus: "pending",
    remoteJid: whatsappJid(conversation.customerPhone),
    recipientName: conversation.customerName,
    recipientPhone: conversation.customerPhone,
    replyTo,
    ...(payload.clientMessageId ? { clientMessageId: payload.clientMessageId } : {})
  };

  if (payload.mediatype && payload.media && payload.mimetype) {
    const mediaBase64Raw = payload.media.replace(/^data:[^;]+;base64,/, "");
    let pending: Message;
    let created = true;
    if (idem.action === "resume") {
      pending = await resetMessageToPending(idem.message.id, messageRawRecord(idem.message.raw));
    } else {
      const createdRow = await createOutboundPendingMessage(conversation.id, payload.clientMessageId, {
        conversationId: conversation.id,
        clientMessageId: payload.clientMessageId ?? null,
        direction: "out",
        type: payload.mediatype,
        text: payload.caption?.trim() || null,
        status: "pending",
        raw: baseRaw as Prisma.InputJsonValue
      });
      pending = createdRow.message;
      created = createdRow.created;
    }
    if (!created) return pending;

    await emitOutboundMessage(tenantId, conversation, pending, actor);

    const attemptedNumbers: string[] = [];
    let lastSendError: unknown = null;
    let result: unknown = null;
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

    const pendingRaw = messageRawRecord(pending.raw);
    if (lastSendError || !result) {
      const base = lastSendError instanceof Error ? lastSendError.message : "Nao foi possivel enviar midia para este numero";
      const failed = await markMessageFailed(pending.id, pendingRaw, base);
      await emitOutboundMessage(tenantId, conversation, failed, actor);
      return failed;
    }

    let sent = await markMessageSent(pending.id, extractProviderId(result), pendingRaw, result);
    const { saveMediaBase64 } = await import("../lib/media-storage");
    const mediaUrl = await saveMediaBase64(tenantId, sent.id, mediaBase64Raw, payload.mimetype);
    sent = await prisma.message.update({ where: { id: sent.id }, data: { mediaUrl } });
    await emitOutboundMessage(tenantId, conversation, sent, actor);
    return sent;
  }

  if (payload.text != null && payload.text.length > 0) {
    const contentRaw = payload.text;
    const messagingSettings = await getMessagingSettings(tenantId);
    const actorInfo = actor ?? { id: "system", name: "Sistema", role: "system" };
    const { providerText, signatureApplied, signatureLine } = applyOutgoingSignature(
      contentRaw,
      actorInfo,
      messagingSettings
    );

    let pending: Message;
    let created = true;
    if (idem.action === "resume") {
      pending = await resetMessageToPending(idem.message.id, messageRawRecord(idem.message.raw));
    } else {
      const createdRow = await createOutboundPendingMessage(conversation.id, payload.clientMessageId, {
        conversationId: conversation.id,
        clientMessageId: payload.clientMessageId ?? null,
        direction: "out",
        type: "text",
        text: contentRaw,
        status: "pending",
        raw: {
          ...baseRaw,
          contentRaw,
          providerText,
          signatureApplied: signatureApplied ?? false,
          signatureLine: signatureLine ?? null
        } as Prisma.InputJsonValue
      });
      pending = createdRow.message;
      created = createdRow.created;
    }
    if (!created) return pending;

    await emitOutboundMessage(tenantId, conversation, pending, actor);

    const attemptedNumbers: string[] = [];
    let lastSendError: unknown = null;
    let result: unknown = null;
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

    const pendingRaw = messageRawRecord(pending.raw);
    if (lastSendError || !result) {
      const base = lastSendError instanceof Error ? lastSendError.message : String(lastSendError ?? "Erro desconhecido");
      const reason = `Falha no envio via ${evolutionName}. Numeros testados: ${attemptedNumbers.join(", ")}. Detalhe: ${base}`;
      const failed = await markMessageFailed(pending.id, pendingRaw, reason);
      await emitOutboundMessage(tenantId, conversation, failed, actor);
      return failed;
    }

    const sent = await markMessageSent(pending.id, extractProviderId(result), pendingRaw, result);
    await emitOutboundMessage(tenantId, conversation, sent, actor);
    return sent;
  }

  throw new Error("Informe texto ou midia");
}

export async function sendMediaMessage(
  tenantId: string,
  conversationId: string,
  file: { buffer: Buffer; mimetype: string; filename?: string },
  caption?: string,
  actor?: MessageActor,
  options?: { clientMessageId?: string }
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
  const clientMessageId = options?.clientMessageId;

  const idem = await resolveIdempotentOutbound(conversation.id, clientMessageId);
  if (idem.action === "return") return idem.message;

  const baseRaw = {
    ...outboundActorRaw(actor),
    deliveryStatus: "pending",
    remoteJid: whatsappJid(conversation.customerPhone),
    recipientName: conversation.customerName,
    recipientPhone: conversation.customerPhone,
    fileName: filename,
    mimeType: mimetype,
    ...(clientMessageId ? { clientMessageId } : {})
  };

  let pending: Message;
  let created = true;
  if (idem.action === "resume") {
    pending = await resetMessageToPending(idem.message.id, messageRawRecord(idem.message.raw));
  } else {
    const createdRow = await createOutboundPendingMessage(conversation.id, clientMessageId, {
      conversationId: conversation.id,
      clientMessageId: clientMessageId ?? null,
      direction: "out",
      type: mediatype,
      text: caption?.trim() || null,
      status: "pending",
      raw: baseRaw as Prisma.InputJsonValue
    });
    pending = createdRow.message;
    created = createdRow.created;
  }
  if (!created) return pending;

  await emitOutboundMessage(tenantId, conversation, pending, actor);

  const attemptedNumbers: string[] = [];
  let lastSendError: unknown = null;
  let result: unknown = null;
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

  const pendingRaw = messageRawRecord(pending.raw);
  if (lastSendError || !result) {
    const base = lastSendError instanceof Error ? lastSendError.message : String(lastSendError ?? "Erro desconhecido");
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
    const reason = `Falha no envio de midia via ${evolutionName}. Numeros testados: ${attemptedNumbers.join(", ")}. Detalhe: ${base}`;
    const failed = await markMessageFailed(pending.id, pendingRaw, reason);
    await emitOutboundMessage(tenantId, conversation, failed, actor);
    return failed;
  }

  let sent = await markMessageSent(pending.id, extractProviderId(result), pendingRaw, result);
  const { saveMediaBase64 } = await import("../lib/media-storage");
  const mediaUrl = await saveMediaBase64(tenantId, sent.id, base64, mimetype);
  sent = await prisma.message.update({ where: { id: sent.id }, data: { mediaUrl } });
  await emitOutboundMessage(tenantId, conversation, sent, actor);
  return sent;
}

