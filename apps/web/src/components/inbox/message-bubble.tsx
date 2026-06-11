"use client";

import { memo, useState } from "react";
import { AlertTriangle, CheckCheck, Clock3, MessageCircle, MoreVertical, Send, Trash2 } from "lucide-react";
import type { Message } from "../../lib/api";
import { messageDeliveryStatus } from "../../lib/messages";
import { INBOX_COPY } from "../../lib/product-copy";
import { SecureMedia } from "../secure-media";
import {
  fileNameFromMessage,
  formatTime,
  messageSenderLabel,
  shouldShowMessageText
} from "./inbox-utils";

export function MediaMessageRenderer({ message, token }: { message: Message; token: string }) {
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
      <SecureMedia path={message.mediaUrl} token={token} type="document" fileName={fileNameFromMessage(message)} />
    );
  }

  return null;
}

export function messageStatusView(status: string, edited: boolean) {
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

export interface MessageBubbleProps {
  message: Message;
  token: string;
  onReply: (message: Message) => void;
  canManage?: boolean;
  canHide?: boolean;
  onHide?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onTranscribe?: (message: Message) => void;
  clustered?: boolean;
  clusterFirst?: boolean;
  clusterLast?: boolean;
}

function MessageBubbleBase({
  message,
  token,
  onReply,
  canManage,
  canHide,
  onHide,
  onEdit,
  onTranscribe,
  clustered,
  clusterFirst,
  clusterLast
}: MessageBubbleProps) {
  const outgoing = message.direction === "out";
  const raw = (message.raw && typeof message.raw === "object" ? message.raw : {}) as Record<string, unknown>;
  const deleted = Boolean(raw.deletedAt) || message.status === "deleted";
  const hidden = Boolean(raw.hiddenAt) || message.status === "hidden";
  const hiddenVisible = Boolean(raw.hiddenVisibleToSupervisor);
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
    const emoji =
      typeof (item as Record<string, unknown>).emoji === "string"
        ? String((item as Record<string, unknown>).emoji).trim()
        : "";
    if (!emoji) continue;
    reactionMap.set(emoji, (reactionMap.get(emoji) ?? 0) + 1);
  }
  const reactions = Array.from(reactionMap.entries());
  const deliveryStatus = messageDeliveryStatus(message);
  const statusView = deleted
    ? { icon: <Trash2 size={12} />, label: "Apagada", tone: "text-slate-400", badge: "bg-slate-100 text-slate-500" }
    : hidden && !hiddenVisible
      ? { icon: <Trash2 size={12} />, label: "Oculta", tone: "text-slate-400", badge: "bg-slate-100 text-slate-500" }
      : messageStatusView(deliveryStatus, edited);
  const failureReason =
    typeof raw.failureReason === "string"
      ? raw.failureReason
      : typeof raw.lastProviderStatus === "string"
        ? raw.lastProviderStatus
        : "";

  if (deleted || (hidden && !hiddenVisible)) {
    return (
      <div className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs italic text-slate-500">
          {hidden ? "Mensagem oculta" : "Mensagem apagada"}
        </div>
      </div>
    );
  }

  return (
    <div className={`group flex ${outgoing ? "justify-end" : "justify-start"} ${clustered && !clusterFirst ? "-mt-1" : ""}`}>
      <div
        onDoubleClick={() => onReply(message)}
        className={`relative z-10 max-w-[min(88%,26rem)] overflow-hidden break-words rounded-[1.125rem] px-3.5 py-2.5 text-[13px] leading-[1.45] sm:max-w-[min(82%,24rem)] ${
          outgoing
            ? `inbox-v43-bubble-out ${clusterLast === false ? "rounded-br-md" : "rounded-br-[1.125rem]"} ${clustered && !clusterFirst ? "rounded-tr-md" : ""}`
            : `inbox-v43-bubble-in ${clusterLast === false ? "rounded-bl-md" : "rounded-bl-[1.125rem]"} ${clustered && !clusterFirst ? "rounded-tl-md" : ""}`
        }`}
      >
        {hiddenVisible ? (
          <p className="mb-1 text-[10px] font-medium text-amber-700">Conteúdo oculto (visível para supervisão)</p>
        ) : null}
        {clustered && !clusterFirst ? null : !outgoing || messageSenderLabel(raw, outgoing) !== "Atendente" ? (
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold text-slate-500">{messageSenderLabel(raw, outgoing)}</p>
            {(canManage && outgoing) || canHide ? (
              <div className="relative">
                <button
                  type="button"
                  className="rounded-md p-0.5 text-slate-400 opacity-70 transition hover:bg-white/70 hover:text-slate-600 group-hover:opacity-100"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label={INBOX_COPY.messageActions}
                >
                  <MoreVertical size={12} />
                </button>
                {menuOpen ? (
                  <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                    {message.type === "text" && onEdit && canManage && outgoing ? (
                      <button
                        type="button"
                        className="block w-full rounded-lg px-2 py-1.5 text-left text-[11px] hover:bg-slate-50"
                        onClick={() => {
                          onEdit(message);
                          setMenuOpen(false);
                        }}
                      >
                        Editar
                      </button>
                    ) : null}
                    {onHide && canHide ? (
                      <button
                        type="button"
                        className="block w-full rounded-lg px-2 py-1.5 text-left text-[11px] text-rose-600 hover:bg-rose-50"
                        onClick={() => {
                          onHide(message);
                          setMenuOpen(false);
                        }}
                      >
                        Ocultar
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
              <p className="text-[11px] text-slate-500">Transcrevendo áudio...</p>
            ) : transcription ? (
              <p className="whitespace-pre-wrap text-[11px] text-slate-700">{transcription}</p>
            ) : transcriptionError ? (
              <p className="text-[11px] text-rose-600">{transcriptionError}</p>
            ) : onTranscribe ? (
              <button
                type="button"
                className="text-[11px] font-medium text-blue-700 hover:underline"
                onClick={() => onTranscribe(message)}
              >
                Transcrever áudio
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center justify-end gap-2 text-[10px] text-slate-400">
          {edited ? <span className="font-medium text-violet-600/80">editada</span> : null}
          {outgoing ? (
            <span
              className="inbox-v43-bubble-status inline-flex items-center gap-0.5"
              title={statusView.label}
              aria-label={`Status: ${statusView.label}`}
            >
              <span className={statusView.tone}>{statusView.icon}</span>
              <span>{statusView.label}</span>
            </span>
          ) : null}
          <span className="tabular-nums">{formatTime(message.createdAt)}</span>
        </div>
        {failureReason && deliveryStatus.includes("fail") ? (
          <p className="mt-1 text-[10px] text-rose-600">Falha: {failureReason}</p>
        ) : null}
        {reactions.length ? (
          <div className="mt-2 flex flex-wrap justify-end gap-1">
            {reactions.map(([emoji, count]) => (
              <span
                key={emoji}
                className="rounded-full border border-slate-200 bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-700"
              >
                {emoji} {count}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleBase);
