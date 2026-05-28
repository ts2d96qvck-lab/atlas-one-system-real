export type ParsedEvolutionMessage = {
  instanceName: string;
  remoteJid: string;
  fromMe: boolean;
  customerName: string;
  providerId?: string;
  type: "text" | "image" | "video" | "audio" | "document" | "location" | "contact" | "unknown";
  text?: string;
  mediaUrl?: string;
  mediaBase64?: string;
  mimeType?: string;
  fileName?: string;
  status: "received" | "sent" | "delivered" | "read";
};

function mediaFromPayload(payload: Record<string, unknown> | undefined) {
  if (!payload) return {};
  const base64 =
    typeof payload.base64 === "string"
      ? payload.base64
      : typeof payload.file === "string"
        ? payload.file
        : undefined;
  return {
    mediaUrl: typeof payload.url === "string" ? payload.url : undefined,
    mediaBase64: base64,
    mimeType: typeof payload.mimetype === "string" ? payload.mimetype : undefined,
    fileName: typeof payload.fileName === "string" ? payload.fileName : undefined
  };
}

function readMessageContent(message: Record<string, unknown> | undefined) {
  if (!message || typeof message !== "object") return null;

  const ephemeral = message.ephemeralMessage as { message?: Record<string, unknown> } | undefined;
  if (ephemeral?.message) {
    return readMessageContent(ephemeral.message);
  }

  if (typeof message.conversation === "string") {
    return { type: "text" as const, text: message.conversation };
  }

  const extended = message.extendedTextMessage as { text?: string } | undefined;
  if (extended?.text) {
    return { type: "text" as const, text: extended.text };
  }

  const image = message.imageMessage as Record<string, unknown> | undefined;
  if (image) {
    const media = mediaFromPayload(image);
    return {
      type: "image" as const,
      text: String(image.caption ?? "[Imagem]"),
      ...media
    };
  }

  const audio = message.audioMessage as Record<string, unknown> | undefined;
  if (audio) {
    const media = mediaFromPayload(audio);
    return {
      type: "audio" as const,
      text: "[Audio]",
      mimeType: media.mimeType ?? "audio/ogg",
      ...media
    };
  }

  const video = message.videoMessage as Record<string, unknown> | undefined;
  if (video) {
    const media = mediaFromPayload(video);
    return {
      type: "video" as const,
      text: String(video.caption ?? "[Vídeo]"),
      ...media
    };
  }

  const document = message.documentMessage as Record<string, unknown> | undefined;
  if (document) {
    const media = mediaFromPayload(document);
    return {
      type: "document" as const,
      text: String(document.caption ?? document.fileName ?? "[Documento]"),
      fileName: String(document.fileName ?? "documento"),
      ...media
    };
  }

  const location = message.locationMessage as { degreesLatitude?: number; degreesLongitude?: number; name?: string } | undefined;
  if (location) {
    const lat = location.degreesLatitude;
    const lng = location.degreesLongitude;
    const maps =
      lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : undefined;
    return {
      type: "location" as const,
      text: location.name ?? "[Localização]",
      mediaUrl: maps
    };
  }

  const contact = message.contactMessage as { displayName?: string } | undefined;
  if (contact) {
    return {
      type: "contact" as const,
      text: contact.displayName ?? "[Contato]"
    };
  }

  return null;
}

export function normalizeEvolutionEvent(event: unknown) {
  return String(event ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, ".");
}

export function parseEvolutionWebhook(body: unknown): ParsedEvolutionMessage | null {
  if (!body || typeof body !== "object") return null;

  const payload = body as Record<string, unknown>;
  const event = normalizeEvolutionEvent(payload.event);
  let data = (payload.data ?? payload) as Record<string, unknown>;

  if (event === "messages.update" || event === "message.update") {
    return null;
  }

  if (Array.isArray(data) && data[0] && typeof data[0] === "object") {
    data = data[0] as Record<string, unknown>;
  }

  const key = (data.key ?? {}) as Record<string, unknown>;
  let remoteJid = String(key.remoteJid ?? data.remoteJid ?? data.from ?? data.number ?? "");
  if (!remoteJid && typeof data.senderPn === "string") {
    remoteJid = `${data.senderPn.replace(/\D/g, "")}@s.whatsapp.net`;
  }
  if (!remoteJid || remoteJid.endsWith("@g.us")) return null;

  const messagePayload =
    (data.message as Record<string, unknown> | undefined) ??
    (Array.isArray(data.messages) ? (data.messages[0] as Record<string, unknown>)?.message : undefined);

  let content = readMessageContent(messagePayload as Record<string, unknown> | undefined);
  if (!content && typeof data.text === "string" && data.text.trim()) {
    content = { type: "text" as const, text: data.text.trim() };
  }
  if (!content && typeof data.body === "string" && data.body.trim()) {
    content = { type: "text" as const, text: data.body.trim() };
  }
  if (!content) return null;

  const fromMe = key.fromMe === true || event === "send.message";
  const instanceName = String(payload.instance ?? data.instance ?? "Atlas one");
  const customerName = String(data.pushName ?? data.pushname ?? remoteJid.replace("@s.whatsapp.net", ""));

  return {
    instanceName,
    remoteJid,
    fromMe,
    customerName,
    providerId: key.id ? String(key.id) : undefined,
    type: content.type,
    text: content.text,
    mediaUrl: "mediaUrl" in content ? content.mediaUrl : undefined,
    mediaBase64: "mediaBase64" in content ? content.mediaBase64 : undefined,
    mimeType: "mimeType" in content ? content.mimeType : undefined,
    fileName: "fileName" in content ? content.fileName : undefined,
    status: fromMe ? "sent" : "received"
  };
}

export function buildWebhookPublicUrl(base: string, tenantSlug?: string) {
  const normalized = base.replace(/\/$/, "");
  const suffix = tenantSlug ? `/webhook/evolution/${tenantSlug}` : "/webhook/evolution";
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)/i.test(normalized)) {
    const port = new URL(normalized.includes("://") ? normalized : `http://${normalized}`).port || "4000";
    return `http://host.docker.internal:${port}${suffix}`;
  }
  return `${normalized}${suffix}`;
}
