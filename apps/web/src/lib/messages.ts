import type { Message } from "./api";

export function mediaSrc(url: string | null | undefined, apiUrl: string, accessToken?: string) {
  if (!url) return undefined;
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  const base = `${apiUrl.replace(/\/$/, "")}${url}`;
  if (!accessToken) return base;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}access_token=${encodeURIComponent(accessToken)}`;
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
