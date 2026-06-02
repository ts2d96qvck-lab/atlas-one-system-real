"use client";

import { useState } from "react";
import { Archive, Loader2, Tag, UserRound, X } from "lucide-react";
import { Button } from "@atlas-one/ui";
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
  const [transferNote, setTransferNote] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [statusValue, setStatusValue] = useState<LifecycleStatus>("resolved");
  const [teamId, setTeamId] = useState("");

  if (count <= 0) return null;

  return (
    <div className="sticky bottom-0 z-10 mt-2 rounded-xl border border-slate-900/10 bg-slate-900 px-3 py-2 text-white shadow-lg">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold">{count} selecionada{count === 1 ? "" : "s"}</span>
        <button type="button" className="rounded-md p-1 hover:bg-white/10" onClick={onClear} aria-label="Limpar seleção">
          <X size={14} />
        </button>
        <span className="hidden h-4 w-px bg-white/20 sm:inline-block" />
        <div className="flex min-w-[140px] flex-1 items-center gap-1">
          <UserRound size={13} className="shrink-0 opacity-70" />
          <AppCombobox
            value={transferAgentId}
            onChange={setTransferAgentId}
            searchable
            className="min-w-0 flex-1 [&_button]:h-7 [&_button]:border-white/20 [&_button]:bg-white/10 [&_button]:text-[11px] [&_button]:text-white"
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
            variant="glass"
            className="h-7 shrink-0 border-white/20 bg-white/10 px-2 text-[10px] text-white hover:bg-white/20"
            disabled={working || !transferAgentId}
            onClick={() => void onTransfer(transferAgentId, transferNote.trim() || undefined)}
          >
            Transferir
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Tag size={13} className="opacity-70" />
          <input
            list="inbox-bulk-tags"
            className="h-7 w-28 rounded-md border border-white/20 bg-white/10 px-2 text-[11px] outline-none placeholder:text-white/50"
            placeholder="Tag"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tagInput.trim()) {
                void onAddTags([tagInput.trim()]);
                setTagInput("");
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
            variant="glass"
            className="h-7 border-white/20 bg-white/10 px-2 text-[10px] text-white hover:bg-white/20"
            disabled={working || !tagInput.trim()}
            onClick={() => {
              if (!tagInput.trim()) return;
              void onAddTags([tagInput.trim()]);
              setTagInput("");
            }}
          >
            Tag
          </Button>
        </div>
        <select
          className="h-7 rounded-md border border-white/20 bg-white/10 px-2 text-[11px] outline-none"
          value={statusValue}
          onChange={(e) => setStatusValue(e.target.value as LifecycleStatus)}
        >
          {LIFECYCLE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {conversationStatusLabel(status)}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="glass"
          className="h-7 border-white/20 bg-white/10 px-2 text-[10px] text-white hover:bg-white/20"
          disabled={working}
          onClick={() => void onStatus(statusValue)}
        >
          Status
        </Button>
        <select
          className="h-7 max-w-[120px] rounded-md border border-white/20 bg-white/10 px-2 text-[11px] outline-none"
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
          className="h-7 border-white/20 bg-white/10 px-2 text-[10px] text-white hover:bg-white/20"
          disabled={working || !teamId}
          onClick={() => void onDepartment(teamId || null)}
        >
          Depto
        </Button>
        <Button
          type="button"
          variant="glass"
          className="h-7 border-amber-200/40 bg-amber-500/20 px-2 text-[10px] text-amber-50 hover:bg-amber-500/30"
          disabled={working}
          onClick={() => void onArchive()}
        >
          {working ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
          Arquivar
        </Button>
      </div>
    </div>
  );
}
