import type { Prisma } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../lib/prisma";
import { emitToTenant } from "../../lib/realtime";
import { uploadsRoot } from "../../lib/media-storage";
import { createTranscriptionProvider } from "./create-transcription-provider";

function rawObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

async function resolveMediaBuffer(tenantId: string, mediaUrl: string) {
  const filename = path.basename(mediaUrl.split("?")[0] ?? mediaUrl);
  const filePath = path.join(uploadsRoot(), tenantId, filename);
  return readFile(filePath);
}

export async function transcribeInboundAudio(tenantId: string, messageId: string) {
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      direction: "in",
      type: "audio",
      conversation: { tenantId }
    },
    include: { conversation: true }
  });
  if (!message) throw new Error("Audio nao encontrado para transcricao.");
  if (!message.mediaUrl) throw new Error("Midia de audio indisponivel.");

  const raw = rawObject(message.raw);
  await prisma.message.update({
    where: { id: message.id },
    data: {
      raw: {
        ...raw,
        transcriptionStatus: "processing"
      } as Prisma.InputJsonObject
    }
  });

  try {
    const buffer = await resolveMediaBuffer(tenantId, message.mediaUrl);
    const provider = createTranscriptionProvider();
    const result = await provider.transcribe({ buffer, mimeType: "audio/ogg", language: "pt" });
    const updated = await prisma.message.update({
      where: { id: message.id },
      data: {
        raw: {
          ...raw,
          transcription: result.text,
          transcriptionStatus: "done",
          transcriptionProvider: result.provider,
          transcribedAt: new Date().toISOString()
        } as Prisma.InputJsonObject
      }
    });
    emitToTenant(tenantId, "inbox:message", { conversation: message.conversation, message: updated });
    return updated;
  } catch (error) {
    const updated = await prisma.message.update({
      where: { id: message.id },
      data: {
        raw: {
          ...raw,
          transcriptionStatus: "failed",
          transcriptionError: error instanceof Error ? error.message : String(error)
        } as Prisma.InputJsonObject
      }
    });
    emitToTenant(tenantId, "inbox:message", { conversation: message.conversation, message: updated });
    throw error;
  }
}
