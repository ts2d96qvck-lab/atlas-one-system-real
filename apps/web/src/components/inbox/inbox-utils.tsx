"use client";

import { useState } from "react";
import type { Message, SessionUser, UserRow } from "../../lib/api";
import { apiUrl } from "../../lib/config";
import { mediaSrc } from "../../lib/messages";
import {
  conversationStatusLabel,
  CONVERSATION_STATUS_SHORT,
  roleLabel as productRoleLabel
} from "../../lib/product-copy";
import type { CompanySettings } from "../../lib/api";

export const ROLE_TO_DEPARTMENT: Record<string, string> = {
  owner: "Diretoria",
  admin: "Gestão",
  supervisor: "Supervisão",
  agent: "Atendimento"
};

export function formatTime(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function statusLabel(status: string) {
  return conversationStatusLabel(status);
}

export function statusShortLabel(status: string) {
  return CONVERSATION_STATUS_SHORT[status] ?? status.slice(0, 8);
}

export function statusMetaTone(status: string) {
  if (status === "archived" || status === "closed") return "text-slate-500";
  if (status === "resolved") return "text-emerald-600/90";
  if (status === "waiting_customer") return "text-amber-600/90";
  if (status === "waiting_internal") return "text-violet-600/90";
  return "text-slate-600";
}

export function statusDotClass(status: string) {
  if (status === "archived" || status === "closed") return "bg-slate-400";
  if (status === "resolved") return "bg-emerald-500";
  if (status === "waiting_customer") return "bg-amber-400";
  if (status === "waiting_internal") return "bg-violet-500";
  return "bg-sky-500";
}

export function mediaUploadKey(conversationId: string, file: File) {
  return `${conversationId}:${file.name}:${file.size}:${file.lastModified}:${file.type}`;
}

export function avatarPalette(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash << 5) - hash + seed.charCodeAt(i);
  const palettes = [
    ["from-blue-300/80", "to-cyan-300/80"],
    ["from-violet-300/80", "to-fuchsia-300/80"],
    ["from-emerald-300/80", "to-teal-300/80"],
    ["from-amber-300/80", "to-orange-300/80"]
  ] as const;
  return palettes[Math.abs(hash) % palettes.length];
}

export function normalizeAvatarUrl(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("data:image/")) return trimmed;
  if (trimmed.startsWith("/media/")) return trimmed;
  return null;
}

export function resolveDisplayAvatar(value?: string | null, accessToken?: string) {
  const normalized = normalizeAvatarUrl(value);
  if (!normalized) return null;
  if (normalized.startsWith("/media/")) return mediaSrc(normalized, apiUrl(), accessToken);
  return normalized;
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

export async function compressImageFile(file: File, maxSide = 512) {
  const dataUrl = await readFileAsDataUrl(file);
  if (!file.type.startsWith("image/")) return dataUrl;
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Imagem invalida"));
    img.src = dataUrl;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function formatPhoneDisplay(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return `+${digits}`;
  if (digits.length === 12) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
  if (digits.length === 13) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
  return `+${digits}`;
}

export function normalizeWhatsAppNumber(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

export function roleLabel(role?: string) {
  if (!role) return "Atendimento";
  return ROLE_TO_DEPARTMENT[role] ?? productRoleLabel(role);
}

export function agentDepartment(agent: UserRow) {
  return agent.team?.name || roleLabel(agent.role);
}

function normalizeMediaLabel(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[[\]]/g, "");
}

export function genericMediaText(text?: string | null) {
  if (!text) return false;
  const normalized = normalizeMediaLabel(text);
  return (
    ["audio", "image", "video", "document", "mídia", "media", "arquivo", "figurinha", "sticker"].includes(normalized) ||
    /^(audio|video|imagem|documento|mídia)\s*$/i.test(text.trim())
  );
}

export function shouldShowMessageText(message: Message) {
  if (!message.text?.trim()) return false;
  if (message.type === "text") return true;
  if (message.mediaUrl && genericMediaText(message.text)) return false;
  return !genericMediaText(message.text);
}

export function fileNameFromMessage(message: Message) {
  if (message.text && !genericMediaText(message.text)) return message.text;
  if (!message.mediaUrl) return "Arquivo";
  const parts = message.mediaUrl.split("/");
  return decodeURIComponent(parts[parts.length - 1] || "Arquivo");
}

export function mediaPreviewKind(file: File) {
  if (file.type.startsWith("image/")) return "image" as const;
  if (file.type.startsWith("video/")) return "video" as const;
  if (file.type.startsWith("audio/")) return "audio" as const;
  return "document" as const;
}

export function profilePhotoStorageKey(tenantId: string, userId: string) {
  return `atlas-one-internal-avatar:${tenantId}:${userId}`;
}

export function messageSenderLabel(raw: Record<string, unknown>, outgoing: boolean) {
  const sentByName = typeof raw.sentByName === "string" ? raw.sentByName : null;
  const senderType = typeof raw.senderType === "string" ? raw.senderType : outgoing ? "agent" : "customer";
  if (senderType === "bot") return sentByName ? `Robo · ${sentByName}` : "Robo";
  if (senderType === "system") return sentByName ?? "Sistema";
  if (outgoing) return sentByName ?? "Atendente";
  return "Cliente";
}

export function buildSignaturePreview(
  draft: string,
  user: SessionUser,
  messaging?: CompanySettings["messaging"]
) {
  if (!draft || !messaging || messaging.signaturePlacement === "disabled" || !messaging.showAgentNameToCustomer) {
    return null;
  }
  const signature = (messaging.agentSignatureFormat || "Atendente {{agentName}}:").replace(
    /\{\{agentName\}\}/g,
    user.name
  );
  if (messaging.signaturePlacement === "before") return `${signature}\n${draft}`;
  return `${draft}\n${signature}`;
}

export function CustomerAvatar({
  name,
  phone,
  avatarUrl,
  size = "md",
  accessToken
}: {
  name: string;
  phone: string;
  avatarUrl?: string | null;
  size?: "sm" | "md";
  accessToken?: string;
}) {
  const initialsLabel = initials(name || phone || "?");
  const [from, to] = avatarPalette(`${name}-${phone}`) ?? ["from-blue-300/80", "to-cyan-300/80"];
  const classes = size === "sm" ? "h-9 w-9 text-[11px]" : "h-10 w-10 text-xs";
  const [broken, setBroken] = useState(false);
  const safeAvatarUrl = resolveDisplayAvatar(avatarUrl, accessToken);

  if (safeAvatarUrl && !broken) {
    return (
      <img
        src={safeAvatarUrl}
        alt={`Foto de ${name}`}
        onError={() => setBroken(true)}
        className={`${classes} shrink-0 rounded-full border border-white/70 object-cover`}
      />
    );
  }

  return (
    <div
      className={`grid ${classes} shrink-0 place-items-center rounded-full border border-white/70 bg-gradient-to-br ${from} ${to} font-semibold text-slate-700`}
      title={name}
      aria-label={`Avatar de ${name}`}
    >
      {initialsLabel}
    </div>
  );
}
