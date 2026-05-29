"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  CornerUpLeft,
  FileText,
  Loader2,
  LogOut,
  MessageCircle,
  Mic,
  MoreVertical,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Send,
  Shield,
  Square,
  Trash2,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { Badge, Button, Card } from "@atlas-one/ui";
import {
  createConversation,
  deleteConversation,
  deleteMessage,
  editMessage,
  getConversation,
  getCompanySettings,
  listConversations,
  listInboxShortcuts,
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
  type TeamRow,
  type UserRow
} from "../lib/api";
import { connectRealtime, joinTenant } from "../lib/socket";
import { SecureMedia } from "./secure-media";
import { QuickRepliesMenu } from "./quick-replies-menu";
import { AppCombobox } from "./ui/app-select";
import { apiUrl } from "../lib/config";
import { mergeMessages, mediaSrc, messageDeliveryStatus } from "../lib/messages";
import { hasPermission } from "../lib/session-user";

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
    return <SecureMedia path={message.mediaUrl} token={token} type="image" alt="Imagem enviada" />;
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

function messageSenderLabel(raw: Record<string, unknown>, outgoing: boolean) {
  const sentByName = typeof raw.sentByName === "string" ? raw.sentByName : null;
  const senderType = typeof raw.senderType === "string" ? raw.senderType : outgoing ? "agent" : "customer";
  if (senderType === "bot") return sentByName ? `Robo · ${sentByName}` : "Robo";
  if (senderType === "system") return sentByName ?? "Sistema";
  if (outgoing) return sentByName ?? "Atendente";
  return "Cliente";
}

function buildSignaturePreview(
  draft: string,
  user: SessionUser,
  messaging?: CompanySettings["messaging"]
) {
  if (!draft || !messaging || messaging.signaturePlacement === "disabled" || !messaging.showAgentNameToCustomer) {
    return null;
  }
  const signature = (messaging.agentSignatureFormat || "Atendente {{agentName}}:").replace(/\{\{agentName\}\}/g, user.name);
  if (messaging.signaturePlacement === "before") return `${signature}\n${draft}`;
  return `${draft}\n${signature}`;
}

