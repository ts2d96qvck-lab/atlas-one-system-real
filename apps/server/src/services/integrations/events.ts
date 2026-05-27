export const INTEGRATION_EVENTS = [
  "conversation.created",
  "conversation.closed",
  "message.created",
  "lead.created",
  "lead.updated",
  "deal.won",
  "deal.lost",
  "commercial.event"
] as const;

export type IntegrationEventType = (typeof INTEGRATION_EVENTS)[number];

export function isIntegrationEvent(value: string): value is IntegrationEventType {
  return (INTEGRATION_EVENTS as readonly string[]).includes(value);
}

export function leadStatusEvent(status: string): IntegrationEventType | null {
  const normalized = status.toLowerCase();
  if (normalized.includes("fechado")) return "deal.won";
  if (normalized.includes("perdido")) return "deal.lost";
  return null;
}
