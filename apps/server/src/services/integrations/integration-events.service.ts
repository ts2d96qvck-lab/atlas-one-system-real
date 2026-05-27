import { dispatchTenantWebhooks } from "./webhook-dispatcher.service";
import type { IntegrationEventType } from "./events";

export function emitIntegrationEvent(
  tenantId: string,
  event: IntegrationEventType,
  data: Record<string, unknown>
) {
  void dispatchTenantWebhooks(tenantId, event, data).catch(() => {});
}

export function publicLeadPayload(lead: {
  id: string;
  company: string;
  contact: string;
  phone: string;
  email?: string | null;
  origin: string;
  status: string;
  value: unknown;
  assignedToId?: string | null;
  conversationId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: lead.id,
    company: lead.company,
    contact: lead.contact,
    phone: lead.phone,
    email: lead.email,
    origin: lead.origin,
    status: lead.status,
    value: Number(lead.value),
    assignedToId: lead.assignedToId,
    conversationId: lead.conversationId,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString()
  };
}

export function publicConversationPayload(conversation: {
  id: string;
  customerName: string;
  customerPhone: string;
  status: string;
  priority: string;
  assignedToId?: string | null;
  teamId?: string | null;
  lastMessageAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: conversation.id,
    customerName: conversation.customerName,
    customerPhone: conversation.customerPhone,
    status: conversation.status,
    priority: conversation.priority,
    assignedToId: conversation.assignedToId,
    teamId: conversation.teamId,
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString()
  };
}

export function publicMessagePayload(message: {
  id: string;
  conversationId: string;
  direction: string;
  type: string;
  text?: string | null;
  status: string;
  createdAt: Date;
}) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    direction: message.direction,
    type: message.type,
    text: message.text,
    status: message.status,
    createdAt: message.createdAt.toISOString()
  };
}
