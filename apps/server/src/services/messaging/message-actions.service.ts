import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { emitToTenant } from "../../lib/realtime";
import { syncEditMessageToProvider } from "./message-provider-sync.service";

type MessageActor = { id: string; name: string; role: string };

function rawObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

export function canHideMessages(actor: MessageActor) {
  return actor.role === "owner" || actor.role === "admin" || actor.role === "supervisor";
}

export function canViewHiddenMessages(actor: MessageActor) {
  return canHideMessages(actor);
}

function canEditMessage(actor: MessageActor, messageRaw: Record<string, unknown>) {
  if (actor.role === "owner" || actor.role === "admin" || actor.role === "supervisor") return true;
  const sentById = typeof messageRaw.sentById === "string" ? messageRaw.sentById : null;
  return sentById === actor.id;
}

async function loadMessage(tenantId: string, conversationId: string, messageId: string) {
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      conversationId,
      conversation: { tenantId }
    },
    include: {
      conversation: {
        include: {
          assignedTo: { select: { id: true, name: true, role: true } },
          team: { select: { id: true, name: true } },
          instance: { select: { id: true, name: true, label: true, status: true } },
          lead: { select: { id: true, company: true, status: true, value: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 }
        }
      }
    }
  });
  if (!message) throw new Error("Mensagem nao encontrada.");
  const raw = rawObject(message.raw);
  if (raw.hiddenAt) throw new Error("Mensagem ja foi ocultada.");
  return { message, raw };
}

export function sanitizeMessageForActor<T extends { text?: string | null; status?: string; raw?: unknown }>(
  message: T,
  actor: MessageActor
): T {
  const raw = rawObject(message.raw);
  if (!raw.hiddenAt) return message;
  if (canViewHiddenMessages(actor)) {
    const originalContent = typeof raw.originalContent === "string" ? raw.originalContent : message.text;
    return {
      ...message,
      text: originalContent ?? message.text,
      raw: {
        ...raw,
        hiddenVisibleToSupervisor: true
      }
    } as T;
  }
  return {
    ...message,
    text: "[Mensagem oculta]",
    status: "hidden"
  } as T;
}

export async function hideMessage(
  tenantId: string,
  conversationId: string,
  messageId: string,
  actor: MessageActor,
  reason?: string
) {
  if (!canHideMessages(actor)) throw new Error("Voce nao pode ocultar mensagens.");

  const { message, raw } = await loadMessage(tenantId, conversationId, messageId);
  const originalContent = message.text ?? null;
  const nextRaw = {
    ...raw,
    hiddenAt: new Date().toISOString(),
    hiddenByUserId: actor.id,
    hiddenByName: actor.name,
    hiddenReason: reason?.trim() || "Ocultada pela supervisao",
    originalContent
  } as Prisma.InputJsonObject;

  const updated = await prisma.message.update({
    where: { id: message.id },
    data: {
      status: "hidden",
      text: "[Mensagem oculta]",
      raw: nextRaw
    }
  });

  emitToTenant(tenantId, "inbox:message", {
    conversation: message.conversation,
    message: updated
  });

  return updated;
}

/** @deprecated Agents cannot delete messages — use hideMessage for supervisors. */
export async function softDeleteMessage(
  tenantId: string,
  conversationId: string,
  messageId: string,
  actor: MessageActor,
  reason?: string
) {
  return hideMessage(tenantId, conversationId, messageId, actor, reason);
}

async function loadOutboundMessage(tenantId: string, conversationId: string, messageId: string) {
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      conversationId,
      direction: "out",
      conversation: { tenantId }
    },
    include: {
      conversation: {
        include: {
          assignedTo: { select: { id: true, name: true, role: true } },
          team: { select: { id: true, name: true } },
          instance: { select: { id: true, name: true, label: true, status: true } },
          lead: { select: { id: true, company: true, status: true, value: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 }
        }
      }
    }
  });
  if (!message) throw new Error("Mensagem nao encontrada.");
  const raw = rawObject(message.raw);
  if (raw.hiddenAt || raw.deletedAt) throw new Error("Mensagem indisponivel para edicao.");
  return { message, raw };
}

export async function editMessageInternal(
  tenantId: string,
  conversationId: string,
  messageId: string,
  nextText: string,
  actor: MessageActor
) {
  if (!nextText.trim()) throw new Error("Texto da mensagem nao pode ficar vazio.");
  const { message, raw } = await loadOutboundMessage(tenantId, conversationId, messageId);
  if (!canEditMessage(actor, raw)) throw new Error("Voce nao pode editar esta mensagem.");

  const providerSync = await syncEditMessageToProvider(tenantId, conversationId, messageId, nextText.trim());

  const history = Array.isArray(raw.editHistory) ? raw.editHistory : [];
  const nextRaw = {
    ...raw,
    contentRaw: nextText,
    editedAt: new Date().toISOString(),
    editedByUserId: actor.id,
    editedByName: actor.name,
    previousContent: message.text ?? null,
    deliveryStatus: raw.deliveryStatus ?? message.status,
    providerText:
      providerSync.mode === "whatsapp_edit" && "providerText" in providerSync
        ? providerSync.providerText
        : raw.providerText,
    whatsappSync: providerSync,
    editHistory: [
      ...history,
      {
        at: new Date().toISOString(),
        byUserId: actor.id,
        byName: actor.name,
        previousContent: message.text ?? null
      }
    ]
  } as Prisma.InputJsonObject;

  const updated = await prisma.message.update({
    where: { id: message.id },
    data: {
      text: nextText.trim(),
      raw: nextRaw
    }
  });

  emitToTenant(tenantId, "inbox:message", {
    conversation: message.conversation,
    message: updated
  });

  return updated;
}
