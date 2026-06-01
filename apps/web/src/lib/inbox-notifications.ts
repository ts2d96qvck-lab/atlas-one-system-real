import type { Conversation, Message } from "./api";

const STORAGE_PREFIX = "atlas-inbox-notify";
const MAX_NOTIFIED_IDS = 500;

export type InboxNotificationPrefs = {
  soundEnabled: boolean;
  supervisorQueueAlerts: boolean;
};

const notifiedMessageIds = new Set<string>();

export function notificationPrefsKey(tenantId: string, userId: string) {
  return `${STORAGE_PREFIX}:prefs:${tenantId}:${userId}`;
}

export function lastSeenStorageKey(tenantId: string, userId: string) {
  return `${STORAGE_PREFIX}:seen:${tenantId}:${userId}`;
}

export function loadNotificationPrefs(tenantId: string, userId: string): InboxNotificationPrefs {
  if (typeof window === "undefined") {
    return { soundEnabled: true, supervisorQueueAlerts: false };
  }
  try {
    const raw = localStorage.getItem(notificationPrefsKey(tenantId, userId));
    if (!raw) return { soundEnabled: true, supervisorQueueAlerts: false };
    const parsed = JSON.parse(raw) as Partial<InboxNotificationPrefs>;
    return {
      soundEnabled: parsed.soundEnabled !== false,
      supervisorQueueAlerts: Boolean(parsed.supervisorQueueAlerts)
    };
  } catch {
    return { soundEnabled: true, supervisorQueueAlerts: false };
  }
}

export function saveNotificationPrefs(
  tenantId: string,
  userId: string,
  patch: Partial<InboxNotificationPrefs>
): InboxNotificationPrefs {
  const next = { ...loadNotificationPrefs(tenantId, userId), ...patch };
  localStorage.setItem(notificationPrefsKey(tenantId, userId), JSON.stringify(next));
  return next;
}

export function loadLastSeenMap(tenantId: string, userId: string): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(lastSeenStorageKey(tenantId, userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

export function persistLastSeenMap(tenantId: string, userId: string, map: Record<string, number>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(lastSeenStorageKey(tenantId, userId), JSON.stringify(map));
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestInboxNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function wasMessageNotified(messageId: string) {
  return notifiedMessageIds.has(messageId);
}

export function markMessageNotified(messageId: string) {
  notifiedMessageIds.add(messageId);
  if (notifiedMessageIds.size <= MAX_NOTIFIED_IDS) return;
  const oldest = notifiedMessageIds.values().next().value;
  if (oldest) notifiedMessageIds.delete(oldest);
}

export function messagePreview(message: Pick<Message, "type" | "text">) {
  const text = message.text?.trim();
  if (text) return text.length > 120 ? `${text.slice(0, 117)}...` : text;
  const labels: Record<string, string> = {
    image: "Imagem recebida",
    video: "Video recebido",
    audio: "Audio recebido",
    document: "Documento recebido",
    sticker: "Sticker recebido"
  };
  return labels[message.type] ?? "Nova mensagem";
}

export function isConversationOverdue(conversation: Conversation, overdueMinutes = 5) {
  const latest = conversation.messages?.[0];
  if (!latest || latest.direction !== "in") return false;
  const base = latest.createdAt ?? conversation.lastMessageAt;
  if (!base) return false;
  return Date.now() - new Date(base).getTime() >= overdueMinutes * 60 * 1000;
}

export type InboundNotifyDecision =
  | { action: "none" }
  | { action: "active-thread" }
  | { action: "notify"; title: string; body: string; reason: "assigned" | "unassigned" };

export function decideInboundNotification(input: {
  message: Message;
  conversation: Conversation;
  userId: string;
  canMonitorQueue: boolean;
  prefs: InboxNotificationPrefs;
  activeConversationId: string | null;
}): InboundNotifyDecision {
  if (input.message.direction !== "in") return { action: "none" };
  if (wasMessageNotified(input.message.id)) return { action: "none" };

  if (input.activeConversationId === input.conversation.id) {
    return { action: "active-thread" };
  }

  const assignedToMe = input.conversation.assignedToId === input.userId;
  const unassigned = !input.conversation.assignedToId;
  const preview = messagePreview(input.message);
  const customer = input.conversation.customerName || input.conversation.customerPhone;

  if (assignedToMe) {
    return {
      action: "notify",
      reason: "assigned",
      title: customer,
      body: preview
    };
  }

  if (input.canMonitorQueue && input.prefs.supervisorQueueAlerts && unassigned) {
    return {
      action: "notify",
      reason: "unassigned",
      title: `Fila sem atendente · ${customer}`,
      body: preview
    };
  }

  return { action: "none" };
}

export function playNotificationSound() {
  if (typeof window === "undefined") return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.07;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.14);
    window.setTimeout(() => void ctx.close().catch(() => undefined), 250);
  } catch {
    /* ignore audio failures */
  }
}

export function showInboxBrowserNotification(input: {
  title: string;
  body: string;
  messageId: string;
  conversationId: string;
  onOpenConversation?: (conversationId: string) => void;
}) {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  markMessageNotified(input.messageId);

  const notification = new Notification(input.title, {
    body: input.body,
    tag: `atlas-msg-${input.messageId}`,
    icon: "/icon.svg"
  });

  notification.onclick = () => {
    window.focus();
    input.onOpenConversation?.(input.conversationId);
    notification.close();
  };

  window.setTimeout(() => notification.close(), 8000);
  return true;
}

export function dispatchInboundNotification(input: {
  message: Message;
  conversation: Conversation;
  userId: string;
  canMonitorQueue: boolean;
  prefs: InboxNotificationPrefs;
  activeConversationId: string | null;
  onOpenConversation?: (conversationId: string) => void;
}): InboundNotifyDecision {
  const decision = decideInboundNotification(input);
  if (decision.action === "active-thread") {
    markMessageNotified(input.message.id);
    return decision;
  }
  if (decision.action !== "notify") return decision;

  if (input.prefs.soundEnabled) playNotificationSound();
  showInboxBrowserNotification({
    title: decision.title,
    body: decision.body,
    messageId: input.message.id,
    conversationId: input.conversation.id,
    onOpenConversation: input.onOpenConversation
  });
  return decision;
}
