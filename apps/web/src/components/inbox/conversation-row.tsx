"use client";

import { memo } from "react";
import { Checkbox } from "@atlas-one/ui";
import type { Conversation, TagCatalogItem } from "../../lib/api";
import { ConversationTagChips } from "../conversation-tags";
import {
  CustomerAvatar,
  formatTime,
  statusDotClass,
  statusLabel,
  statusMetaTone,
  statusShortLabel
} from "./inbox-utils";

export function slaTextToneClass(tone: "danger" | "warn" | "ok" | "muted" | string) {
  if (tone === "danger") return "text-rose-600";
  if (tone === "warn") return "text-amber-600";
  if (tone === "ok") return "text-emerald-600";
  return "text-slate-500";
}

export interface ConversationRowProps {
  item: Conversation;
  token: string;
  avatarUrl: string | null;
  selected: boolean;
  checked: boolean;
  bulkSelectMode: boolean;
  unread: boolean;
  overdue: boolean;
  slaSummary: string;
  slaDetail: string;
  slaTone: string;
  tagCatalog: TagCatalogItem[];
  onOpen: (id: string) => void;
  onToggleSelect: (id: string) => void;
}

function ConversationRowBase({
  item,
  token,
  avatarUrl,
  selected,
  checked,
  bulkSelectMode,
  unread,
  overdue,
  slaSummary,
  slaDetail,
  slaTone,
  tagCatalog,
  onOpen,
  onToggleSelect
}: ConversationRowProps) {
  const last = item.messages?.[0];
  const dotClass = overdue ? "bg-rose-500" : unread ? "bg-blue-500" : statusDotClass(item.status);
  const assigneeName = item.assignedTo?.name ?? "Sem atendente";
  const teamName = item.team?.name ?? "Sem departamento";
  const preview = last?.text?.trim() || "Sem mensagens";

  return (
    <div className="inbox-v42-row group" data-active={selected} data-selected={checked}>
      {bulkSelectMode ? (
        <Checkbox
          className="mt-0.5"
          checked={checked}
          onCheckedChange={() => onToggleSelect(item.id)}
          aria-label={`Selecionar ${item.customerName}`}
        />
      ) : null}
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => (bulkSelectMode ? onToggleSelect(item.id) : onOpen(item.id))}
      >
        <div className="relative shrink-0">
          <CustomerAvatar
            name={item.customerName}
            phone={item.customerPhone}
            avatarUrl={avatarUrl}
            size="sm"
            accessToken={token}
          />
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${dotClass}`}
            title={overdue ? slaDetail : unread ? "Não lida" : statusLabel(item.status)}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p
              className={`inbox-v43-row-title truncate ${unread ? "font-semibold text-slate-900" : "font-medium text-slate-800"}`}
            >
              {item.customerName}
            </p>
            <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
              {formatTime(item.lastMessageAt ?? last?.createdAt)}
            </span>
          </div>
          <p className={`inbox-v43-row-preview truncate ${unread ? "text-slate-600" : "text-slate-500"}`}>{preview}</p>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p className="inbox-v43-row-meta min-w-0 flex-1 truncate text-slate-400">
              <span className={`font-medium ${statusMetaTone(item.status)}`}>{statusShortLabel(item.status)}</span>
              {overdue ? (
                <>
                  <span className="text-slate-300"> · </span>
                  <span className={`font-medium ${slaTextToneClass(slaTone)}`} title={slaDetail}>
                    {slaSummary}
                  </span>
                </>
              ) : null}
              <span className="text-slate-400">
                {" "}
                · {teamName} · {assigneeName}
              </span>
            </p>
            <ConversationTagChips tags={item.tags} catalog={tagCatalog} compact className="inbox-v43-row-tags shrink-0" />
          </div>
        </div>
      </button>
    </div>
  );
}

export const ConversationRow = memo(ConversationRowBase);
