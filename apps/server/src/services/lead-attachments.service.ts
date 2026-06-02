import { z } from "zod";
import { prisma } from "../lib/prisma";
import { saveMediaBase64 } from "../lib/media-storage";

const categorySchema = z.enum(["pdf", "image", "audio", "proposal", "contract", "other"]);

function inferCategory(mimeType: string, fileName: string) {
  const lower = `${mimeType} ${fileName}`.toLowerCase();
  if (lower.includes("pdf")) return "pdf";
  if (lower.startsWith("image/")) return "image";
  if (lower.startsWith("audio/")) return "audio";
  if (lower.includes("proposta") || lower.includes("proposal")) return "proposal";
  if (lower.includes("contrato") || lower.includes("contract")) return "contract";
  return "other";
}

export async function listLeadAttachments(tenantId: string, leadId: string) {
  return prisma.leadAttachment.findMany({
    where: { tenantId, leadId },
    orderBy: { createdAt: "desc" }
  });
}

export async function createLeadAttachment(
  tenantId: string,
  leadId: string,
  actorId: string,
  input: { buffer: Buffer; mimetype: string; filename: string; category?: string }
) {
  const lead = await prisma.lead.findFirst({ where: { tenantId, id: leadId } });
  if (!lead) throw new Error("Lead nao encontrado.");

  const base64 = input.buffer.toString("base64");
  const attachmentId = `lead-${Date.now()}`;
  const fileUrl = await saveMediaBase64(tenantId, attachmentId, base64, input.mimetype);
  const category = categorySchema.safeParse(input.category).success
    ? (input.category as z.infer<typeof categorySchema>)
    : inferCategory(input.mimetype, input.filename);

  return prisma.leadAttachment.create({
    data: {
      tenantId,
      leadId,
      uploadedById: actorId,
      fileName: input.filename,
      mimeType: input.mimetype,
      fileUrl,
      category
    }
  });
}

export async function deleteLeadAttachment(tenantId: string, leadId: string, attachmentId: string) {
  const row = await prisma.leadAttachment.findFirst({ where: { tenantId, leadId, id: attachmentId } });
  if (!row) throw new Error("Anexo nao encontrado.");
  await prisma.leadAttachment.delete({ where: { id: attachmentId } });
  return row;
}
