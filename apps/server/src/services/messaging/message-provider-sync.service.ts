import type { Message, Conversation, WhatsAppInstance } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { prepareOutboundInstance } from "../whatsapp/whatsapp-instance.service";
import { applyOutgoingSignature, getMessagingSettings } from "./message-signature.service";

type LoadedMessage = Message & {
  conversation: Conversation & {
    instance: WhatsAppInstance | null;
  };
};

function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

async function loadMessageForProviderSync(tenantId: string, conversationId: string, messageId: string) {
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
          instance: true
        }
      }
    }
  });
  if (!message) throw new Error("Mensagem nao encontrada.");
  return message as LoadedMessage;
}

async function syncWithEvolution(
  message: LoadedMessage,
  tenantId: string,
  action: "delete" | "edit",
  editText?: string
) {
  const instance = message.conversation.instance;
  if (!instance) throw new Error("Conversa sem numero WhatsApp vinculado.");
  if (!message.providerId) {
    throw new Error("Esta mensagem nao possui ID do WhatsApp. Apenas alteracao interna e possivel.");
  }

  const phone = normalizePhone(message.conversation.customerPhone);
  if (!phone) throw new Error("Telefone do cliente invalido para sincronizar com WhatsApp.");

  const { provider, kind, sendName } = await prepareOutboundInstance(tenantId, message.conversationId, instance);
  if (kind !== "evolution") {
    throw new Error("Editar/apagar no WhatsApp do cliente requer instancia Evolution conectada.");
  }
  if (typeof provider.deleteMessageForEveryone !== "function" || typeof provider.updateMessage !== "function") {
    throw new Error("Provedor WhatsApp nao suporta editar/apagar mensagens.");
  }

  const keyInput = {
    instanceName: sendName,
    instancePhone: instance.phone ?? undefined,
    number: phone,
    providerId: message.providerId,
    fromMe: true
  };

  if (action === "delete") {
    await provider.deleteMessageForEveryone(keyInput);
    return { synced: true, mode: "whatsapp_delete" as const };
  }

  if (!editText?.trim()) throw new Error("Texto da mensagem nao pode ficar vazio.");
  if (message.type !== "text") throw new Error("Somente mensagens de texto podem ser editadas no WhatsApp.");

  const raw =
    message.raw && typeof message.raw === "object" && !Array.isArray(message.raw)
      ? (message.raw as Record<string, unknown>)
      : {};
  const actor = {
    id: typeof raw.sentById === "string" ? raw.sentById : "system",
    name: typeof raw.sentByName === "string" ? raw.sentByName : "Atendente",
    role: typeof raw.sentByRole === "string" ? raw.sentByRole : "agent"
  };
  const messagingSettings = await getMessagingSettings(tenantId);
  const { providerText } = applyOutgoingSignature(editText.trim(), actor, messagingSettings);

  await provider.updateMessage({ ...keyInput, text: providerText });
  return { synced: true, mode: "whatsapp_edit" as const, providerText };
}

export async function syncDeleteMessageToProvider(tenantId: string, conversationId: string, messageId: string) {
  const message = await loadMessageForProviderSync(tenantId, conversationId, messageId);
  try {
    return await syncWithEvolution(message, tenantId, "delete");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (/nao possui ID do WhatsApp/i.test(detail)) {
      return { synced: false, mode: "internal_only" as const, reason: detail };
    }
    throw error;
  }
}

export async function syncEditMessageToProvider(
  tenantId: string,
  conversationId: string,
  messageId: string,
  nextText: string
) {
  const message = await loadMessageForProviderSync(tenantId, conversationId, messageId);
  try {
    return await syncWithEvolution(message, tenantId, "edit", nextText);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (/nao possui ID do WhatsApp/i.test(detail)) {
      return { synced: false, mode: "internal_only" as const, reason: detail };
    }
    throw error;
  }
}
