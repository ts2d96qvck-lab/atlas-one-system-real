import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");

function normalizeMime(mimeType?: string) {
  return (mimeType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

function extensionFromMime(mimeType?: string) {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "audio/ogg": "ogg",
    "audio/opus": "ogg",
    "audio/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "application/pdf": "pdf"
  };
  const normalized = normalizeMime(mimeType);
  if (map[normalized]) return map[normalized];
  if (!normalized) return "bin";
  const sub = normalized.split("/")[1]?.split("+")[0];
  if (sub && /^[a-z0-9]+$/.test(sub)) return sub;
  return "bin";
}

export function uploadsRoot() {
  return UPLOAD_ROOT;
}

export async function saveMediaBase64(
  tenantId: string,
  messageId: string,
  base64: string,
  mimeType?: string
) {
  const dir = path.join(UPLOAD_ROOT, tenantId);
  await mkdir(dir, { recursive: true });
  const ext = extensionFromMime(mimeType);
  const fileName = `${messageId}.${ext}`;
  const clean = base64.replace(/^data:[^;]+;base64,/, "");
  await writeFile(path.join(dir, fileName), Buffer.from(clean, "base64"));
  return `/media/${tenantId}/${fileName}`;
}

export function publicMediaUrl(relativePath: string, apiBase: string) {
  if (relativePath.startsWith("http")) return relativePath;
  return `${apiBase.replace(/\/$/, "")}${relativePath}`;
}
