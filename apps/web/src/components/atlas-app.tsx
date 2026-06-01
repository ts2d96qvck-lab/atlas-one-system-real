"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCheck,
  Clock3,
  CornerUpLeft,
  FileText,
  Filter,
  Loader2,
  LogOut,
  MessageCircle,
  Mic,
  MoreVertical,
  Paperclip,
  Plus,
  Search,
  Send,
  Square,
  Trash2,
  User,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import { Button, Card, Popover, PopoverContent, PopoverTrigger } from "@atlas-one/ui";
import {
  createConversation,
  deleteConversation,
  deleteMessage,
  editMessage,
  getConversation,
  getCompanySettings,
  listConversations,
  listInboxShortcuts,
  listInboxTags,
  listTeams,
  listUsers,
  uploadUserAvatar,
  logout as apiLogout,
  sendMediaFile,
  sendMessage,
  transcribeMessage,
  updateConversation,
  updateLead,
  type Conversation,
  type CompanySettings,
  type Message,
  type SessionUser,
  type ShortcutItem,
  type TagCatalogItem,
  type TeamRow,
  type UserRow
} from "../lib/api";
import { connectRealtime, joinTenant } from "../lib/socket";
import { SecureMedia } from "./secure-media";
import { QuickRepliesMenu } from "./quick-replies-menu";
import { TagFilterPopover } from "./conversation-tags";
import { ConversationDrawer, type ConversationDrawerTab } from "./conversation-drawer";
import { AppCombobox } from "./ui/app-select";
import { apiUrl } from "../lib/config";
import { conversationDisplayTags, mergeConversationTags } from "../lib/inbox-tags";
import { mergeMessages, mediaSrc, messageDeliveryStatus, groupMessagesForThread } from "../lib/messages";
import { hasPermission } from "../lib/session-user";
import {
  dispatchInboundNotification,
  getNotificationPermission,
  loadLastSeenMap,
  loadNotificationPrefs,
  persistLastSeenMap,
  requestInboxNotificationPermission,
  saveNotificationPrefs,
  type InboxNotificationPrefs
} from "../lib/inbox-notifications";

type Props = { token: string; user: SessionUser };
const ROLE_TO_DEPARTMENT: Record<string, string> = {
  owner: "Diretoria",
  admin: "Administrativo",
  supervisor: "Supervisao",
  agent: "Atendimento"
};

function formatTime(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    open: "Aberto",
    waiting_customer: "Aguardando",
    closed: "Fechado"
  };
  return map[status] ?? status;
}

function statusShortLabel(status: string) {
  const map: Record<string, string> = {
    open: "Aberto",
    waiting_customer: "Aguard.",
    closed: "Fechado"
  };
  return map[status] ?? status.slice(0, 8);
}

function conversationAvatarFromTags(tags: unknown) {
  if (!Array.isArray(tags)) return null;
  const found = tags.find((tag) => typeof tag === "string" && tag.startsWith("avatar:"));
  if (typeof found !== "string") return null;
  return normalizeAvatarUrl(found.slice("avatar:".length).trim());
}

function formatPhoneDisplay(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") && digits.length >= 12
    ? `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`
    : `+${digits}`;
}

function conversationDepartment(conversation: Conversation) {
  return conversation.team?.name ?? "—";
}

function conversationAgentLabel(conversation: Conversation) {
  return conversation.assignedTo?.name ?? "Sem responsavel";
}

function mediaUploadKey(conversationId: string, file: File) {
  return `${conversationId}:${file.name}:${file.size}:${file.lastModified}:${file.type}`;
}

function avatarPalette(seed: string) {
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

function normalizeAvatarUrl(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("data:image/")) return trimmed;
  if (trimmed.startsWith("/media/")) return trimmed;
  return null;
}

function resolveDisplayAvatar(value?: string | null, accessToken?: string) {
  const normalized = normalizeAvatarUrl(value);
  if (!normalized) return null;
  if (normalized.startsWith("/media/")) return mediaSrc(normalized, apiUrl(), accessToken);
  return normalized;
}