function messageStatusView(status: string, edited: boolean) {
  const normalized = status.toLowerCase();
  if (normalized.includes("read")) {
    return { icon: <CheckCheck size={12} />, label: "Lida", tone: "text-sky-600", badge: "bg-sky-100 text-sky-800" };
  }
  if (normalized.includes("deliver")) {
    return { icon: <CheckCheck size={12} />, label: "Entregue", tone: "text-slate-600", badge: "bg-slate-100 text-slate-700" };
  }
  if (normalized.includes("fail") || normalized.includes("error") || normalized.includes("undeliver")) {
    return { icon: <AlertTriangle size={12} />, label: "Falhou", tone: "text-rose-600", badge: "bg-rose-100 text-rose-800" };
  }
  if (normalized.includes("queue") || normalized.includes("pending") || normalized.includes("sending")) {
    return { icon: <Clock3 size={12} />, label: "Enviando", tone: "text-amber-600", badge: "bg-amber-100 text-amber-900" };
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
  onTranscribe
}: {
  message: Message;
  token: string;
  onReply: (message: Message) => void;
  canManage?: boolean;
  onDelete?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onTranscribe?: (message: Message) => void;
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
    <div className={`group flex ${outgoing ? "justify-end" : "justify-start"}`}>
      <div
        onDoubleClick={() => onReply(message)}
        className={`relative z-10 max-w-[78%] overflow-hidden break-words rounded-2xl px-3 py-2.5 text-[13px] leading-5 shadow-sm sm:max-w-[72%] xl:max-w-[340px] ${
          outgoing
            ? "rounded-br-md bg-[#d9fdd3] text-slate-900"
            : "rounded-bl-md bg-white text-slate-800"
        }`}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold text-slate-500">{messageSenderLabel(raw, outgoing)}</p>
          {canManage && outgoing ? (
            <div className="relative">
              <button
                type="button"
                className="rounded-md p-0.5 text-slate-400 opacity-70 transition hover:bg-white/70 hover:text-slate-600 group-hover:opacity-100"
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
                    <button type="button" className="block w-full rounded-lg px-2 py-1.5 text-left text-[11px] text-rose-600 hover:bg-rose-50" onClick={() => { onDelete(message); setMenuOpen(false); }}>
                      Apagar
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
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
              <button type="button" className="text-[11px] font-medium text-blue-700 hover:underline" onClick={() => onTranscribe(message)}>
                Transcrever audio
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center justify-end gap-1.5 text-[10px] text-slate-500">
          {edited ? <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">editada</span> : null}
          {outgoing ? (
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium ${statusView.badge}`} title={statusView.label}>
              {statusView.icon}
              {statusView.label}
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

type TeamMemberDropdownProps = {
  agents: UserRow[];
  selectedAgentId: string | null;
  selectedDepartment: string;
  onSelectDepartment: (department: string) => void;
  onSelect: (id: string) => void;
  agentAvatarFor: (agentId: string) => string | null;
  accessToken: string;
};

function TeamMemberDropdown({
  agents,
  selectedAgentId,
  selectedDepartment,
  onSelectDepartment,
  onSelect,
  agentAvatarFor,
  accessToken
}: TeamMemberDropdownProps) {
  const departments = Array.from(new Set(agents.map(agentDepartment))).sort((a, b) => a.localeCompare(b));
  const visibleAgents =
    selectedDepartment === "Todos" ? agents : agents.filter((agent) => agentDepartment(agent) === selectedDepartment);

  return (
    <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-white/70 bg-white/90 p-2 shadow-sm">
      <div className="mb-2 flex flex-wrap gap-1">
        <button
          type="button"
          className={`rounded-full border px-2 py-0.5 text-[10px] ${selectedDepartment === "Todos" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}
          onClick={() => onSelectDepartment("Todos")}
        >
          Todos
        </button>
        {departments.map((department) => (
          <button
            key={department}
            type="button"
            className={`rounded-full border px-2 py-0.5 text-[10px] ${
              selectedDepartment === department ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"
            }`}
            onClick={() => onSelectDepartment(department)}
          >
            {department}
          </button>
        ))}
      </div>
      {visibleAgents.map((agent) => (
        <button
          key={agent.id}
          type="button"
          onClick={() => onSelect(agent.id)}
          className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs ${
            selectedAgentId === agent.id ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <CustomerAvatar
              name={agent.name}
              phone={agent.email}
              size="sm"
              avatarUrl={agentAvatarFor(agent.id) ?? agent.avatarUrl}
              accessToken={accessToken}
            />
            <div className="min-w-0">
              <p className="truncate font-semibold">{agent.name}</p>
              <p className="truncate text-[10px] text-slate-500">{agentDepartment(agent)}</p>
            </div>
          </div>
          <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300">
            {selectedAgentId === agent.id ? <Check size={11} /> : null}
          </span>
        </button>
      ))}
      {!visibleAgents.length ? <p className="px-2 py-1 text-[10px] text-slate-500">Nenhum atendente neste departamento.</p> : null}
    </div>
  );
}

type TransferConversationActionProps = {
  disabled?: boolean;
  loading?: boolean;
  onTransfer: () => void;
};

function TransferConversationAction({ disabled, loading, onTransfer }: TransferConversationActionProps) {
  return (
    <Button className="mt-2 h-8 w-full justify-center text-xs" variant="glass" disabled={disabled || loading} onClick={onTransfer}>
      {loading ? <Loader2 size={14} className="animate-spin" /> : null}
      Transferir atendimento
    </Button>
  );
}

type AttendantSelectorProps = {
  current: Conversation["assignedTo"];
  agents: UserRow[];
  transferring: boolean;
  onTransfer: (agent: UserRow) => void;
  agentAvatarFor: (agentId: string) => string | null;
  accessToken: string;
};

function AttendantSelector({ current, agents, transferring, onTransfer, agentAvatarFor, accessToken }: AttendantSelectorProps) {
  const [open, setOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(current?.id ?? null);
  const [selectedDepartment, setSelectedDepartment] = useState("Todos");

  useEffect(() => {
    setSelectedAgentId(current?.id ?? null);
  }, [current?.id]);

  const currentName = current?.name ?? "Nao atribuido";
  const currentAgent = current?.id ? agents.find((item) => item.id === current.id) : null;
  const currentDepartment = currentAgent ? agentDepartment(currentAgent) : "Sem departamento";

  return (
    <div className="relative">
      <button
        type="button"
        className="flex max-w-full items-center gap-2 rounded-full border border-white/70 bg-white/80 p-1 pr-2 text-left text-xs sm:max-w-[175px]"
        onClick={() => setOpen((v) => !v)}
        title="Atendente"
      >
        <CustomerAvatar
          name={currentName}
          phone={currentName}
          size="sm"
          avatarUrl={current?.id ? agentAvatarFor(current.id) ?? currentAgent?.avatarUrl : null}
          accessToken={accessToken}
        />
        <div className="min-w-0">
          <p className="max-w-[110px] truncate text-[11px] font-semibold leading-tight text-slate-700">{currentName}</p>
          <p className="max-w-[110px] truncate text-[10px] leading-tight text-slate-500">{currentDepartment}</p>
        </div>
        <ChevronDown size={12} />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-64 rounded-xl border border-white/70 bg-white/95 p-2 shadow-lg backdrop-blur">
          <p className="text-[11px] font-semibold text-slate-600">Atendente</p>
          <TeamMemberDropdown
            agents={agents}
            selectedAgentId={selectedAgentId}
            selectedDepartment={selectedDepartment}
            onSelectDepartment={setSelectedDepartment}
            agentAvatarFor={agentAvatarFor}
            accessToken={accessToken}
            onSelect={(id) => {
              setSelectedAgentId(id);
              const agent = agents.find((item) => item.id === id);
              if (agent) setSelectedDepartment(agentDepartment(agent));
            }}
          />
          <TransferConversationAction
            loading={transferring}
            disabled={!selectedAgentId || selectedAgentId === current?.id}
            onTransfer={() => {
              if (!selectedAgentId) return;
              const agent = agents.find((item) => item.id === selectedAgentId);
              if (!agent) return;
              onTransfer(agent);
              setOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

type CustomerHeaderProps = {
  active: Conversation;
  agents: UserRow[];
  customerAvatarUrl?: string | null;
  editingContact: boolean;
  contactDraft: { customerName: string; customerPhone: string };
  setContactDraft: (
    updater:
      | { customerName: string; customerPhone: string }
      | ((prev: { customerName: string; customerPhone: string }) => { customerName: string; customerPhone: string })
  ) => void;
  setEditingContact: (value: boolean) => void;
  onSaveContact: () => void;
  onDelete: () => void;
  onSetStatus: (status: "open" | "waiting_customer" | "closed") => void;
  onTransfer: (agent: UserRow) => void;
  transferring: boolean;
  agentAvatarFor: (agentId: string) => string | null;
  accessToken: string;
};

function CustomerHeader({
  active,
  agents,
  customerAvatarUrl,
  editingContact,
  contactDraft,
  setContactDraft,
  setEditingContact,
  onSaveContact,
  onDelete,
  onSetStatus,
  onTransfer,
  transferring,
  agentAvatarFor,
  accessToken
}: CustomerHeaderProps) {
  return (
    <div className="border-b border-slate-200 bg-white px-2 py-2 sm:px-3 sm:py-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <CustomerAvatar
            name={active.customerName}
            phone={active.customerPhone}
            avatarUrl={customerAvatarUrl}
            accessToken={accessToken}
          />
          {editingContact ? (
            <div className="flex min-w-[220px] flex-col gap-1">
              <input
                className="atlas-field rounded-md px-2 py-1 text-xs outline-none"
                value={contactDraft.customerName}
                onChange={(e) => setContactDraft((s) => ({ ...s, customerName: e.target.value }))}
                placeholder="Nome do cliente"
              />
              <input
                className="atlas-field rounded-md px-2 py-1 text-xs outline-none"
                value={contactDraft.customerPhone}
                onChange={(e) => setContactDraft((s) => ({ ...s, customerPhone: e.target.value }))}
                placeholder="Telefone do cliente"
              />
            </div>
          ) : (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{active.customerName}</p>
              <p className="truncate text-xs text-slate-500">+{active.customerPhone}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          <AttendantSelector
            current={active.assignedTo ?? null}
            agents={agents}
            transferring={transferring}
            onTransfer={onTransfer}
            agentAvatarFor={agentAvatarFor}
            accessToken={accessToken}
          />
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(["open", "waiting_customer", "closed"] as const).map((status) => (
              <button
                key={status}
                type="button"
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  active.status === status
                    ? status === "closed"
                      ? "bg-slate-700 text-white shadow-sm"
                      : status === "waiting_customer"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white"
                }`}
                onClick={() => onSetStatus(status)}
                title={statusLabel(status)}
              >
                {statusLabel(status)}
              </button>
            ))}
          </div>
          {editingContact ? (
            <>
              <Button variant="glass" size="sm" className="h-7 px-2 text-[11px]" onClick={onSaveContact} title="Salvar cliente">
                Salvar
              </Button>
              <Button variant="glass" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setEditingContact(false)} title="Cancelar">
                Cancelar
              </Button>
            </>
          ) : (
            <Button variant="glass" size="icon" className="h-7 w-7" onClick={() => setEditingContact(true)} title="Editar cliente">
              <Pencil size={13} />
            </Button>
          )}
          <Button variant="glass" size="icon" className="h-7 w-7" onClick={onDelete} title="Excluir contato">
            <Trash2 size={13} />
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
  onLogout
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
  const [search, setSearch] = useState("");
  const [recording, setRecording] = useState(false);
  const [pendingAudioFile, setPendingAudioFile] = useState<File | null>(null);
  const [pendingAudioUrl, setPendingAudioUrl] = useState("");
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [pendingUploadUrl, setPendingUploadUrl] = useState("");
  const [pendingUploadCaption, setPendingUploadCaption] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [newContact, setNewContact] = useState({ name: "", phone: "" });
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSavedAt, setNoteSavedAt] = useState<string>("");
  const [editingContact, setEditingContact] = useState(false);
  const [contactDraft, setContactDraft] = useState({ customerName: "", customerPhone: "" });
  const [cadenceDraft, setCadenceDraft] = useState("padrao");
  const [transferLoading, setTransferLoading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [internalPhoto, setInternalPhoto] = useState<string | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [lastSeenByConversation, setLastSeenByConversation] = useState<Record<string, number>>({});
  const [queueDepartmentId, setQueueDepartmentId] = useState<string>("all");
  const [queueOwnerId, setQueueOwnerId] = useState<string>("all");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeIdRef = useRef<string | null>(null);

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
        setEditingContact(false);
        setReplyToMessage(null);
        setLastSeenByConversation((current) => ({ ...current, [id]: Date.now() }));
        const note = (detail.lead?.customFields as { internalNotes?: string } | undefined)?.internalNotes;
        setInternalNote(note ?? "");
      } catch {
        setError("Nao foi possivel abrir a conversa agora.");
      }
    },
    [token]
  );

  const saveNote = useCallback(async () => {
    if (!activeConversation?.lead?.id) return;
    setNoteSaving(true);
    try {
      await updateLead(token, activeConversation.lead.id, {
        customFields: { internalNotes: internalNote, cadence: cadenceDraft }
      });
      setNoteSavedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      setError("");
    } finally {
      setNoteSaving(false);
    }
  }, [activeConversation?.lead?.id, cadenceDraft, internalNote, token]);

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
      void saveNote();
    }, 700);
    return () => clearTimeout(timer);
  }, [internalNote, activeConversation?.lead?.id, saveNote]);

  useEffect(() => {
    if (!activeConversation?.lead?.id) return;
    const timer = setTimeout(() => {
      void saveNote();
    }, 700);
    return () => clearTimeout(timer);
  }, [cadenceDraft, activeConversation?.lead?.id, saveNote]);

  const visibleConversations = useMemo(() => {
    if (roleIsAgent) return conversations.filter((item) => item.assignedToId === user.id);
    if (!canMonitorByUser) return conversations.filter((item) => item.assignedToId === user.id);
    const byDepartment =
      queueDepartmentId === "all" ? conversations : conversations.filter((item) => item.teamId === queueDepartmentId);
    if (queueOwnerId === "all") return byDepartment;
    return byDepartment.filter((item) => item.assignedToId === queueOwnerId);
  }, [canMonitorByUser, conversations, queueDepartmentId, queueOwnerId, roleIsAgent, user.id]);

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
    const q = search.trim().toLowerCase();
    if (!q) return visibleConversations;
    return visibleConversations.filter(
      (c) =>
        c.customerName.toLowerCase().includes(q) ||
        c.customerPhone.includes(q) ||
        c.lead?.company?.toLowerCase().includes(q)
    );
  }, [visibleConversations, search]);

  async function sendCurrentDraft() {
    if (!activeId) {
      setError("Aguarde a conversa abrir para enviar a mensagem.");
      return;
    }
    if (!draft.trim()) return;
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
    await sendCurrentDraft();
  }

  async function handleFile(file: File) {
    if (!activeId) return;
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
    try {
      await sendMediaFile(token, activeId, pendingUploadFile, pendingUploadCaption.trim() || undefined);
      if (pendingUploadUrl) URL.revokeObjectURL(pendingUploadUrl);
      setPendingUploadFile(null);
      setPendingUploadUrl("");
      setPendingUploadCaption("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar arquivo");
    }
  }

  function discardPendingUpload() {
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
    if (!pendingAudioFile) return;
    await handleFile(pendingAudioFile);
    if (pendingAudioUrl) URL.revokeObjectURL(pendingAudioUrl);
    setPendingAudioFile(null);
    setPendingAudioUrl("");
  }

  function discardPendingAudio() {
    if (pendingAudioUrl) URL.revokeObjectURL(pendingAudioUrl);
    setPendingAudioFile(null);
    setPendingAudioUrl("");
  }

  async function transferTo(agent: UserRow) {
    if (!activeId) return;
    setTransferLoading(true);
    try {
      await updateConversation(token, activeId, {
        assignedToId: agent.id || null,
        teamId: agent.teamId ?? null
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
    if (!Array.isArray(tags)) return null;
    const found = tags.find((tag) => typeof tag === "string" && tag.startsWith("avatar:"));
    if (typeof found !== "string") return null;
    const value = found.slice("avatar:".length).trim();
    return normalizeAvatarUrl(value);
  }

  function openTeamManagement() {
    window.dispatchEvent(new CustomEvent("atlas:navigate", { detail: { view: "admin" } }));
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
      setQuickAddOpen(false);
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
          customFields: { internalNotes: internalNote, cadence: cadenceDraft }
        });
      }
      await refreshConversations();
      await openConversation(activeId);
      setInfo("Nome/telefone do cliente atualizados.");
      setError("");
      setEditingContact(false);
    } catch (err) {
      setInfo("");
      setError(err instanceof Error ? err.message : "Falha ao atualizar dados do cliente");
    }
  }

  const active = activeConversation;
  const activeCustomerAvatar = active ? getAvatarUrl(active.tags) : null;
  const openCount = visibleConversations.filter((item) => item.status === "open").length;
  const waitingCount = visibleConversations.filter((item) => item.status === "waiting_customer").length;
  const closedCount = visibleConversations.filter((item) => item.status === "closed").length;

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
    <main className="mx-auto h-full max-w-[1500px] overflow-hidden p-2 sm:p-3 xl:p-4">
      <section className="grid h-full min-h-0 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,210px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,210px)_minmax(0,1fr)_minmax(0,280px)]">
        <aside className="glass-panel hidden min-h-0 flex-col overflow-hidden rounded-[26px] p-3 xl:flex">
          <div className="flex items-center gap-2 rounded-2xl border border-white/60 bg-white/50 px-2.5 py-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-400 text-white">
              <Shield size={16} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Atlas One</p>
              <p className="truncate text-[11px] text-atlas-muted">Inbox comercial</p>
            </div>
          </div>

          <div className="mt-2.5 rounded-2xl border border-white/60 bg-white/45 p-2.5 backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-600">Resumo do turno</p>
              <span className="text-[10px] text-slate-500">Hoje</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="rounded-lg bg-white/65 px-1.5 py-2">
                <p className="text-base font-semibold leading-none text-slate-700">{openCount}</p>
                <p className="mt-1 text-[10px] text-slate-500">Abertos</p>
              </div>
              <div className="rounded-lg bg-white/65 px-1.5 py-2">
                <p className="text-base font-semibold leading-none text-slate-700">{waitingCount}</p>
                <p className="mt-1 text-[10px] text-slate-500">Aguard.</p>
              </div>
              <div className="rounded-lg bg-white/65 px-1.5 py-2">
                <p className="text-base font-semibold leading-none text-slate-700">{closedCount}</p>
                <p className="mt-1 text-[10px] text-slate-500">Fechados</p>
              </div>
            </div>
          </div>

          <div className="mt-2.5 rounded-2xl border border-white/60 bg-white/45 p-2.5 backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-600">Equipe online</p>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {agents.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {agents.slice(0, 3).map((agent) => (
                <div key={agent.id} className="flex items-center gap-2 rounded-lg bg-white/65 px-2 py-1.5 text-xs">
                  <CustomerAvatar
                    name={agent.name}
                    phone={agent.email}
                    size="sm"
                    avatarUrl={agentAvatarFor(agent.id) ?? agent.avatarUrl}
                    accessToken={token}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-700">{agent.name}</p>
                    <p className="truncate text-[10px] text-slate-500">{agentDepartment(agent)}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="glass" className="mt-2 h-8 w-full justify-center text-[11px]" onClick={openTeamManagement}>
              <Users size={13} />
              Gerir equipe
            </Button>
            <Button variant="glass" className="mt-1.5 h-8 w-full justify-center text-[11px]" onClick={openTeamManagement}>
              <UserPlus size={13} />
              Novo atendente
            </Button>
          </div>
          <button
            type="button"
            onDoubleClick={() => setProfileOpen(true)}
            className="mt-auto rounded-2xl border border-white/60 bg-white/55 p-3 text-left text-sm backdrop-blur-xl"
            title="Duplo clique para abrir perfil"
          >
            <div className="flex items-center gap-2">
              <CustomerAvatar
                name={user.name}
                phone={user.email}
                size="sm"
                avatarUrl={internalPhoto ?? agentAvatarFor(user.id) ?? selfUser?.avatarUrl}
                accessToken={token}
              />
              <div>
                <p className="font-semibold">{user.name}</p>
                <p className="text-[11px] text-atlas-muted">{roleLabel(user.role)} · duplo clique no perfil</p>
              </div>
            </div>
          </button>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden lg:min-h-[420px]">
          <header className="glass-panel flex min-h-14 shrink-0 flex-wrap items-center gap-2 rounded-[26px] px-3 py-2 sm:gap-3 sm:px-5">
            <Search className="text-atlas-blue" size={18} />
            <input
              className="flex-1 bg-transparent text-sm outline-none"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button variant="glass" size="icon">
              <Bell size={18} />
            </Button>
            {roleIsManager && managerAlertCount > 0 ? (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                {managerAlertCount} aguardando +5m
              </span>
            ) : null}
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden md:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
            <Card className="flex min-h-[220px] min-w-0 flex-col border border-slate-200 bg-white/95 p-3 shadow-sm sm:min-h-[280px] sm:p-3.5 md:min-h-0">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">Inbox</h1>
                <Badge>{filtered.length}</Badge>
              </div>
              <div className="mt-2.5 rounded-2xl border border-white/70 bg-white/55 p-2.5 backdrop-blur">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-atlas-muted">Novo contato</p>
                  <Button
                    variant="glass"
                    className="h-8 px-2.5 text-[11px]"
                    onClick={() => setQuickAddOpen((v) => !v)}
                    title="Adicionar contato"
                  >
                    <Plus size={12} />
                    {quickAddOpen ? "Fechar" : "Adicionar"}
                  </Button>
                </div>
                {quickAddOpen ? (
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    <input
                      className="atlas-field rounded-xl px-3 py-2 text-sm outline-none"
                      placeholder="Nome do cliente"
                      value={newContact.name}
                      onChange={(e) => setNewContact((s) => ({ ...s, name: e.target.value }))}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        className="atlas-field min-w-0 flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                        placeholder="WhatsApp com DDD"
                        value={newContact.phone}
                        onChange={(e) => setNewContact((s) => ({ ...s, phone: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleCreateConversation();
                        }}
                      />
                      <Button
                        variant="glass"
                        className="h-9 px-3 text-xs"
                        onClick={() => void handleCreateConversation()}
                        disabled={!newContact.name.trim() || !newContact.phone.trim()}
                      >
                        Salvar
                      </Button>
                    </div>
                    <p className="px-1 text-[10px] text-slate-500">Foto do cliente sincroniza automaticamente pelo WhatsApp.</p>
                  </div>
                ) : null}
              </div>
              {loading && !filtered.length ? (
                <div className="mt-8 flex justify-center">
                  <Loader2 className="animate-spin" />
                </div>
              ) : null}
              {canMonitorByUser ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white/85 p-2">
                  <p className="mb-1 text-[10px] font-semibold text-slate-500">Acompanhar por departamento</p>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className={`rounded-full border px-2 py-0.5 text-[10px] ${
                        queueDepartmentId === "all"
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                      onClick={() => {
                        setQueueDepartmentId("all");
                        setQueueOwnerId("all");
                      }}
                    >
                      Todos departamentos
                    </button>
                    {departmentOptions.map((department) => (
                      <button
                        key={department.id}
                        type="button"
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${
                          queueDepartmentId === department.id
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-600"
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
                      <p className="mb-1 text-[10px] font-semibold text-slate-500">Selecionar atendente do departamento</p>
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
                </div>
              ) : null}
              <div className="atlas-scroll mt-4 flex-1 space-y-2 overflow-auto pr-1">
                {filtered.map((item) => {
                  const last = item.messages?.[0];
                  const selected = item.id === activeId;
                  const unread = isUnreadConversation(item);
                  const overdue = isOverdueConversation(item);
                  return (
                    <div
                      key={item.id}
                      className={`w-full rounded-2xl border p-2.5 text-left transition ${
                        selected
                          ? "border-blue-200/70 bg-blue-50/50"
                          : "border-transparent bg-transparent hover:border-white/70 hover:bg-white/60"
                      }`}
                    >
                      <button type="button" onClick={() => openConversation(item.id)} className="w-full">
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            <CustomerAvatar
                              name={item.customerName}
                              phone={item.customerPhone}
                              avatarUrl={getAvatarUrl(item.tags)}
                              size="sm"
                              accessToken={token}
                            />
                            {unread ? (
                              <span className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ${overdue ? "bg-rose-500" : "bg-blue-500"}`} />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="truncate text-sm font-semibold">{item.customerName}</p>
                            <p className="truncate text-xs text-atlas-muted">{last?.text ?? "—"}</p>
                            {item.team?.name ? (
                              <p className="truncate text-[10px] font-medium text-blue-700">{item.team.name}</p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1">
                            {overdue ? (
                              <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">+5m</span>
                            ) : null}
                            <Badge className="h-6">{statusLabel(item.status)}</Badge>
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="flex min-h-[320px] min-w-0 flex-col border border-slate-200 bg-white/95 p-0 shadow-sm md:min-h-0">
              {active ? (
                <>
                  <CustomerHeader
                    active={active}
                    agents={agents}
                    customerAvatarUrl={activeCustomerAvatar}
                    editingContact={editingContact}
                    contactDraft={contactDraft}
                    setContactDraft={setContactDraft}
                    setEditingContact={(value) => {
                      if (!value) {
                        setContactDraft({
                          customerName: active.customerName ?? "",
                          customerPhone: active.customerPhone ?? ""
                        });
                      }
                      setEditingContact(value);
                    }}
                    onSaveContact={() => void saveContactIdentity()}
                    onDelete={() => void handleDeleteActiveConversation()}
                    onSetStatus={(status) => void setStatusQuick(status)}
                    onTransfer={(agent) => void transferTo(agent)}
                    transferring={transferLoading}
                    agentAvatarFor={agentAvatarFor}
                    accessToken={token}
                  />
                  <div className="atlas-scroll relative isolate flex-1 space-y-4 overflow-auto bg-[#f7faff] px-5 py-5">
                    {(active.messages ?? []).map((m) => (
                      <MessageBubble
                        key={m.id}
                        message={m}
                        token={token}
                        canManage
                        onReply={(message) => setReplyToMessage(message)}
                        onDelete={(message) => void handleDeleteMessage(message)}
                        onEdit={(message) => void handleEditMessage(message)}
                        onTranscribe={(message) => void handleTranscribeMessage(message)}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  {pendingAudioFile ? (
                    <div className="mx-4 mb-2 rounded-2xl border border-blue-100 bg-blue-50/50 p-3">
                      <p className="mb-2 text-xs font-semibold text-blue-700">Audio gravado (pre-escuta antes de enviar)</p>
                      <audio controls src={pendingAudioUrl} className="w-full" />
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" onClick={() => void sendPendingAudio()}>
                          Enviar audio
                        </Button>
                        <Button size="sm" variant="glass" onClick={discardPendingAudio}>
                          Descartar
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {pendingUploadFile ? (
                    <div className="mx-4 mb-2 rounded-2xl border border-blue-100 bg-blue-50/50 p-3">
                      <p className="mb-2 text-xs font-semibold text-blue-700">Arquivo selecionado (confirme antes de enviar)</p>
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
                        className="mt-2 w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-xs outline-none"
                        placeholder="Legenda opcional (deixe vazio para enviar sem texto)"
                        value={pendingUploadCaption}
                        onChange={(e) => setPendingUploadCaption(e.target.value)}
                      />
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" onClick={() => void sendPendingUpload()}>
                          Enviar arquivo
                        </Button>
                        <Button size="sm" variant="glass" onClick={discardPendingUpload}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {replyToMessage ? (
                    <div className="mx-4 mb-2 rounded-2xl border border-slate-200 bg-white/75 px-3 py-2 text-xs backdrop-blur">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="inline-flex items-center gap-1 font-semibold text-slate-700">
                            <CornerUpLeft size={12} />
                            Respondendo mensagem especifica
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
                  {buildSignaturePreview(draft, user, companySettings?.messaging) ? (
                    <div className="mx-4 mb-1 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[11px] text-emerald-900">
                      <p className="mb-1 font-semibold">Preview enviado ao cliente (com assinatura):</p>
                      <p className="whitespace-pre-wrap">{buildSignaturePreview(draft, user, companySettings?.messaging)}</p>
                    </div>
                  ) : null}
                  <form
                    onSubmit={handleSend}
                    className="z-10 flex items-end gap-2 border-t border-slate-200 bg-white px-4 py-2.5"
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
                    <Button type="button" variant="glass" size="icon" onClick={() => fileRef.current?.click()}>
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
                      onClick={toggleRecord}
                      className={recording ? "ring-2 ring-red-400" : ""}
                    >
                      {recording ? <Square size={16} className="text-red-500" /> : <Mic size={18} />}
                    </Button>
                    <textarea
                      className="atlas-field max-h-32 min-h-[40px] flex-1 resize-none rounded-[18px] px-4 py-2 text-sm outline-none focus:border-blue-300"
                      placeholder="Mensagem..."
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (draft.trim()) void sendCurrentDraft();
                        }
                      }}
                    />
                    <Button type="submit" size="icon" disabled={!draft.trim()}>
                      <Send size={18} />
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
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {!error && info ? <p className="text-sm text-emerald-700">{info}</p> : null}
        </section>

        <aside className="hidden min-h-0 flex-col gap-4 overflow-hidden 2xl:flex">
          <Card className="flex-1 border border-white/70 bg-white/50 p-4 backdrop-blur-xl">
            <p className="font-semibold">Painel do cliente</p>
            {active ? (
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-3 rounded-xl border border-white/70 bg-white/70 p-3">
                  <CustomerAvatar
                    name={active.customerName}
                    phone={active.customerPhone}
                    avatarUrl={activeCustomerAvatar}
                    accessToken={token}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{active.customerName}</p>
                    <p className="truncate text-xs text-slate-500">+{active.customerPhone}</p>
                    {active.assignedTo ? (
                      <p className="truncate text-[11px] text-slate-500">
                        Atendente: {active.assignedTo.name}
                        {active.team?.name ? ` · ${active.team.name}` : ""}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-atlas-muted">Nome</p>
                  <input
                    className="mt-1 w-full rounded-xl border border-white/70 bg-white/75 px-3 py-2 text-sm outline-none"
                    value={contactDraft.customerName}
                    onChange={(e) => setContactDraft((s) => ({ ...s, customerName: e.target.value }))}
                    placeholder="Nome do cliente"
                  />
                </div>
                <div>
                  <p className="text-[11px] text-atlas-muted">Telefone</p>
                  <input
                    className="mt-1 w-full rounded-xl border border-white/70 bg-white/75 px-3 py-2 text-sm outline-none"
                    value={contactDraft.customerPhone}
                    onChange={(e) => setContactDraft((s) => ({ ...s, customerPhone: e.target.value }))}
                    placeholder="Telefone com DDD"
                  />
                </div>
                <div>
                  <p className="text-[11px] text-atlas-muted">Cadencia</p>
                  <select
                    className="mt-1 w-full rounded-xl border border-white/70 bg-white/75 px-3 py-2 text-sm outline-none"
                    value={cadenceDraft}
                    onChange={(e) => setCadenceDraft(e.target.value)}
                  >
                    <option value="padrao">Padrao</option>
                    <option value="acelerada">Acelerada</option>
                    <option value="consultiva">Consultiva</option>
                    <option value="reativacao">Reativacao</option>
                  </select>
                </div>
                <div>
                  <p className="text-[11px] text-atlas-muted">Notas internas</p>
                  <textarea
                    className="mt-1 w-full rounded-2xl border border-white/70 bg-white/55 p-3 text-sm outline-none backdrop-blur-xl"
                    rows={7}
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    placeholder="Visivel apenas para a equipe"
                  />
                </div>
                {active.lead ? (
                  <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-xs text-atlas-muted">
                    <p className="font-semibold text-slate-700">{active.lead.company}</p>
                    <p>
                      Etapa: {active.lead.status} · R$ {Number(active.lead.value).toLocaleString("pt-BR")}
                    </p>
                  </div>
                ) : null}
                <div className="mt-2 flex items-center justify-between text-xs text-atlas-muted">
                  <span>{noteSaving ? "Salvando..." : noteSavedAt ? `Salvo ${noteSavedAt}` : "Autosave ativo"}</span>
                  <Button className="h-8 px-3 text-xs" variant="glass" onClick={saveContactIdentity}>
                    Salvar painel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-atlas-muted">Selecione uma conversa para editar nome, cadencia e notas.</p>
            )}
          </Card>
        </aside>
      </section>
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
      />
    </main>
  );
}
