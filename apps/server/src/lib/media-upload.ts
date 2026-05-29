export const MAX_INBOX_MEDIA_BYTES = 25 * 1024 * 1024;

export type NormalizedInboxUpload = {
  buffer: Buffer;
  mimetype: string;
  filename: string;
  mediatype: "image" | "video" | "audio" | "document";
  sizeBytes: number;
};

const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  opus: "audio/opus",
  wav: "audio/wav",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain"
};

const BLOCKED_MIME_PREFIXES = ["application/x-msdownload", "application/x-dosexec", "application/x-executable"];

export function mediaTypeFromMime(mime: string): NormalizedInboxUpload["mediatype"] {
  const normalized = mime.toLowerCase();
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("video/")) return "video";
  if (normalized.startsWith("audio/")) return "audio";
  return "document";
}

function extensionFromName(filename: string) {
  const parts = filename.split(".");
  if (parts.length < 2) return "";
  return (parts.pop() ?? "").trim().toLowerCase();
}

function sanitizeFilename(value: string | undefined, fallbackExt: string) {
  const raw = (value ?? "").trim();
  const base = raw.replace(/[/\\<>:"|?*\u0000-\u001f]/g, "_").replace(/\s+/g, "_");
  if (!base) return `arquivo.${fallbackExt}`;
  if (!base.includes(".")) return `${base}.${fallbackExt}`;
  return base.slice(0, 180);
}

function inferMimeType(filename: string, mimetype: string) {
  const trimmed = mimetype.split(";")[0]?.trim().toLowerCase() ?? "";
  if (trimmed && trimmed !== "application/octet-stream") return trimmed;
  const ext = extensionFromName(filename);
  return EXTENSION_MIME[ext] ?? trimmed;
}

function isBlockedMime(mimetype: string) {
  const normalized = mimetype.toLowerCase();
  return BLOCKED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isSupportedMime(mimetype: string) {
  const normalized = mimetype.toLowerCase();
  if (normalized.startsWith("image/")) return true;
  if (normalized.startsWith("video/")) return true;
  if (normalized.startsWith("audio/")) return true;
  if (normalized === "application/pdf") return true;
  if (normalized === "text/plain") return true;
  if (normalized.includes("word") || normalized.includes("excel") || normalized.includes("spreadsheet")) return true;
  if (normalized === "application/msword") return true;
  if (normalized.startsWith("application/vnd.")) return true;
  return false;
}

export function normalizeInboxUpload(file: {
  buffer: Buffer;
  mimetype: string;
  filename?: string;
}): NormalizedInboxUpload {
  const sizeBytes = file.buffer.length;
  if (!sizeBytes) {
    throw new Error("Arquivo vazio. Selecione um arquivo valido.");
  }
  if (sizeBytes > MAX_INBOX_MEDIA_BYTES) {
    throw new Error(`Arquivo muito grande. Limite maximo: ${Math.round(MAX_INBOX_MEDIA_BYTES / (1024 * 1024))} MB.`);
  }

  const provisionalName = sanitizeFilename(file.filename, "bin");
  const mimetype = inferMimeType(provisionalName, file.mimetype);
  if (!mimetype || mimetype === "application/octet-stream") {
    throw new Error("Tipo de arquivo nao suportado. Envie imagem, video, audio, PDF ou documento.");
  }
  if (isBlockedMime(mimetype)) {
    throw new Error("Tipo de arquivo nao permitido por seguranca.");
  }
  if (!isSupportedMime(mimetype)) {
    throw new Error("Tipo de arquivo nao suportado. Use imagem, video, audio, PDF ou documento.");
  }

  const mediatype = mediaTypeFromMime(mimetype);
  const ext = extensionFromName(provisionalName);
  const fallbackExt =
    (ext && EXTENSION_MIME[ext] ? ext : null) ??
    Object.entries(EXTENSION_MIME).find(([, mime]) => mime === mimetype)?.[0] ??
    (mediatype === "image" ? "jpg" : mediatype === "audio" ? "ogg" : mediatype === "video" ? "mp4" : "pdf");
  const filename = sanitizeFilename(file.filename, fallbackExt);

  return {
    buffer: file.buffer,
    mimetype,
    filename,
    mediatype,
    sizeBytes
  };
}