async function compressImageFile(file: File, maxSide = 512) {
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

function normalizeWhatsAppNumber(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

function CustomerAvatar({
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

function roleLabel(role?: string) {
  if (!role) return "Atendimento";
  return ROLE_TO_DEPARTMENT[role] ?? role;
}

function agentDepartment(agent: UserRow) {
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

function genericMediaText(text?: string | null) {
  if (!text) return false;
  const normalized = normalizeMediaLabel(text);
  return (
    ["audio", "image", "video", "document", "midia", "media", "arquivo", "figurinha", "sticker"].includes(normalized) ||
    /^(audio|video|imagem|documento|midia)\s*$/i.test(text.trim())
  );
}

function shouldShowMessageText(message: Message) {
  if (!message.text?.trim()) return false;
  if (message.type === "text") return true;
  if (message.mediaUrl && genericMediaText(message.text)) return false;
  return !genericMediaText(message.text);
}

function fileNameFromMessage(message: Message) {
  if (message.text && !genericMediaText(message.text)) return message.text;
  if (!message.mediaUrl) return "Arquivo";
  const parts = message.mediaUrl.split("/");
  return decodeURIComponent(parts[parts.length - 1] || "Arquivo");
}

function mediaPreviewKind(file: File) {
  if (file.type.startsWith("image/")) return "image" as const;
  if (file.type.startsWith("video/")) return "video" as const;
  if (file.type.startsWith("audio/")) return "audio" as const;
  return "document" as const;
}

function MediaMessageRenderer({ message, token }: { message: Message; token: string }) {
  if (!message.mediaUrl) return null;

  if (message.type === "image") {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white/70">
        <SecureMedia path={message.mediaUrl} token={token} type="image" alt="Imagem enviada" />
      </div>
    );
  }

  if (message.type === "audio") {
    return <SecureMedia path={message.mediaUrl} token={token} type="audio" />;
  }

  if (message.type === "video") {
    return <SecureMedia path={message.mediaUrl} token={token} type="video" />;
  }

  if (message.type === "document") {
    return (
      <SecureMedia
        path={message.mediaUrl}
        token={token}
        type="document"
        fileName={fileNameFromMessage(message)}
      />
    );
  }

  return null;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

function profilePhotoStorageKey(tenantId: string, userId: string) {
  return `atlas-one-internal-avatar:${tenantId}:${userId}`;
}

function messageStatusView(status: string, edited: boolean) {
  const normalized = status.toLowerCase();
  if (normalized.includes("read")) {
    return { icon: <CheckCheck size={12} />, label: "Lida", tone: "text-slate-500", badge: "bg-slate-100 text-slate-600" };
  }
  if (normalized.includes("deliver")) {
    return { icon: <CheckCheck size={12} />, label: "Entregue", tone: "text-slate-500", badge: "bg-slate-100 text-slate-600" };
  }
  if (normalized.includes("fail") || normalized.includes("error") || normalized.includes("undeliver")) {
    return { icon: <AlertTriangle size={12} />, label: "Falhou", tone: "text-slate-500", badge: "bg-slate-100 text-slate-600" };
  }
  if (normalized.includes("queue") || normalized.includes("pending") || normalized.includes("sending")) {
    return { icon: <Clock3 size={12} />, label: "Enviando", tone: "text-slate-400", badge: "bg-slate-100 text-slate-600" };
  }
  if (normalized.includes("received")) {
    return { icon: <MessageCircle size={12} />, label: "Recebida", tone: "text-slate-600", badge: "bg-slate-100 text-slate-700" };
  }
  return {
    icon: <Send size={12} />,
    label: edited ? "Enviada · editada" : "Enviada",
    tone: "text-slate-600",
    badge: "bg-slate-100 text-slate-700"
  };
}

function MessageBubble({
  message,
  token,
  onReply,
  canManage,
  onDelete,
  onEdit,
  onTranscribe,
  clustered,
  clusterFirst,
  clusterLast
}: {
  message: Message;
  token: string;
  onReply: (message: Message) => void;
  canManage?: boolean;
  onDelete?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onTranscribe?: (message: Message) => void;
  clustered?: boolean;
  clusterFirst?: boolean;
  clusterLast?: boolean;
}) {
  const outgoing = message.direction === "out";
  const raw = (message.raw && typeof message.raw === "object" ? message.raw : {}) as Record<string, unknown>;
  const deleted = Boolean(raw.deletedAt) || message.status === "deleted";
  const edited = Boolean(raw.editedAt) || message.status === "edited";
  const [menuOpen, setMenuOpen] = useState(false);
  const showText = shouldShowMessageText(message);
  const displayText =
    typeof raw.contentRaw === "string" && raw.contentRaw.length > 0 ? raw.contentRaw : message.text ?? "";
  const replyTo = (raw.replyTo && typeof raw.replyTo === "object" ? raw.replyTo : null) as Record<string, unknown> | null;
  const replyText = replyTo && typeof replyTo.text === "string" ? replyTo.text : "";
  const transcription = typeof raw.transcription === "string" ? raw.transcription : "";
  const transcriptionStatus = typeof raw.transcriptionStatus === "string" ? raw.transcriptionStatus : "";
  const transcriptionError = typeof raw.transcriptionError === "string" ? raw.transcriptionError : "";
  const reactionList = Array.isArray(raw.reactions) ? raw.reactions : [];
  const reactionMap = new Map<string, number>();
  for (const item of reactionList) {
    if (!item || typeof item !== "object") continue;
    const emoji = typeof (item as Record<string, unknown>).emoji === "string" ? String((item as Record<string, unknown>).emoji).trim() : "";
    if (!emoji) continue;
    reactionMap.set(emoji, (reactionMap.get(emoji) ?? 0) + 1);
  }
  const reactions = Array.from(reactionMap.entries());
  const deliveryStatus = messageDeliveryStatus(message);
  const statusView = deleted
    ? { icon: <Trash2 size={12} />, label: "Apagada", tone: "text-slate-400", badge: "bg-slate-100 text-slate-500" }
    : messageStatusView(deliveryStatus, edited);
  const failureReason = typeof raw.failureReason === "string" ? raw.failureReason : typeof raw.lastProviderStatus === "string" ? raw.lastProviderStatus : "";

  if (deleted) {
    return (
      <div className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs italic text-slate-500">
          Mensagem apagada
        </div>
      </div>
    );
  }

  return (
    <div className={`group flex ${outgoing ? "justify-end" : "justify-start"} ${clustered && !clusterFirst ? "-mt-1.5" : ""}`}>
      <div
        onDoubleClick={() => onReply(message)}
        className={`relative z-10 max-w-[88%] overflow-hidden break-words rounded-2xl px-3 py-2 text-[13px] leading-5 sm:max-w-[78%] xl:max-w-[340px] ${
          outgoing
            ? `bg-slate-100 text-slate-900 ${clusterLast === false ? "rounded-br-sm" : "rounded-br-md"} ${clustered && !clusterFirst ? "rounded-tr-sm" : ""}`
            : `bg-white text-slate-800 ring-1 ring-slate-100 ${clusterLast === false ? "rounded-bl-sm" : "rounded-bl-md"} ${clustered && !clusterFirst ? "rounded-tl-sm" : ""}`
        }`}
      >
        {clustered && !clusterFirst ? null : outgoing ? (
        <div className="mb-1 flex items-center justify-end gap-2">
          {canManage ? (
            <div className="relative">
              <button
                type="button"
                className="rounded-md p-0.5 text-slate-400 opacity-0 transition hover:bg-white/70 hover:text-slate-600 group-hover:opacity-100"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Acoes da mensagem"
              >
                <MoreVertical size={12} />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                  {message.type === "text" && onEdit ? (
                    <button type="button" className="block w-full rounded-lg px-2 py-1.5 text-left text-[11px] hover:bg-slate-50" onClick={() => { onEdit(message); setMenuOpen(false); }}>
                      Editar
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button type="button" className="block w-full rounded-lg px-2 py-1.5 text-left text-[11px] text-slate-600 hover:bg-slate-50" onClick={() => { onDelete(message); setMenuOpen(false); }}>
                      Apagar
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        ) : null}
        {replyTo ? (
          <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1">
            <p className="text-[10px] font-semibold text-slate-600">Resposta direcionada</p>
            <p className="truncate whitespace-pre-wrap text-[11px] text-slate-500">{replyText || "[Mensagem]"}</p>
          </div>
        ) : null}
        {message.type !== "text" ? (
          <div className="mb-2">
            <MediaMessageRenderer message={message} token={token} />
          </div>
        ) : null}
        {showText ? <p className="whitespace-pre-wrap break-words">{displayText}</p> : null}
        {message.type === "audio" ? (
          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
            {transcriptionStatus === "processing" ? (
              <p className="text-[11px] text-slate-500">Transcrevendo audio...</p>
            ) : transcription ? (
              <p className="whitespace-pre-wrap text-[11px] text-slate-700">{transcription}</p>
            ) : transcriptionError ? (
              <p className="text-[11px] text-rose-600">{transcriptionError}</p>
            ) : onTranscribe ? (
              <button type="button" className="text-[11px] font-medium text-slate-600 hover:underline" onClick={() => onTranscribe(message)}>
                Transcrever audio
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-slate-400">
          {edited ? <span className="text-slate-400">editada</span> : null}
          {outgoing ? (
            <span className={`inline-flex items-center ${statusView.tone}`} title={statusView.label} aria-label={`Status: ${statusView.label}`}>
              {statusView.icon}
            </span>
          ) : null}
          <span>{formatTime(message.createdAt)}</span>
        </div>
        {failureReason && deliveryStatus.includes("fail") ? (
          <p className="mt-1 text-[10px] text-rose-600">Falha: {failureReason}</p>
        ) : null}
        {reactions.length ? (
          <div className="mt-2 flex flex-wrap justify-end gap-1">
            {reactions.map(([emoji, count]) => (
              <span key={emoji} className="rounded-full border border-slate-200 bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-700">
                {emoji} {count}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type ConversationHeaderBarProps = {
  active: Conversation;
  accessToken: string;
  onOpenDrawer: () => void;
};

function ConversationHeaderBar({ active, accessToken, onOpenDrawer }: ConversationHeaderBarProps) {
  const avatarUrl = conversationAvatarFromTags(active.tags);
  const phoneLine = formatPhoneDisplay(active.customerPhone);
  const instanceLine = active.instance?.label ?? active.instance?.name ?? "";
  const contextLine = [phoneLine, instanceLine].filter(Boolean).join(" · ");
  const metaLine = `${statusLabel(active.status)} · ${conversationAgentLabel(active)} · ${conversationDepartment(active)}`;

  return (
    <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-3 py-1.5 sm:px-4">
      <CustomerAvatar
        name={active.customerName}
        phone={active.customerPhone}
        avatarUrl={avatarUrl}
        size="sm"
        accessToken={accessToken}
      />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[13px] font-semibold leading-tight text-slate-900">{active.customerName}</p>
          <span className="hidden text-slate-300 sm:inline">·</span>
          <p className="hidden min-w-0 flex-1 truncate text-[11px] leading-tight text-slate-500 sm:block">{metaLine}</p>
        </div>
        <p className="truncate text-[10px] leading-tight text-slate-500 sm:hidden">{metaLine}</p>
        {contextLine ? <p className="truncate text-[10px] leading-tight text-slate-400">{contextLine}</p> : null}
      </div>
      <button
        type="button"
        className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
        onClick={onOpenDrawer}
      >
        Detalhes
      </button>
    </div>
  );
}

type NewContactModalProps = {
  open: boolean;
  onClose: () => void;
  name: string;
  phone: string;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  disabled: boolean;
};

function NewContactModal({
  open,
  onClose,
  name,
  phone,
  onNameChange,
  onPhoneChange,
  onSubmit,
  disabled
}: NewContactModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/30 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-semibold">Novo contato</p>
            <p className="text-xs text-slate-500">Inicie uma conversa com um cliente</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-50">
            <X size={14} />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <input
            className="atlas-field w-full rounded-lg px-3 py-2 text-sm outline-none"
            placeholder="Nome do cliente"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
          <input
            className="atlas-field w-full rounded-lg px-3 py-2 text-sm outline-none"
            placeholder="WhatsApp com DDD"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !disabled) void onSubmit();
            }}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="glass" className="h-9 px-3 text-xs" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="h-9 px-3 text-xs" disabled={disabled} onClick={() => void onSubmit()}>
            Criar conversa
          </Button>
        </div>
      </div>
    </div>
  );
}

type UserProfileModalProps = {
  open: boolean;
  onClose: () => void;
  user: SessionUser;
  userPhone?: string | null;
  activeInstanceLabel?: string;
  activeDepartment?: string;
  internalPhoto?: string | null;
  onUploadPhoto: (file: File) => Promise<void>;
  onLogout: () => void;
  notificationPrefs: InboxNotificationPrefs;
  onNotificationPrefsChange: (patch: Partial<InboxNotificationPrefs>) => void;
  canMonitorQueue: boolean;
  notifyPermission: NotificationPermission | "unsupported";
  onRequestNotificationPermission: () => void | Promise<void>;
};

function UserProfileModal({
  open,
  onClose,
  user,
  userPhone,
  activeInstanceLabel,
  activeDepartment,
  internalPhoto,
  onUploadPhoto,
  onLogout,
  notificationPrefs,
  onNotificationPrefsChange,
  canMonitorQueue,
  notifyPermission,
  onRequestNotificationPermission
}: UserProfileModalProps) {
  const [uploading, setUploading] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/30 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/70 bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-semibold">Perfil do atendente</p>
            <p className="text-xs text-slate-500">Dados internos da equipe</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 p-1 text-slate-500 hover:bg-slate-50">
            <X size={14} />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          {internalPhoto ? (
            <img src={internalPhoto} alt="Foto interna" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <CustomerAvatar name={user.name} phone={user.email} />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 text-xs">
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-slate-500">Cargo</p>
            <p className="font-semibold text-slate-800">{roleLabel(user.role)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-slate-500">Telefone de cadastro</p>
            <p className="font-semibold text-slate-800">{userPhone ? `+${userPhone}` : "Nao informado"}</p>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-slate-500">Departamento atual</p>
            <p className="font-semibold text-slate-800">{activeDepartment || roleLabel(user.role)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-slate-500">Numero/instancia em uso</p>
            <p className="font-semibold text-slate-800">{activeInstanceLabel || "Sem instancia ativa"}</p>
          </div>
        </div>

        <label className="mt-3 block cursor-pointer rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
          {uploading ? "Enviando foto interna..." : "Enviar foto interna (somente validacao da equipe)"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setUploading(true);
              try {
                await onUploadPhoto(file);
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <p className="text-xs font-semibold text-slate-800">Notificacoes do Inbox</p>
          <p className="mt-1 text-[11px] text-slate-500">Alertas locais para novas mensagens recebidas.</p>
          {notifyPermission === "unsupported" ? (
            <p className="mt-2 text-[11px] text-amber-700">Este navegador nao suporta notificacoes.</p>
          ) : notifyPermission === "denied" ? (
            <p className="mt-2 text-[11px] text-amber-700">
              Notificacoes bloqueadas no navegador. Libere nas configuracoes do site.
            </p>
          ) : notifyPermission === "default" ? (
            <Button
              variant="glass"
              className="mt-2 h-8 px-3 text-xs"
              onClick={() => void onRequestNotificationPermission()}
            >
              Ativar notificacoes
            </Button>
          ) : (
            <p className="mt-2 text-[11px] text-emerald-700">Notificacoes ativas neste navegador.</p>
          )}
          <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
            <span className="inline-flex items-center gap-2 text-slate-700">
              {notificationPrefs.soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              Som ao receber mensagem
            </span>
            <input
              type="checkbox"
              checked={notificationPrefs.soundEnabled}
              onChange={(e) => onNotificationPrefsChange({ soundEnabled: e.target.checked })}
            />
          </label>
          {canMonitorQueue ? (
            <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
              <span className="text-slate-700">Alertar fila sem atendente</span>
              <input
                type="checkbox"
                checked={notificationPrefs.supervisorQueueAlerts}
                onChange={(e) => onNotificationPrefsChange({ supervisorQueueAlerts: e.target.checked })}
              />
            </label>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="glass" className="h-8 px-3 text-xs" onClick={onClose}>
            Fechar
          </Button>
          <Button className="h-8 px-3 text-xs" onClick={onLogout}>
            <LogOut size={13} />
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AtlasApp({ token, user }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [agents, setAgents] = useState<UserRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [draft, setDraft] = useState("");
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([]);
  const [shortcutMenuOpen, setShortcutMenuOpen] = useState(false);
  const [tagCatalog, setTagCatalog] = useState<TagCatalogItem[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagsSaving, setTagsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [recording, setRecording] = useState(false);
  const [pendingAudioFile, setPendingAudioFile] = useState<File | null>(null);
  const [pendingAudioUrl, setPendingAudioUrl] = useState("");
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [pendingUploadUrl, setPendingUploadUrl] = useState("");
  const [pendingUploadCaption, setPendingUploadCaption] = useState("");
  const [newContact, setNewContact] = useState({ name: "", phone: "" });
  const [newContactModalOpen, setNewContactModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<ConversationDrawerTab>("cliente");
  const [contactDraft, setContactDraft] = useState({ customerName: "", customerPhone: "" });
  const [cadenceDraft, setCadenceDraft] = useState("padrao");
  const [transferLoading, setTransferLoading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [internalPhoto, setInternalPhoto] = useState<string | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [lastSeenByConversation, setLastSeenByConversation] = useState<Record<string, number>>(() =>
    loadLastSeenMap(user.tenantId, user.id)
  );
  const [notificationPrefs, setNotificationPrefs] = useState<InboxNotificationPrefs>(() =>
    loadNotificationPrefs(user.tenantId, user.id)
  );
  const [notifyPermission, setNotifyPermission] = useState<NotificationPermission | "unsupported">("default");
  const [activeThreadFlash, setActiveThreadFlash] = useState<string | null>(null);
  const [queueDepartmentId, setQueueDepartmentId] = useState<string>("all");
  const [queueOwnerId, setQueueOwnerId] = useState<string>("all");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const notifyCtxRef = useRef({
    userId: user.id,
    canMonitorQueue: false,
    prefs: notificationPrefs,
    openConversation: (_id: string) => {}
  });
  const sendingTextRef = useRef(false);
  const sendingMediaRef = useRef<string | null>(null);
  const [sendingText, setSendingText] = useState(false);
  const [sendingMediaKey, setSendingMediaKey] = useState<string | null>(null);

  const selfUser = agents.find((agent) => agent.id === user.id) ?? null;

  const agentAvatarFor = useCallback(
    (agentId: string): string | null => {
      const agent = agents.find((item) => item.id === agentId);
      if (agent?.avatarUrl) return resolveDisplayAvatar(agent.avatarUrl, token) ?? null;
      const local = localStorage.getItem(profilePhotoStorageKey(user.tenantId, agentId));
      return local || null;
    },
    [agents, token, user.tenantId]
  );

  const refreshConversations = useCallback(async () => {
    try {
      const items = await listConversations(token);
      setConversations(items);
      return items;
    } catch {
      setConversations([]);
      setError("Inbox temporariamente indisponivel. Tentando reconectar...");
      return [];
    }
  }, [token]);

  const openConversation = useCallback(
    async (id: string) => {
      try {
        const detail = await getConversation(token, id);
        setActiveId(id);
        setActiveConversation(detail);
        setContactDraft({
          customerName: detail.customerName ?? "",
          customerPhone: detail.customerPhone ?? ""
        });
        const cadence = (detail.lead?.customFields as { cadence?: string } | undefined)?.cadence;
        setCadenceDraft(typeof cadence === "string" && cadence ? cadence : "padrao");
        setReplyToMessage(null);
        setLastSeenByConversation((current) => ({ ...current, [id]: Date.now() }));
      } catch {
        setError("Nao foi possivel abrir a conversa agora.");
      }
    },
    [token]
  );

  const saveCadence = useCallback(async () => {
    if (!activeConversation?.lead?.id) return;
    try {
      await updateLead(token, activeConversation.lead.id, {
        customFields: { cadence: cadenceDraft }
      });
      setError("");
    } catch {
      setError("Nao foi possivel salvar cadencia");
    }
  }, [activeConversation?.lead?.id, cadenceDraft, token]);

  useEffect(() => {
    const self = agents.find((item) => item.id === user.id);
    if (self?.avatarUrl) {
      setInternalPhoto(resolveDisplayAvatar(self.avatarUrl, token) ?? null);
      return;
    }
    const saved = localStorage.getItem(profilePhotoStorageKey(user.tenantId, user.id));
    if (saved) setInternalPhoto(saved);
  }, [user.id, user.tenantId, agents, token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [items, users, teamRows] = await Promise.all([
          refreshConversations(),
          listUsers(token),
          listTeams(token).catch(() => [] as TeamRow[])
        ]);
        if (!cancelled) {
          setAgents(users);
          setTeams(teamRows);
        }
        void listInboxShortcuts(token)
          .then((rows) => {
            if (!cancelled) setShortcuts(rows);
          })
          .catch(() => {
            if (!cancelled) setShortcuts([]);
          });
        void listInboxTags(token)
          .then((rows) => {
            if (!cancelled) setTagCatalog(rows);
          })
          .catch(() => {
            if (!cancelled) setTagCatalog([]);
          });
        void getCompanySettings(token)
          .then((settings) => {
            if (!cancelled) setCompanySettings(settings);
          })
          .catch(() => {
            if (!cancelled) setCompanySettings(null);
          });
        if (!cancelled && items[0] && !activeIdRef.current) await openConversation(items[0].id);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const socket = connectRealtime(token);
    joinTenant(user.tenantId, token);

    const onMessage = (payload: { conversation: Conversation; message: Message }) => {
      const ctx = notifyCtxRef.current;
      const conversationForNotify: Conversation = {
        ...payload.conversation,
        messages: mergeMessages(payload.conversation.messages ?? [], payload.message)
      };
      const decision = dispatchInboundNotification({
        message: payload.message,
        conversation: conversationForNotify,
        userId: ctx.userId,
        canMonitorQueue: ctx.canMonitorQueue,
        prefs: ctx.prefs,
        activeConversationId: activeIdRef.current,
        onOpenConversation: (id) => ctx.openConversation(id)
      });
      if (decision.action === "active-thread") {
        setActiveThreadFlash(payload.message.id);
        window.setTimeout(() => setActiveThreadFlash(null), 2200);
      }

      setConversations((current) => {
        const others = current.filter((item) => item.id !== payload.conversation.id);
        return [payload.conversation, ...others].sort((a, b) => {
          const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bt - at;
        });
      });

      if (activeIdRef.current === payload.conversation.id) {
        setActiveConversation((current) => {
          if (!current) return current;
          return {
            ...current,
            ...payload.conversation,
            messages: mergeMessages(current.messages ?? [], payload.message)
          };
        });
        setLastSeenByConversation((current) => ({ ...current, [payload.conversation.id]: Date.now() }));
      }
    };

    socket.on("inbox:message", onMessage);
    return () => {
      cancelled = true;
      socket.off("inbox:message", onMessage);
    };
  }, [token, user.tenantId, openConversation, refreshConversations]);

  const roleIsAgent = user.role === "agent";
  const roleIsManager = user.role === "owner" || user.role === "admin" || user.role === "supervisor";
  const roleCanManageQueues = user.role === "owner" || user.role === "admin";
  const canMonitorByUser = roleCanManageQueues || hasPermission(user, "conversation:takeover");

  useEffect(() => {
    notifyCtxRef.current = {
      userId: user.id,
      canMonitorQueue: canMonitorByUser,
      prefs: notificationPrefs,
      openConversation: (id: string) => {
        void openConversation(id);
      }
    };
  }, [user.id, canMonitorByUser, notificationPrefs, openConversation]);

  useEffect(() => {
    setNotifyPermission(getNotificationPermission());
    void requestInboxNotificationPermission().then((permission) => {
      if (permission !== "unsupported") setNotifyPermission(permission);
    });
  }, []);

  useEffect(() => {
    persistLastSeenMap(user.tenantId, user.id, lastSeenByConversation);
  }, [lastSeenByConversation, user.tenantId, user.id]);

  function updateNotificationPrefs(patch: Partial<InboxNotificationPrefs>) {
    setNotificationPrefs(saveNotificationPrefs(user.tenantId, user.id, patch));
  }

  async function handleRequestNotificationPermission() {
    const permission = await requestInboxNotificationPermission();
    if (permission !== "unsupported") setNotifyPermission(permission);
  }

  const departmentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const team of teams) map.set(team.id, team.name);
    for (const agent of agents) {
      if (agent.teamId && agent.team?.name) map.set(agent.teamId, agent.team.name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => {
        if (a.name === "Novos") return -1;
        if (b.name === "Novos") return 1;
        return a.name.localeCompare(b.name);
      });
  }, [teams, agents]);
  const agentsByDepartment = useMemo(() => {
    if (queueDepartmentId === "all") return agents;
    return agents.filter((agent) => agent.teamId === queueDepartmentId);
  }, [agents, queueDepartmentId]);

  useEffect(() => {
    if (roleIsAgent) {
      setQueueDepartmentId(selfUser?.teamId ?? "all");
      setQueueOwnerId(user.id);
      return;
    }
    if (!canMonitorByUser) {
      setQueueDepartmentId(selfUser?.teamId ?? "all");
      setQueueOwnerId(user.id);
      return;
    }
    const novosTeam = teams.find((team) => team.name === "Novos");
    setQueueDepartmentId(novosTeam?.id ?? "all");
    setQueueOwnerId((current) => current || user.id);
  }, [canMonitorByUser, roleIsAgent, selfUser?.teamId, teams, user.id]);

  useEffect(() => {
    if (queueDepartmentId === "all") return;
    if (queueOwnerId === "all") return;
    const stillInDepartment = agentsByDepartment.some((agent) => agent.id === queueOwnerId);
    if (!stillInDepartment) setQueueOwnerId("all");
  }, [agentsByDepartment, queueDepartmentId, queueOwnerId]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeConversation?.id, activeConversation?.messages?.length]);

  useEffect(() => {
    if (!activeId || !shortcuts.length) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      setShortcutMenuOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeId, shortcuts.length]);

  useEffect(() => {
    if (!activeConversation?.lead?.id) return;
    const timer = setTimeout(() => {
      void saveCadence();
    }, 700);
    return () => clearTimeout(timer);
  }, [cadenceDraft, activeConversation?.lead?.id, saveCadence]);

  const visibleConversations = useMemo(() => {
    if (roleIsAgent) return conversations.filter((item) => item.assignedToId === user.id);
    if (!canMonitorByUser) return conversations.filter((item) => item.assignedToId === user.id);
    const byDepartment =
      queueDepartmentId === "all" ? conversations : conversations.filter((item) => item.teamId === queueDepartmentId);
    if (queueOwnerId === "all") return byDepartment;
    return byDepartment.filter((item) => item.assignedToId === queueOwnerId);
  }, [canMonitorByUser, conversations, queueDepartmentId, queueOwnerId, roleIsAgent, user.id]);

  const pendingUploadKey = useMemo(
    () => (activeId && pendingUploadFile ? mediaUploadKey(activeId, pendingUploadFile) : null),
    [activeId, pendingUploadFile]
  );
  const pendingUploadSending = pendingUploadKey !== null && sendingMediaKey === pendingUploadKey;
  const pendingAudioKey = useMemo(
    () => (activeId && pendingAudioFile ? mediaUploadKey(activeId, pendingAudioFile) : null),
    [activeId, pendingAudioFile]
  );
  const pendingAudioSending = pendingAudioKey !== null && sendingMediaKey === pendingAudioKey;
  const mediaSendLocked = Boolean(sendingMediaKey);

  function isUnreadConversation(item: Conversation) {
    const latest = item.messages?.[0];
    if (!latest || latest.direction !== "in") return false;
    const seenAt = lastSeenByConversation[item.id] ?? 0;
    const latestAt = new Date(latest.createdAt ?? item.lastMessageAt ?? 0).getTime();
    return latestAt > seenAt;
  }

  function isOverdueConversation(item: Conversation) {
    const latest = item.messages?.[0];
    if (!latest || latest.direction !== "in") return false;
    const base = latest.createdAt ?? item.lastMessageAt;
    if (!base) return false;
    const elapsedMs = Date.now() - new Date(base).getTime();
    return elapsedMs >= 5 * 60 * 1000;
  }

  const managerAlertCount = visibleConversations.filter((item) => isOverdueConversation(item)).length;

  const filtered = useMemo(() => {
    let rows = visibleConversations;
    if (tagFilter.length) {
      rows = rows.filter((conversation) => {
        const tags = conversationDisplayTags(conversation.tags);
        return tagFilter.every((selected) =>
          tags.some((tag) => tag.toLowerCase() === selected.toLowerCase())
        );
      });
    }
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (c) =>
        c.customerName.toLowerCase().includes(q) ||
        c.customerPhone.includes(q) ||
        c.lead?.company?.toLowerCase().includes(q)
    );
  }, [visibleConversations, search, tagFilter]);

  async function sendCurrentDraft() {
    if (sendingTextRef.current) return;
    if (!activeId) {
      setError("Aguarde a conversa abrir para enviar a mensagem.");
      return;
    }
    if (!draft.trim()) return;

    sendingTextRef.current = true;
    setSendingText(true);
    const textRaw = draft;
    const shortcutMatch = shortcuts.find((item) => item.tag.toLowerCase() === draft.trim().toLowerCase());
    const text = shortcutMatch ? shortcutMatch.text : textRaw;
    setDraft("");
    try {
      await sendMessage(token, activeId, { text, replyToMessageId: replyToMessage?.id });
      setReplyToMessage(null);
      await openConversation(activeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar");
      setDraft(textRaw);
    } finally {
      sendingTextRef.current = false;
      setSendingText(false);
    }
  }

  function patchActiveMessage(updated: Message) {
    setActiveConversation((current) => {
      if (!current) return current;
      return {
        ...current,
        messages: mergeMessages(current.messages ?? [], updated)
      };
    });
  }

  async function handleDeleteMessage(message: Message) {
    if (!activeId) return;
    if (!window.confirm("Apagar esta mensagem no Atlas One e no WhatsApp do cliente?")) return;
    try {
      const updated = await deleteMessage(token, activeId, message.id);
      patchActiveMessage(updated);
      const raw = (updated.raw && typeof updated.raw === "object" ? updated.raw : {}) as Record<string, unknown>;
      const sync = raw.whatsappSync && typeof raw.whatsappSync === "object" ? (raw.whatsappSync as Record<string, unknown>) : null;
      if (sync?.synced === true) {
        setInfo("Mensagem apagada no Atlas One e no WhatsApp do cliente.");
      } else {
        setInfo("Mensagem apagada no Atlas One. WhatsApp nao sincronizado (sem ID do provedor).");
      }
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel apagar a mensagem");
    }
  }

  async function handleEditMessage(message: Message) {
    if (!activeId) return;
    const raw = (message.raw && typeof message.raw === "object" ? message.raw : {}) as Record<string, unknown>;
    const current = typeof raw.contentRaw === "string" ? raw.contentRaw : message.text ?? "";
    const next = window.prompt("Editar mensagem (Atlas One + WhatsApp do cliente):", current);
    if (next == null || next === current) return;
    try {
      const updated = await editMessage(token, activeId, message.id, next);
      patchActiveMessage(updated);
      const nextRaw = (updated.raw && typeof updated.raw === "object" ? updated.raw : {}) as Record<string, unknown>;
      const sync = nextRaw.whatsappSync && typeof nextRaw.whatsappSync === "object" ? (nextRaw.whatsappSync as Record<string, unknown>) : null;
      if (sync?.synced === true) {
        setInfo("Mensagem editada no Atlas One e no WhatsApp do cliente.");
      } else {
        setInfo("Mensagem editada no Atlas One. WhatsApp nao sincronizado (sem ID do provedor).");
      }
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel editar a mensagem");
    }
  }

  async function handleTranscribeMessage(message: Message) {
    if (!activeId) return;
    try {
      setInfo("Transcrevendo audio...");
      const updated = await transcribeMessage(token, activeId, message.id);
      patchActiveMessage(updated);
      setInfo("Audio transcrito.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcricao indisponivel. Configure OPENAI_API_KEY no servidor.");
    }
  }

  function insertShortcut(shortcut: ShortcutItem) {
    setDraft((current) => {
      const trimmed = current.trim();
      if (!trimmed) return shortcut.text;
      if (trimmed.toLowerCase() === shortcut.tag.toLowerCase()) return shortcut.text;
      return `${current}\n${shortcut.text}`;
    });
    setError("");
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (sendingTextRef.current) return;
    await sendCurrentDraft();
  }

  async function handleFile(file: File) {
    if (!activeId || sendingMediaRef.current) return;
    if (pendingUploadUrl) URL.revokeObjectURL(pendingUploadUrl);
    const kind = mediaPreviewKind(file);
    const previewUrl = kind === "image" || kind === "video" || kind === "audio" ? URL.createObjectURL(file) : "";
    setPendingUploadFile(file);
    setPendingUploadUrl(previewUrl);
    setPendingUploadCaption("");
    setError("");
  }

  async function sendPendingUpload() {
    if (!activeId || !pendingUploadFile) return;
    const uploadKey = mediaUploadKey(activeId, pendingUploadFile);
    if (sendingMediaRef.current === uploadKey) return;

    sendingMediaRef.current = uploadKey;
    setSendingMediaKey(uploadKey);
    try {
      await sendMediaFile(token, activeId, pendingUploadFile, pendingUploadCaption.trim() || undefined);
      if (pendingUploadUrl) URL.revokeObjectURL(pendingUploadUrl);
      setPendingUploadFile(null);
      setPendingUploadUrl("");
      setPendingUploadCaption("");
      setError("");
      await openConversation(activeId);
      await refreshConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar arquivo");
    } finally {
      if (sendingMediaRef.current === uploadKey) {
        sendingMediaRef.current = null;
        setSendingMediaKey(null);
      }
    }
  }

  function discardPendingUpload() {
    if (sendingMediaRef.current) return;
    if (pendingUploadUrl) URL.revokeObjectURL(pendingUploadUrl);
    setPendingUploadFile(null);
    setPendingUploadUrl("");
    setPendingUploadCaption("");
  }

  async function toggleRecord() {
    if (!activeId) return;
    if (recording && recorderRef.current) {
      recorderRef.current.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setPendingAudioFile(file);
        setPendingAudioUrl(url);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("Permita acesso ao microfone para gravar audio");
    }
  }

  async function sendPendingAudio() {
    if (!activeId || !pendingAudioFile) return;
    const uploadKey = mediaUploadKey(activeId, pendingAudioFile);
    if (sendingMediaRef.current === uploadKey) return;

    sendingMediaRef.current = uploadKey;
    setSendingMediaKey(uploadKey);
    try {
      await sendMediaFile(token, activeId, pendingAudioFile);
      if (pendingAudioUrl) URL.revokeObjectURL(pendingAudioUrl);
      setPendingAudioFile(null);
      setPendingAudioUrl("");
      setError("");
      await openConversation(activeId);
      await refreshConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar audio");
    } finally {
      if (sendingMediaRef.current === uploadKey) {
        sendingMediaRef.current = null;
        setSendingMediaKey(null);
      }
    }
  }

  function discardPendingAudio() {
    if (sendingMediaRef.current) return;
    if (pendingAudioUrl) URL.revokeObjectURL(pendingAudioUrl);
    setPendingAudioFile(null);
    setPendingAudioUrl("");
  }

  async function updateActiveTags(displayTags: string[]) {
    if (!activeId || !activeConversation) return;
    setTagsSaving(true);
    try {
      const merged = mergeConversationTags(activeConversation.tags, displayTags);
      await updateConversation(token, activeId, { tags: merged });
      await openConversation(activeId);
      await refreshConversations();
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel atualizar tags");
    } finally {
      setTagsSaving(false);
    }
  }

  async function transferTo(agent: UserRow, transferNote?: string) {
    if (!activeId) return;
    setTransferLoading(true);
    try {
      await updateConversation(token, activeId, {
        assignedToId: agent.id || null,
        teamId: agent.teamId ?? null,
        transferNote
      });
      const items = await refreshConversations();
      const monitorId = roleIsAgent ? user.id : queueOwnerId;
      const movedAway = monitorId !== "all" && agent.id !== monitorId;
      if (movedAway) {
        setActiveConversation(null);
        setActiveId(null);
      } else {
        await openConversation(activeId);
      }
      setInfo(movedAway ? "Conversa transferida e removida da sua fila." : "Atendimento transferido com sucesso.");
      setError("");
      if (movedAway && items[0]) {
        const firstAssigned =
          monitorId === "all" ? items[0] : items.find((item) => item.assignedToId === monitorId) ?? null;
        if (firstAssigned) await openConversation(firstAssigned.id);
      }
    } catch (err) {
      setInfo("");
      setError(err instanceof Error ? err.message : "Falha ao transferir atendimento");
    } finally {
      setTransferLoading(false);
    }
  }

  function getAvatarUrl(tags: unknown) {
    return conversationAvatarFromTags(tags);
  }

  async function handleCreateConversation() {
    if (!newContact.name.trim() || !newContact.phone.trim()) return;
    const normalizedPhone = normalizeWhatsAppNumber(newContact.phone.trim());
    if (!normalizedPhone) {
      setError("Informe um WhatsApp valido para criar o contato.");
      return;
    }
    try {
      const preferredInstance = active?.instance?.name ?? conversations.find((item) => item.instance?.name)?.instance?.name;
      const created = await createConversation(token, {
        ...(preferredInstance ? { instanceName: preferredInstance } : {}),
        customerName: newContact.name.trim(),
        customerPhone: normalizedPhone
      });
      setActiveId(created.id);
      setActiveConversation({ ...created, messages: created.messages ?? [] });
      setNewContact({ name: "", phone: "" });
      setNewContactModalOpen(false);
      await refreshConversations();
      await openConversation(created.id);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao adicionar contato");
    }
  }

  async function handleDeleteActiveConversation() {
    if (!active) return;
    const ok = window.confirm(`Excluir contato ${active.customerName}? Essa acao remove conversa e mensagens.`);
    if (!ok) return;
    try {
      await deleteConversation(token, active.id);
      setActiveConversation(null);
      setActiveId(null);
      const items = await refreshConversations();
      if (items[0]) await openConversation(items[0].id);
      setError("");
      setInfo(`Contato ${active.customerName} excluido com sucesso.`);
    } catch (err) {
      setInfo("");
      setError(err instanceof Error ? err.message : "Falha ao excluir contato");
    }
  }

  async function saveContactIdentity() {
    if (!activeId || !active) return;
    const name = contactDraft.customerName.trim();
    const phone = contactDraft.customerPhone.trim();
    if (!name || !phone) {
      setInfo("");
      setError("Preencha nome e telefone do cliente para salvar.");
      return;
    }
    try {
      await updateConversation(token, activeId, { customerName: name, customerPhone: phone });
      if (activeConversation?.lead?.id) {
        await updateLead(token, activeConversation.lead.id, {
          customFields: { cadence: cadenceDraft }
        });
      }
      await refreshConversations();
      await openConversation(activeId);
      setInfo("Nome/telefone do cliente atualizados.");
      setError("");
    } catch (err) {
      setInfo("");
      setError(err instanceof Error ? err.message : "Falha ao atualizar dados do cliente");
    }
  }

  const active = activeConversation;

  async function setStatusQuick(status: "open" | "waiting_customer" | "closed") {
    if (!active) return;
    try {
      if (status === "closed") {
        await updateConversation(token, active.id, { status, assignedToId: null, teamId: null });
        const items = await refreshConversations();
        if (roleIsAgent) {
          setActiveConversation(null);
          setActiveId(null);
          const nextMine = items.find((item) => item.assignedToId === user.id) ?? null;
          if (nextMine) await openConversation(nextMine.id);
          setInfo("Atendimento finalizado e removido da sua fila.");
        } else {
          await openConversation(active.id);
          setInfo("Atendimento fechado.");
        }
        return;
      }

      await updateConversation(token, active.id, { status });
      await openConversation(active.id);
      setInfo(`Status atualizado: ${statusLabel(status)}.`);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel alterar o status");
    }
  }

  async function uploadInternalPhoto(file: File) {
    try {
      const dataUrl = await compressImageFile(file);
      const uploaded = await uploadUserAvatar(token, dataUrl, "image/jpeg");
      setInternalPhoto(resolveDisplayAvatar(uploaded.avatarUrl, token) ?? null);
      localStorage.setItem(profilePhotoStorageKey(user.tenantId, user.id), dataUrl);
      const users = await listUsers(token);
      setAgents(users);
      setInfo("Foto do atendente salva e visivel para a equipe.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar a foto");
    }
  }

  function logout() {
    void apiLogout(token).catch(() => {});
    localStorage.removeItem("atlas:token");
    localStorage.removeItem("atlas-one-session");
    localStorage.removeItem("atlas-one-session-v2");
    window.location.reload();
  }

  return (
    <main className="mx-auto h-full w-full max-w-[1920px] overflow-hidden p-2 sm:p-2.5">
      <section className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="flex min-h-11 shrink-0 items-center gap-2 border-b border-slate-100 bg-white px-3 py-2 sm:px-4">
          <Search className="shrink-0 text-slate-400" size={17} />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="Buscar conversas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-50"
            title="Perfil"
            onClick={() => setProfileOpen(true)}
          >
            <User size={16} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-px overflow-hidden bg-slate-100 md:grid-cols-[minmax(200px,240px)_minmax(0,1fr)]">
          <Card className="flex min-h-[220px] min-w-0 flex-col rounded-none border-0 bg-white p-0 shadow-none sm:min-h-[260px] md:min-h-0">
            <div className="flex items-center justify-end gap-0.5 border-b border-slate-100 px-2 py-1.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="glass" size="icon" className="h-8 w-8 text-slate-500" title="Filtros">
                    <Filter size={15} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[min(100vw-2rem,300px)] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                  <TagFilterPopover catalog={tagCatalog} selected={tagFilter} onChange={setTagFilter} embedded />
                  {canMonitorByUser ? (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <p className="mb-2 text-[11px] font-medium text-slate-500">Fila</p>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={`rounded-md px-2 py-1 text-[11px] ${
                            queueDepartmentId === "all" ? "bg-slate-100 text-slate-800" : "text-slate-600 hover:bg-slate-50"
                          }`}
                          onClick={() => {
                            setQueueDepartmentId("all");
                            setQueueOwnerId("all");
                          }}
                        >
                          Todos
                        </button>
                        {departmentOptions.map((department) => (
                          <button
                            key={department.id}
                            type="button"
                            className={`rounded-md px-2 py-1 text-[11px] ${
                              queueDepartmentId === department.id ? "bg-slate-100 text-slate-800" : "text-slate-600 hover:bg-slate-50"
                            }`}
                            onClick={() => {
                              setQueueDepartmentId(department.id);
                              setQueueOwnerId("all");
                            }}
                          >
                            {department.name}
                          </button>
                        ))}
                      </div>
                      {queueDepartmentId !== "all" ? (
                        <div className="mt-2">
                          <AppCombobox
                            value={queueOwnerId}
                            onChange={setQueueOwnerId}
                            searchable
                            options={[
                              { value: "all", label: "Todos deste departamento" },
                              ...agentsByDepartment.map((agent) => ({
                                value: agent.id,
                                label: agent.name,
                                description: agent.team?.name ?? agentDepartment(agent)
                              }))
                            ]}
                          />
                        </div>
                      ) : null}
                      {roleIsManager && managerAlertCount > 0 ? (
                        <p className="mt-2 text-[11px] text-slate-500">{managerAlertCount} aguardando resposta</p>
                      ) : null}
                    </div>
                  ) : null}
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="glass"
                size="icon"
                className="h-8 w-8 text-slate-500"
                title="Novo contato"
                onClick={() => setNewContactModalOpen(true)}
              >
                <Plus size={15} />
              </Button>
            </div>
            {loading && !filtered.length ? (
              <div className="mt-8 flex justify-center">
                <Loader2 className="animate-spin text-slate-400" />
              </div>
            ) : null}
              <div className="atlas-scroll min-h-0 flex-1 overflow-auto">
                {filtered.map((item) => {
                  const last = item.messages?.[0];
                  const selected = item.id === activeId;
                  const unread = isUnreadConversation(item);
                  const showDot = unread || isOverdueConversation(item);
                  const listMeta = `${conversationAgentLabel(item)} · ${conversationDepartment(item)}`;
                  const listTime = formatTime(item.lastMessageAt ?? last?.createdAt);
                  return (
                    <div key={item.id} className={`border-b border-slate-50 ${selected ? "bg-slate-50" : "bg-white"}`}>
                      <button
                        type="button"
                        onClick={() => openConversation(item.id)}
                        className="flex w-full items-start gap-2 px-2.5 py-2.5 text-left hover:bg-slate-50/80"
                      >
                        <CustomerAvatar
                          name={item.customerName}
                          phone={item.customerPhone}
                          avatarUrl={conversationAvatarFromTags(item.tags)}
                          size="sm"
                          accessToken={token}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`min-w-0 truncate text-[13px] leading-tight ${
                                unread ? "font-semibold text-slate-900" : "font-medium text-slate-800"
                              }`}
                            >
                              {item.customerName}
                            </p>
                            <div className="shrink-0 text-right leading-none">
                              {listTime ? <p className="text-[10px] text-slate-400">{listTime}</p> : null}
                              <p className="text-[10px] text-slate-400">{statusShortLabel(item.status)}</p>
                            </div>
                          </div>
                          <p className="truncate text-[10px] leading-tight text-slate-400">{listMeta}</p>
                          <p
                            className={`mt-0.5 truncate text-[11px] leading-tight ${
                              unread ? "text-slate-500" : "text-slate-400"
                            }`}
                          >
                            {last?.text ?? "—"}
                          </p>
                        </div>
                        {showDot ? (
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-700" aria-label={unread ? "Nao lida" : "Aguardando resposta"} />
                        ) : null}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="flex min-h-[320px] min-w-0 flex-col rounded-none border-0 bg-white p-0 shadow-none md:min-h-0">
              {active ? (
                <>
                  <ConversationHeaderBar active={active} accessToken={token} onOpenDrawer={() => setDrawerOpen(true)} />
                  <div className="atlas-scroll relative isolate flex-1 overflow-auto bg-slate-50/40 px-3 py-2 sm:px-4 sm:py-3">
                    {activeThreadFlash ? (
                      <div className="sticky top-0 z-30 mb-2 flex justify-center">
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm">
                          Nova mensagem
                        </span>
                      </div>
                    ) : null}
                    {groupMessagesForThread(active.messages ?? []).map((group) => (
                      <section key={group.dateKey} className="mb-3 last:mb-0">
                        <div className="sticky top-0 z-20 mb-2 flex justify-center">
                          <span className="rounded-full border border-slate-200/80 bg-white/95 px-2.5 py-0.5 text-[10px] font-medium capitalize text-slate-500 shadow-sm backdrop-blur">
                            {group.dateLabel}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {group.clusters.map((cluster, clusterIndex) => (
                            <div key={`${group.dateKey}-${clusterIndex}`} className="space-y-0">
                              {cluster.map((m, messageIndex) => (
                                <MessageBubble
                                  key={m.id}
                                  message={m}
                                  token={token}
                                  canManage
                                  clustered={cluster.length > 1}
                                  clusterFirst={messageIndex === 0}
                                  clusterLast={messageIndex === cluster.length - 1}
                                  onReply={(message) => setReplyToMessage(message)}
                                  onDelete={(message) => void handleDeleteMessage(message)}
                                  onEdit={(message) => void handleEditMessage(message)}
                                  onTranscribe={(message) => void handleTranscribeMessage(message)}
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  {pendingAudioFile ? (
                    <div className="mx-4 mb-2 rounded-xl border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-xs font-medium text-slate-600">
                        {pendingAudioSending ? "Enviando audio..." : "Audio gravado"}
                      </p>
                      <audio controls src={pendingAudioUrl} className="w-full" />
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" disabled={pendingAudioSending} onClick={() => void sendPendingAudio()}>
                          {pendingAudioSending ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            "Enviar audio"
                          )}
                        </Button>
                        <Button size="sm" variant="glass" disabled={pendingAudioSending} onClick={discardPendingAudio}>
                          Descartar
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {pendingUploadFile ? (
                    <div className="mx-4 mb-2 rounded-xl border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-xs font-medium text-slate-600">
                        {pendingUploadSending ? "Enviando arquivo..." : "Arquivo selecionado"}
                      </p>
                      {mediaPreviewKind(pendingUploadFile) === "image" && pendingUploadUrl ? (
                        <img src={pendingUploadUrl} alt="Preview da imagem" className="max-h-56 rounded-xl object-contain" />
                      ) : null}
                      {mediaPreviewKind(pendingUploadFile) === "video" && pendingUploadUrl ? (
                        <video controls src={pendingUploadUrl} className="max-h-56 rounded-xl" />
                      ) : null}
                      {mediaPreviewKind(pendingUploadFile) === "audio" && pendingUploadUrl ? (
                        <audio controls src={pendingUploadUrl} className="w-full" />
                      ) : null}
                      {mediaPreviewKind(pendingUploadFile) === "document" ? (
                        <div className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs">
                          {pendingUploadFile.name}
                        </div>
                      ) : null}
                      <input
                        className="mt-2 w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-xs outline-none disabled:opacity-60"
                        placeholder="Legenda opcional (deixe vazio para enviar sem texto)"
                        value={pendingUploadCaption}
                        disabled={pendingUploadSending}
                        onChange={(e) => setPendingUploadCaption(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (!pendingUploadSending) void sendPendingUpload();
                          }
                        }}
                      />
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" disabled={pendingUploadSending} onClick={() => void sendPendingUpload()}>
                          {pendingUploadSending ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            "Enviar arquivo"
                          )}
                        </Button>
                        <Button size="sm" variant="glass" disabled={pendingUploadSending} onClick={discardPendingUpload}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {replyToMessage ? (
                    <div className="mx-4 mb-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="inline-flex items-center gap-1 font-medium text-slate-600">
                            <CornerUpLeft size={12} />
                            Respondendo
                          </p>
                          <p className="truncate text-slate-500">{replyToMessage.text ?? `[${replyToMessage.type}]`}</p>
                        </div>
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
                          onClick={() => setReplyToMessage(null)}
                          aria-label="Cancelar resposta direcionada"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <form
                    onSubmit={handleSend}
                    className="z-10 flex items-end gap-2 border-t border-slate-100 bg-white px-3 py-2.5 sm:px-4"
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleFile(f);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="glass"
                      size="icon"
                      disabled={mediaSendLocked || sendingText}
                      onClick={() => fileRef.current?.click()}
                    >
                      <Paperclip size={18} />
                    </Button>
                    <QuickRepliesMenu
                      shortcuts={shortcuts}
                      disabled={!activeId}
                      open={shortcutMenuOpen}
                      onOpenChange={setShortcutMenuOpen}
                      onSelect={insertShortcut}
                    />
                    <Button
                      type="button"
                      variant="glass"
                      size="icon"
                      disabled={mediaSendLocked || sendingText}
                      onClick={toggleRecord}
                      className={recording ? "ring-2 ring-slate-300" : ""}
                    >
                      {recording ? <Square size={16} className="text-slate-600" /> : <Mic size={18} />}
                    </Button>
                    <textarea
                      className="atlas-field max-h-32 min-h-[40px] flex-1 resize-none rounded-[18px] px-4 py-2 text-sm outline-none focus:border-blue-300 disabled:opacity-60"
                      placeholder="Mensagem..."
                      value={draft}
                      disabled={sendingText}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (!sendingText && draft.trim()) void sendCurrentDraft();
                        }
                      }}
                    />
                    <Button type="submit" size="icon" disabled={!draft.trim() || sendingText || mediaSendLocked}>
                      {sendingText ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </Button>
                  </form>
                </>
              ) : (
                <div className="grid flex-1 place-items-center text-atlas-muted">
                  <MessageCircle size={32} />
                </div>
              )}
            </Card>
          </div>
          {error ? <p className="shrink-0 px-3 py-1.5 text-xs text-slate-700">{error}</p> : null}
          {!error && info ? <p className="shrink-0 px-3 py-1.5 text-xs text-slate-500">{info}</p> : null}
      </section>
      <ConversationDrawer
        open={drawerOpen}
        tab={drawerTab}
        onTabChange={setDrawerTab}
        onClose={() => setDrawerOpen(false)}
        active={active}
        token={token}
        contactDraft={contactDraft}
        setContactDraft={setContactDraft}
        cadenceDraft={cadenceDraft}
        setCadenceDraft={setCadenceDraft}
        onSaveContact={() => void saveContactIdentity()}
        onSaveCadence={() => void saveCadence()}
        onDelete={() => void handleDeleteActiveConversation()}
        onTransfer={(agent, note) => void transferTo(agent, note)}
        transferring={transferLoading}
        agents={agents}
        tagCatalog={tagCatalog}
        tagsSaving={tagsSaving}
        onTagsChange={(tags) => updateActiveTags(tags)}
        onSetStatus={(status) => void setStatusQuick(status)}
      />
      <NewContactModal
        open={newContactModalOpen}
        onClose={() => setNewContactModalOpen(false)}
        name={newContact.name}
        phone={newContact.phone}
        onNameChange={(value) => setNewContact((s) => ({ ...s, name: value }))}
        onPhoneChange={(value) => setNewContact((s) => ({ ...s, phone: value }))}
        onSubmit={() => void handleCreateConversation()}
        disabled={!newContact.name.trim() || !newContact.phone.trim()}
      />
      <UserProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        user={user}
        userPhone={selfUser?.phone ?? null}
        activeDepartment={selfUser?.team?.name ?? roleLabel(selfUser?.role ?? user.role)}
        activeInstanceLabel={active?.instance ? `${active.instance.label} (${active.instance.name})` : undefined}
        internalPhoto={internalPhoto}
        onUploadPhoto={uploadInternalPhoto}
        onLogout={logout}
        notificationPrefs={notificationPrefs}
        onNotificationPrefsChange={updateNotificationPrefs}
        canMonitorQueue={canMonitorByUser}
        notifyPermission={notifyPermission}
        onRequestNotificationPermission={() => void handleRequestNotificationPermission()}
      />
    </main>
  );
}
