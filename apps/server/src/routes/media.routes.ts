import type { FastifyInstance } from "fastify";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { resolveSessionUser } from "../lib/session";
import { uploadsRoot } from "../lib/media-storage";
import { sendError } from "../utils/http";

const MIME_BY_EXT: Record<string, string> = {
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg; codecs=opus",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
  ".webm": "audio/webm",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf"
};

function mimeFromFilename(filename: string) {
  const lower = filename.toLowerCase();
  const ext = path.extname(lower.split(";")[0] ?? lower);
  if (MIME_BY_EXT[ext]) return MIME_BY_EXT[ext];
  // Arquivos legados salvos como "msgId.ogg; codecs=opus"
  if (lower.includes(".ogg") || lower.includes("opus")) return "audio/ogg; codecs=opus";
  if (lower.includes(".mp3")) return "audio/mpeg";
  if (lower.includes(".m4a")) return "audio/mp4";
  if (lower.includes(".webm")) return "audio/webm";
  if (lower.includes(".mp4") && !lower.includes(".m4a")) return "video/mp4";
  return null;
}

function sniffAudioMime(filePath: string) {
  try {
    const head = readFileSync(filePath).subarray(0, 4);
    if (head.toString("utf8") === "OggS") return "audio/ogg; codecs=opus";
    if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) return "audio/mpeg";
    if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return "audio/webm";
  } catch {
    /* ignore */
  }
  return null;
}

function mimeForFile(filePath: string, filename: string) {
  return (
    mimeFromFilename(filename) ??
    mimeFromFilename(path.basename(filePath)) ??
    sniffAudioMime(filePath) ??
    "application/octet-stream"
  );
}

export async function mediaRoutes(app: FastifyInstance) {
  app.get("/:tenantId/:filename", async (request, reply) => {
    const header = request.headers.authorization;
    const queryToken = (request.query as { token?: string }).token;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : queryToken ?? null;
    if (!token) return sendError(reply, 401, "Acesso negado a midia");

    const user = await resolveSessionUser(token);
    if (!user) return sendError(reply, 401, "Sessao invalida");

    const { tenantId, filename } = request.params as { tenantId: string; filename: string };
    if (user.tenantId !== tenantId) return sendError(reply, 403, "Midia de outra empresa");

    const safeName = path.basename(filename);
    if (safeName !== filename || safeName.includes("..")) {
      return sendError(reply, 400, "Arquivo invalido");
    }

    const filePath = path.join(uploadsRoot(), tenantId, safeName);
    if (!existsSync(filePath)) return sendError(reply, 404, "Arquivo nao encontrado");

    const contentType = mimeForFile(filePath, safeName);
    reply.header("Content-Type", contentType);
    reply.header("Accept-Ranges", "bytes");
    reply.header("Cache-Control", "private, max-age=3600");
    return reply.send(createReadStream(filePath));
  });
}
