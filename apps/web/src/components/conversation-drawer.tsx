"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import { Button } from "@atlas-one/ui";
import type { Conversation, TagCatalogItem, UserRow } from "../lib/api";
import { ConversationActivityPanel } from "./conversation-activity-panel";
import { ConversationTagEditor } from "./conversation-tags";
import { INBOX_COPY } from "../lib/product-copy";
import { AppCombobox } from "./ui/app-select";

export type ConversationDrawerTab = "cliente" | "crm" | "tags" | "notas" | "historico";

type Props = {
  open: boolean;
  tab: ConversationDrawerTab;
  onTabChange: (tab: ConversationDrawerTab) => void;
  onClose: () => void;
  active: Conversation | null;
  token: string;
  contactDraft: { customerName: string; customerPhone: string };
  setContactDraft: (
    updater:
      | { customerName: string; customerPhone: string }
      | ((prev: { customerName: string; customerPhone: string }) => { customerName: string; customerPhone: string })
  ) => void;
  cadenceDraft: string;
  setCadenceDraft: (value: string) => void;
  onSaveContact: () => void | Promise<void>;
  onSaveCadence: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onTransfer: (agent: UserRow, note?: string) => void | Promise<void>;
  transferring: boolean;
  agents: UserRow[];
  tagCatalog: TagCatalogItem[];
  tagsSaving: boolean;
  onTagsChange: (tags: string[]) => void | Promise<void>;
};

const TABS: { id: ConversationDrawerTab; label: string }[] = [
  { id: "cliente", label: "Cliente" },
  { id: "crm", label: "CRM" },
  { id: "tags", label: "Tags" },
  { id: "notas", label: "Notas" },
  { id: "historico", label: "Histórico" }
];

export function ConversationDrawer({
  open,
  tab,
  onTabChange,
  onClose,
  active,
  token,
  contactDraft,
  setContactDraft,
  cadenceDraft,
  setCadenceDraft,
  onSaveContact,
  onSaveCadence,
  onDelete,
  onTransfer,
  transferring,
  agents,
  tagCatalog,
  tagsSaving,
  onTagsChange
}: Props) {
  const [transferAgentId, setTransferAgentId] = useState("");
  const [transferNote, setTransferNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setTransferAgentId(active?.assignedToId ?? "");
    setTransferNote("");
  }, [open, active?.assignedToId, active?.id]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end pt-14 sm:pt-16">
      <button type="button" className="absolute inset-0 bg-slate-950/30" aria-label="Fechar painel" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl sm:max-w-[min(100vw-1rem,28rem)]">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Detalhes da conversa</p>
              <p className="truncate text-sm text-slate-800">{active?.customerName ?? "Selecione uma conversa"}</p>
              {active ? (
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-600">
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5">+{active.customerPhone}</span>
                  {active.assignedTo?.name ? (
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5">{active.assignedTo.name}</span>
                  ) : null}
                  {active.team?.name ? (
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5">{active.team.name}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
              onClick={onClose}
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50/60 px-3 py-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                tab === item.id
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:bg-white/80 hover:text-slate-700"
              }`}
              onClick={() => onTabChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="atlas-scroll min-h-0 flex-1 overflow-auto p-4">
          {!active ? (
            <p className="text-sm text-slate-500">Selecione uma conversa para ver os detalhes.</p>
          ) : tab === "cliente" ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-sm font-semibold text-slate-900">{active.customerName}</p>
                <p className="text-xs text-slate-500">+{active.customerPhone}</p>
                {active.assignedTo ? (
                  <p className="mt-1 text-[11px] text-slate-500">Atendente: {active.assignedTo.name}</p>
                ) : null}
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600">Nome</label>
                <input
                  className="atlas-field mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none"
                  value={contactDraft.customerName}
                  onChange={(e) => setContactDraft((s) => ({ ...s, customerName: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600">Telefone</label>
                <input
                  className="atlas-field mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none"
                  value={contactDraft.customerPhone}
                  onChange={(e) => setContactDraft((s) => ({ ...s, customerPhone: e.target.value }))}
                />
              </div>
              <Button className="h-9 w-full text-xs" variant="glass" onClick={() => void onSaveContact()}>
                Salvar cliente
              </Button>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-[11px] font-semibold text-slate-600">Transferir atendimento</p>
                <AppCombobox
                  value={transferAgentId}
                  onChange={setTransferAgentId}
                  searchable
                  className="mt-2"
                  options={agents.map((agent) => ({
                    value: agent.id,
                    label: agent.name,
                    description: agent.team?.name ?? agent.role
                  }))}
                />
                <textarea
                  className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-blue-300"
                  rows={2}
                  placeholder={INBOX_COPY.transferNotePlaceholder}
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                />
                <Button
                  className="mt-2 h-8 w-full text-xs"
                  variant="glass"
                  disabled={transferring || !transferAgentId || transferAgentId === active.assignedToId}
                  onClick={() => {
                    const agent = agents.find((item) => item.id === transferAgentId);
                    if (!agent) return;
                    void onTransfer(agent, transferNote.trim() || undefined);
                  }}
                >
                  {transferring ? <Loader2 size={14} className="animate-spin" /> : "Transferir"}
                </Button>
              </div>
              <Button
                className="h-9 w-full text-xs text-amber-800"
                variant="glass"
                onClick={() => void onDelete()}
              >
                <Trash2 size={14} />
                Arquivar conversa
              </Button>
            </div>
          ) : tab === "crm" ? (
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-medium text-slate-600">{INBOX_COPY.cadenceLabel}</label>
                <select
                  className="atlas-field mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none"
                  value={cadenceDraft}
                  onChange={(e) => setCadenceDraft(e.target.value)}
                >
                  <option value="padrao">Padrão</option>
                  <option value="acelerada">Acelerada</option>
                  <option value="consultiva">Consultiva</option>
                  <option value="reativação">Reativação</option>
                </select>
                <Button className="mt-2 h-8 text-xs" variant="glass" onClick={() => void onSaveCadence()}>
                  {INBOX_COPY.saveCadence}
                </Button>
              </div>
              {active.lead ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm">
                  <p className="font-semibold text-slate-800">{active.lead.company}</p>
                  <p className="mt-1 text-xs text-slate-600">Etapa: {active.lead.status}</p>
                  <p className="text-xs text-slate-600">Valor: R$ {Number(active.lead.value).toLocaleString("pt-BR")}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Nenhum lead vinculado a esta conversa.</p>
              )}
            </div>
          ) : tab === "tags" ? (
            <ConversationTagEditor
              tags={active.tags}
              catalog={tagCatalog}
              saving={tagsSaving}
              onChange={onTagsChange}
            />
          ) : tab === "notas" ? (
            <ConversationActivityPanel token={token} conversationId={active.id} agents={agents} mode="notes" />
          ) : (
            <ConversationActivityPanel token={token} conversationId={active.id} agents={agents} mode="history" />
          )}
        </div>
      </aside>
    </div>
  );
}
