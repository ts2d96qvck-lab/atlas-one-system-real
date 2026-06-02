import type { Message } from "./api";

const MESSAGE_CLUSTER_WINDOW_MS = 5 * 60 * 1000;

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
    const next = [...existing];
    next[index] = { ...existing[index], ...incoming };
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
    if (dupIndex >= 0 && (incoming as Message & { providerId?: string }).providerId && !(dup as Message & { providerId?: string }).providerId) {
      const next = [...existing];
      next[dupIndex] = { ...dup, ...incoming, id: dup.id };
      return next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return existing;
  }

  return [...existing, incoming].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function messageDeliveryStatus(message: Message) {
  const raw = message.raw && typeof message.raw === "object" ? (message.raw as Record<string, unknown>) : {};
  const fromRaw = typeof raw.deliveryStatus === "string" ? raw.deliveryStatus : null;
  const status = String(fromRaw ?? message.status ?? "").toLowerCase();
  if (status === "deleted" || status === "edited") return fromRaw ?? "sent";
  return status;
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
