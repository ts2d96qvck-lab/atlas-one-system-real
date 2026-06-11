"use client";

import { ChevronDown, ChevronLeft, MoreVertical } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@atlas-one/ui";
import type { Conversation } from "../../lib/api";
import { LIFECYCLE_STATUSES, type LifecycleStatus } from "../../lib/product-copy";
import { CustomerAvatar, formatPhoneDisplay, statusDotClass, statusLabel } from "./inbox-utils";

export type ConversationHeaderBarProps = {
  active: Conversation;
  customerAvatarUrl?: string | null;
  accessToken: string;
  onSetStatus: (status: LifecycleStatus) => void;
  onOpenDrawer: () => void;
  onMobileBack?: () => void;
};

export function ConversationHeaderBar({
  active,
  customerAvatarUrl,
  accessToken,
  onSetStatus,
  onOpenDrawer,
  onMobileBack
}: ConversationHeaderBarProps) {
  const assignee = active.assignedTo?.name ?? "Sem atendente";
  const teamName = active.team?.name ?? "Sem departamento";
  const instanceLabel = active.instance?.label || active.instance?.name || "WhatsApp";

  return (
    <div className="inbox-v42-chat-header flex items-center gap-2.5 px-3 py-3.5 sm:gap-3 sm:px-5">
      {onMobileBack ? (
        <button
          type="button"
          className="shrink-0 rounded-full border border-slate-200/80 bg-white/80 p-2 text-slate-600 shadow-sm hover:bg-white md:hidden"
          onClick={onMobileBack}
          aria-label="Voltar para a fila"
        >
          <ChevronLeft size={18} />
        </button>
      ) : null}
      <CustomerAvatar
        name={active.customerName}
        phone={active.customerPhone}
        avatarUrl={customerAvatarUrl}
        accessToken={accessToken}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold tracking-tight text-slate-900">{active.customerName}</p>
        <p className="truncate text-[12px] text-slate-500">
          {formatPhoneDisplay(active.customerPhone)} · {teamName} · {assignee}
        </p>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inbox-v43-header-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white/80"
            title="Alterar status"
          >
            <span className={`h-2 w-2 rounded-full ${statusDotClass(active.status)}`} />
            {statusLabel(active.status)}
            <ChevronDown size={12} className="text-slate-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {LIFECYCLE_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs ${
                active.status === status ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => onSetStatus(status)}
            >
              <span className={`h-2 w-2 rounded-full ${statusDotClass(status)}`} />
              {statusLabel(status)}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      <button
        type="button"
        className="inbox-v43-header-pill rounded-full p-2.5 text-slate-600 hover:bg-white/80"
        onClick={onOpenDrawer}
        aria-label="Detalhes da conversa"
        title={`Detalhes · ${teamName} · ${instanceLabel}`}
      >
        <MoreVertical size={16} />
      </button>
    </div>
  );
}
