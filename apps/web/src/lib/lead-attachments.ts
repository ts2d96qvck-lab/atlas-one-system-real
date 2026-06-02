import type { LeadAttachment } from "./api";
import { apiUrl } from "./config";

export const LEAD_ATTACHMENT_CATEGORY_LABELS: Record<string, string> = {
  pdf: "PDF",
  image: "Imagem",
  audio: "Áudio",
  proposal: "Proposta",
  contract: "Contrato",
  other: "Outro"
};

export function leadAttachmentCategoryLabel(category: string) {
  return LEAD_ATTACHMENT_CATEGORY_LABELS[category] ?? "Outro";
}

export function leadAttachmentMediaUrl(fileUrl: string, token: string, baseUrl = apiUrl()) {
  const base = `${baseUrl.replace(/\/$/, "")}${fileUrl}`;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}token=${encodeURIComponent(token)}`;
}

export function canOpenLeadAttachmentInline(mimeType: string) {
  const lower = mimeType.toLowerCase();
  return lower.startsWith("image/") || lower.startsWith("audio/") || lower.includes("pdf");
}

export async function downloadLeadAttachment(token: string, attachment: LeadAttachment) {
  const url = leadAttachmentMediaUrl(attachment.fileUrl, token);
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Não foi possível baixar o arquivo.");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = attachment.fileName || "anexo";
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
