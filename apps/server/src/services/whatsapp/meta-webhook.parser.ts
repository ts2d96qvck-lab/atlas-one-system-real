export type ParsedMetaMessage = {
  phoneNumberId: string;
  from: string;
  messageId: string;
  type: string;
  text: string;
  timestamp: number;
  customerName?: string;
};

export type ParsedMetaStatus = {
  phoneNumberId: string;
  messageId: string;
  status: string;
};

export type MetaWebhookEvent =
  | { kind: "message"; data: ParsedMetaMessage }
  | { kind: "status"; data: ParsedMetaStatus };

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function iterateMetaWebhookEvents(body: unknown): MetaWebhookEvent[] {
  if (!body || typeof body !== "object") return [];
  const root = body as Record<string, unknown>;
  const entries = Array.isArray(root.entry) ? root.entry : [];
  const events: MetaWebhookEvent[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const changes = Array.isArray((entry as Record<string, unknown>).changes)
      ? ((entry as Record<string, unknown>).changes as unknown[])
      : [];

    for (const change of changes) {
      if (!change || typeof change !== "object") continue;
      const value = (change as Record<string, unknown>).value;
      if (!value || typeof value !== "object") continue;
      const val = value as Record<string, unknown>;
      const metadata = (val.metadata && typeof val.metadata === "object" ? val.metadata : {}) as Record<
        string,
        unknown
      >;
      const phoneNumberId = readString(metadata.phone_number_id);
      if (!phoneNumberId) continue;

      const contacts = Array.isArray(val.contacts) ? val.contacts : [];
      const contactName =
        contacts[0] && typeof contacts[0] === "object"
          ? readString(((contacts[0] as Record<string, unknown>).profile as Record<string, unknown> | undefined)?.name)
          : "";

      const messages = Array.isArray(val.messages) ? val.messages : [];
      for (const message of messages) {
        if (!message || typeof message !== "object") continue;
        const row = message as Record<string, unknown>;
        const type = readString(row.type) || "text";
        let text = `[${type}]`;
        if (type === "text") {
          const textObj = row.text as Record<string, unknown> | undefined;
          text = readString(textObj?.body) || text;
        } else if (type === "button") {
          const button = row.button as Record<string, unknown> | undefined;
          text = readString(button?.text) || text;
        } else if (type === "interactive") {
          const interactive = row.interactive as Record<string, unknown> | undefined;
          const buttonReply = interactive?.button_reply as Record<string, unknown> | undefined;
          text = readString(buttonReply?.title) || text;
        }

        events.push({
          kind: "message",
          data: {
            phoneNumberId,
            from: readString(row.from),
            messageId: readString(row.id),
            type,
            text,
            timestamp: Number(row.timestamp ?? Date.now()),
            customerName: contactName || undefined
          }
        });
      }

      const statuses = Array.isArray(val.statuses) ? val.statuses : [];
      for (const statusRow of statuses) {
        if (!statusRow || typeof statusRow !== "object") continue;
        const row = statusRow as Record<string, unknown>;
        events.push({
          kind: "status",
          data: {
            phoneNumberId,
            messageId: readString(row.id),
            status: readString(row.status) || "sent"
          }
        });
      }
    }
  }

  return events;
}

export function mapMetaDeliveryStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "read") return "read";
  if (normalized === "delivered") return "delivered";
  if (normalized === "sent") return "sent";
  if (normalized === "failed") return "failed";
  return normalized || "sent";
}
