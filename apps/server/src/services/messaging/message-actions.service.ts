import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { emitToTenant } from "../../lib/realtime";
import { syncDeleteMessageToProvider, syncEditMessageToProvider } from "./message-provider-sync.service";

type MessageActor = { id: string; name: string; role: string };

function rawObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function canManageMessage(actor: MessageActor, messageRaw: Record<string, unknown>) {
  if (actor.role === "owner" || actor.role === "admin" || actor.role === "supervisor") return true;
  const sentById = typeof messageRaw.sentById === "string" ? messageRaw.sentById : null;
  return sentById === actor.id;
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
  if (raw.deletedAt) throw new Error("Mensagem ja foi apagada.");
  return { message, raw };
}

export async function softDeleteMessage(
  tenantId: string,
  conversationId: string,
  messageId: string,
  actor: MessageActor
) {
  const { message, raw } = await loadOutboundMessage(tenantId, conversationId, messageId);
  if (!canManageMessage(actor, raw)) throw new Error("Voce nao pode apagar esta mensagem.");

  const providerSync = await syncDeleteMessageToProvider(tenantId, conversationId, messageId);

  const nextRaw = {
    ...raw,
    deletedAt: new Date().toISOString(),
    deletedByUserId: actor.id,
    deletedByName: actor.name,
    previousContent: message.text ?? null,
    whatsappSync: providerSync
  } as Prisma.InputJsonObject;

  const updated = await prisma.message.update({
    where: { id: message.id },
    data: {
      status: "deleted",
      text: null,
      raw: nextRaw
    }
  });

  emitToTenant(tenantId, "inbox:message", {
    conversation: message.conversation,
    message: updated
  });

  return updated;
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
  if (!canManageMessage(actor, raw)) throw new Error("Voce nao pode editar esta mensagem.");

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
      status: message.status === "failed" ? "failed" : (raw.deliveryStatus as string) ?? message.status,
      text: nextText,
      raw: nextRaw
    }
  });

  emitToTenant(tenantId, "inbox:message", {
    conversation: message.conversation,
    message: updated
  });

  return updated;
}
