import type { Conversation } from "./api";

export type InboxSlaConfig = {
  firstResponseMinutes: number;
  resolutionHours: number;
};

export type ConversationSlaState = {
  waitingForResponseMs: number | null;
  idleMs: number | null;
  firstResponseBreached: boolean;
  resolutionBreached: boolean;
  withinSla: boolean;
  summaryLabel: string;
  detailLabel: string;
  tone: "neutral" | "ok" | "warn" | "danger";
};

const HISTORY_STATUSES = new Set(["resolved", "closed", "archived"]);

export function defaultInboxSlaConfig(settings?: Partial<InboxSlaConfig> | null): InboxSlaConfig {
  return {
    firstResponseMinutes: settings?.firstResponseMinutes ?? 15,
    resolutionHours: settings?.resolutionHours ?? 24
  };
}

export function formatDurationShort(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days}d ${remHours}h` : `${days}d`;
}

export function computeConversationSla(
  conversation: Conversation,
  config: InboxSlaConfig,
  now = Date.now()
): ConversationSlaState {
  if (HISTORY_STATUSES.has(conversation.status)) {
    return {
      waitingForResponseMs: null,
      idleMs: null,
      firstResponseBreached: false,
      resolutionBreached: false,
      withinSla: true,
      summaryLabel: "Encerrada",
      detailLabel: "Conversa no histórico",
      tone: "neutral"
    };
  }

  const latest = conversation.messages?.[0];
  const firstResponseLimitMs = config.firstResponseMinutes * 60_000;
  const resolutionLimitMs = config.resolutionHours * 60 * 60_000;
  const openedAt = conversation.createdAt
    ? new Date(conversation.createdAt).getTime()
    : conversation.lastMessageAt
      ? new Date(conversation.lastMessageAt).getTime()
      : now;

  let waitingForResponseMs: number | null = null;
  let firstResponseBreached = false;

  if (latest?.direction === "in") {
    const since = new Date(latest.createdAt ?? conversation.lastMessageAt ?? openedAt).getTime();
    waitingForResponseMs = Math.max(0, now - since);
    firstResponseBreached = waitingForResponseMs > firstResponseLimitMs;
  }

  const resolutionElapsedMs = Math.max(0, now - openedAt);
  const resolutionBreached = resolutionElapsedMs > resolutionLimitMs;

  let idleMs: number | null = null;
  if (conversation.status === "waiting_customer" || conversation.status === "waiting_internal") {
    const base = conversation.lastMessageAt ?? latest?.createdAt ?? conversation.updatedAt;
    if (base) idleMs = Math.max(0, now - new Date(base).getTime());
  }

  const withinSla = !firstResponseBreached && !resolutionBreached;
  const tone: ConversationSlaState["tone"] = firstResponseBreached || resolutionBreached ? "danger" : waitingForResponseMs && waitingForResponseMs > firstResponseLimitMs * 0.7 ? "warn" : "ok";

  const parts: string[] = [];
  if (waitingForResponseMs !== null) parts.push(`Sem resp. ${formatDurationShort(waitingForResponseMs)}`);
  if (idleMs !== null) parts.push(`Aguardando ${formatDurationShort(idleMs)}`);

  const detailParts: string[] = [];
  if (waitingForResponseMs !== null) {
    detailParts.push(`1ª resposta: ${firstResponseBreached ? "fora do SLA" : "dentro do SLA"}`);
  }
  if (resolutionBreached) detailParts.push("Resolução fora do SLA");
  else if (conversation.status === "open" || conversation.status.startsWith("waiting")) {
    detailParts.push("Resolução dentro do SLA");
  }

  return {
    waitingForResponseMs,
    idleMs,
    firstResponseBreached,
    resolutionBreached,
    withinSla,
    summaryLabel: parts.length ? parts.join(" · ") : withinSla ? "Dentro do SLA" : "Fora do SLA",
    detailLabel: detailParts.join(" · ") || "Sem pendência de resposta",
    tone
  };
}

export function isConversationOverSla(conversation: Conversation, config: InboxSlaConfig, now = Date.now()) {
  const state = computeConversationSla(conversation, config, now);
  return state.firstResponseBreached || state.resolutionBreached;
}
