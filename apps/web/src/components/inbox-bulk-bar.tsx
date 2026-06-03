"use client";

import { useState } from "react";
import { Archive, Loader2, MoreHorizontal, Tag, UserRound, X } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@atlas-one/ui";
import type { TagCatalogItem, TeamRow, UserRow } from "../lib/api";
import { conversationStatusLabel, LIFECYCLE_STATUSES, type LifecycleStatus } from "../lib/product-copy";
import { AppCombobox } from "./ui/app-select";

type Props = {
  count: number;
  working: boolean;
  agents: UserRow[];
  teams: TeamRow[];
  tagCatalog: TagCatalogItem[];
  onClear: () => void;
  onTransfer: (agentId: string, note?: string) => void | Promise<void>;
  onAddTags: (tags: string[]) => void | Promise<void>;
  onStatus: (status: LifecycleStatus) => void | Promise<void>;
  onArchive: () => void | Promise<void>;
  onDepartment: (teamId: string | null) => void | Promise<void>;
};

export function InboxBulkBar({
  count,
  working,
  agents,
  teams,
  tagCatalog,
  onClear,
  onTransfer,
  onAddTags,
  onStatus,
  onArchive,
  onDepartment
}: Props) {
  const [transferAgentId, setTransferAgentId] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [statusValue, setStatusValue] = useState<LifecycleStatus>("resolved");
  const [teamId, setTeamId] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  if (count <= 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20">
      <div className="inbox-v42-bulk pointer-events-auto px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold tracking-tight">
            {count} selecionada{count === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            className="rounded-full p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
            onClick={onClear}
            aria-label="Limpar seleção"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <AppCombobox
            value={transferAgentId}
            onChange={setTransferAgentId}
            searchable
            className="min-w-[7.5rem] flex-1 [&_button]:h-8 [&_button]:border-white/15 [&_button]:bg-white/10 [&_button]:text-xs [&_button]:text-white"
            options={[
              { value: "", label: "Transferir para…" },
              ...agents.map((agent) => ({
                value: agent.id,
                label: agent.name,
                description: agent.team?.name ?? agent.role
              }))
            ]}
          />
          <Button
            type="button"
            className="h-8 shrink-0 rounded-lg bg-white px-3 text-xs font-medium text-slate-900 hover:bg-slate-100"
            disabled={working || !transferAgentId}
            onClick={() => void onTransfer(transferAgentId)}
          >
            <UserRound size={14} className="mr-1 inline" />
            Transferir
          </Button>
          <select
            className="h-8 max-w-[7rem] rounded-lg border border-white/15 bg-white/10 px-2 text-xs text-white outline-none"
            value={statusValue}
            onChange={(e) => setStatusValue(e.target.value as LifecycleStatus)}
          >
            {LIFECYCLE_STATUSES.map((status) => (
              <option key={status} value={status} className="text-slate-900">
                {conversationStatusLabel(status)}
              </option>
            ))}
          </select>
          <Button
            type="button"
            className="h-8 rounded-lg border border-white/15 bg-white/10 px-2.5 text-xs text-white hover:bg-white/15"
            disabled={working}
            onClick={() => void onStatus(statusValue)}
          >
            Status
          </Button>
          <Button
            type="button"
            className="h-8 rounded-lg bg-amber-500/90 px-2.5 text-xs font-medium text-white hover:bg-amber-500"
            disabled={working}
            onClick={() => void onArchive()}
          >
            {working ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
          </Button>
          <Popover open={moreOpen} onOpenChange={setMoreOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                className="h-8 w-8 rounded-lg border border-white/15 bg-white/10 p-0 text-white hover:bg-white/15"
                aria-label="Mais ações em lote"
              >
                <MoreHorizontal size={16} />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
              <p className="text-[11px] font-semibold text-slate-600">Mais ações</p>
              <div className="flex gap-1">
                <Tag size={13} className="mt-2 shrink-0 text-slate-400" />
                <input
                  list="inbox-bulk-tags"
                  className="atlas-field h-8 min-w-0 flex-1 px-2 text-xs"
                  placeholder="Nova tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tagInput.trim()) {
                      void onAddTags([tagInput.trim()]);
                      setTagInput("");
                      setMoreOpen(false);
                    }
                  }}
                />
                <datalist id="inbox-bulk-tags">
                  {tagCatalog.map((tag) => (
                    <option key={tag.name} value={tag.name} />
                  ))}
                </datalist>
                <Button
                  type="button"
                  className="h-8 px-2 text-xs"
                  disabled={working || !tagInput.trim()}
                  onClick={() => {
                    if (!tagInput.trim()) return;
                    void onAddTags([tagInput.trim()]);
                    setTagInput("");
                    setMoreOpen(false);
                  }}
                >
                  Tag
                </Button>
              </div>
              <select
                className="atlas-field h-8 w-full px-2 text-xs"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
              >
                <option value="">Departamento…</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="glass"
                className="h-8 w-full text-xs"
                disabled={working || !teamId}
                onClick={() => {
                  void onDepartment(teamId || null);
                  setMoreOpen(false);
                }}
              >
                Aplicar departamento
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
