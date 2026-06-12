import type { Message } from "./api";

const MESSAGE_CLUSTER_WINDOW_MS = 5 * 60 * 1000;

const DELIVERY_STATUS_RANK: Record<string, number> = {
  failed: 1,
  pending: 2,
  queued: 2,
  sending: 2,
  sent: 3,
  delivered: 4,
  read: 5
};

function deliveryStatusRank(status: string) {
  return DELIVERY_STATUS_RANK[status.toLowerCase()] ?? 0;
}

function mergeRawFields(existing: Record<string, unknown>, incoming: Record<string, unknown>) {
  const next = { ...existing, ...incoming };
  const existingDelivery =
    typeof existing.deliveryStatus === "string" ? existing.deliveryStatus : "";
  const incomingDelivery =
    typeof incoming.deliveryStatus === "string" ? incoming.deliveryStatus : "";
  if (deliveryStatusRank(incomingDelivery) >= deliveryStatusRank(existingDelivery)) {
    next.deliveryStatus = incomingDelivery || existingDelivery;
  } else {
    next.deliveryStatus = existingDelivery || incomingDelivery;
  }
  if ("failureReason" in incoming) {
    next.failureReason = incoming.failureReason;
  }
  return next;
}

export function mediaSrc(url: string | null | undefined, apiUrl: string, accessToken?: string) {
  if (!url) return undefined;
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  const base = `${apiUrl.replace(/\/$/, "")}${url}`;
  if (!accessToken) return base;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}token=${encodeURIComponent(accessToken)}`;
}

function canViewHiddenMessages(role: string) {
  return role === "owner" || role === "admin" || role === "supervisor";
}

export function sanitizeMessageForViewer<T extends Message>(message: T, role: string): T {
  const raw =
    message.raw && typeof message.raw === "object" ? ({ ...(message.raw as Record<string, unknown>) } as Record<string, unknown>) : {};
  if (!raw.hiddenAt && message.status !== "hidden") return message;

  if (canViewHiddenMessages(role)) {
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
    status: "hidden",
    raw: {
      hiddenAt: raw.hiddenAt
    }
  } as T;
}

export function mergeMessages(existing: Message[] = [], incoming: Message) {
  const index = existing.findIndex((item) => item.id === incoming.id);
  if (index >= 0) {
    const prev = existing[index];
    if (!prev) return [...existing, incoming].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const prevRaw =
      prev.raw && typeof prev.raw === "object" ? (prev.raw as Record<string, unknown>) : {};
    const nextRaw =
      incoming.raw && typeof incoming.raw === "object" ? (incoming.raw as Record<string, unknown>) : {};
    const next = [...existing];
    next[index] = {
      ...prev,
      ...incoming,
      raw: mergeRawFields(prevRaw, nextRaw)
    };
    return next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  const fingerprint = `${incoming.direction}|${incoming.text}|${incoming.type}`;
  const dup = existing.find((item) => {
    const same =
      item.direction === incoming.direction &&
      item.text === incoming.text &&
      item.type === incoming.type;
    if (!same) return false;
    const a = new Date(item.createdAt).getTime();
    const b = new Date(incoming.createdAt).getTime();
    return Math.abs(a - b) < 120_000;
  });
  if (dup) {
    const dupIndex = existing.findIndex((item) => item.id === dup.id);
    if (dupIndex >= 0) {
      const incomingRank = deliveryStatusRank(messageDeliveryStatus(incoming));
      const dupRank = deliveryStatusRank(messageDeliveryStatus(dup));
      const incomingProviderId = (incoming as Message & { providerId?: string }).providerId;
      const dupProviderId = (dup as Message & { providerId?: string }).providerId;
      if (
        incomingRank > dupRank ||
        (incomingProviderId && !dupProviderId) ||
        incoming.id === dup.id
      ) {
        const prevRaw =
          dup.raw && typeof dup.raw === "object" ? (dup.raw as Record<string, unknown>) : {};
        const nextRaw =
          incoming.raw && typeof incoming.raw === "object" ? (incoming.raw as Record<string, unknown>) : {};
        const next = [...existing];
        next[dupIndex] = {
          ...dup,
          ...incoming,
          id: dup.id,
          raw: mergeRawFields(prevRaw, nextRaw)
        };
        return next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }
    }
    return existing;
  }

  return [...existing, incoming].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function mergeMessageLists(existing: Message[] = [], incoming: Message[] = []) {
  let merged = [...existing];
  for (const message of incoming) {
    merged = mergeMessages(merged, message);
  }
  return merged;
}

export function messageDeliveryStatus(message: Message) {
  const raw = message.raw && typeof message.raw === "object" ? (message.raw as Record<string, unknown>) : {};
  const fromRaw = typeof raw.deliveryStatus === "string" ? raw.deliveryStatus : null;
  const status = String(fromRaw ?? message.status ?? "").toLowerCase();
  if (status === "deleted" || status === "edited") return fromRaw ?? "sent";
  return status;
}

export function createClientMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cmid-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function getClientMessageId(message: Message) {
  const raw = message.raw && typeof message.raw === "object" ? (message.raw as Record<string, unknown>) : {};
  return typeof raw.clientMessageId === "string" ? raw.clientMessageId : null;
}

export function isOutboundSendFailed(message: Message) {
  if (message.direction !== "out") return false;
  if (message.status === "failed") return true;
  return messageDeliveryStatus(message).includes("fail");
}

function messageSenderId(message: Message) {
  const raw = message.raw && typeof message.raw === "object" ? (message.raw as Record<string, unknown>) : {};
  return typeof raw.sentById === "string" ? raw.sentById : null;
}

export function messagesClusterTogether(previous: Message, next: Message) {
  if (previous.direction !== next.direction) return false;
  const delta = Math.abs(new Date(next.createdAt).getTime() - new Date(previous.createdAt).getTime());
  if (delta > MESSAGE_CLUSTER_WINDOW_MS) return false;
  if (previous.direction === "out") {
    const prevSender = messageSenderId(previous);
    const nextSender = messageSenderId(next);
    if (prevSender && nextSender && prevSender !== nextSender) return false;
  }
  return true;
}

export function formatMessageDateLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Hoje";
  if (sameDay(date, yesterday)) return "Ontem";

  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" as const } : {})
  });
}

export type MessageThreadGroup = {
  dateKey: string;
  dateLabel: string;
  clusters: Message[][];
};

export function groupMessagesForThread(messages: Message[]): MessageThreadGroup[] {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const groups: MessageThreadGroup[] = [];

  for (const message of sorted) {
    const dateKey = new Date(message.createdAt).toISOString().slice(0, 10);
    let group = groups.find((item) => item.dateKey === dateKey);
    if (!group) {
      group = {
        dateKey,
        dateLabel: formatMessageDateLabel(message.createdAt),
        clusters: []
      };
      groups.push(group);
    }

    const lastCluster = group.clusters[group.clusters.length - 1];
    const lastMessage = lastCluster?.[lastCluster.length - 1];
    if (lastCluster && lastMessage && messagesClusterTogether(lastMessage, message)) {
      lastCluster.push(message);
    } else {
      group.clusters.push([message]);
    }
  }

  return groups;
}
