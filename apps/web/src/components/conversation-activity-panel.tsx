"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Loader2, MessageSquareText } from "lucide-react";
import { Button } from "@atlas-one/ui";
import {
  createConversationNote,
  listConversationActivity,
  type ConversationActivityItem,
  type UserRow
} from "../lib/api";

type ConversationActivityPanelProps = {
  token: string;
  conversationId: string | null;
  agents: UserRow[];
  mode?: "all" | "notes" | "history";
};

function formatWhen(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderMentionText(text: string) {
  const parts = text.split(/(@[^\s]+)/g);
  return parts.map((part, index) => {
    if (part.startsWith("@")) {
      return (
        <span key={`${part}-${index}`} className="font-semibold text-blue-700">
          {part}
        </span>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function ActivityCard({ item }: { item: ConversationActivityItem }) {
  if (item.type === "transfer") {
    const fromName = String(item.payload.fromUserName ?? "Sem responsavel");
    const toName = String(item.payload.toUserName ?? "Sem responsavel");
    const note = typeof item.payload.note === "string" ? item.payload.note.trim() : "";
    return (
      <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2 text-xs">
        <p className="inline-flex items-center gap-1 font-semibold text-amber-900">
          <ArrowRightLeft size={12} />
          Transferencia · {item.actor?.name ?? "Sistema"}
        </p>
        <p className="mt-1 text-amber-950">
          {fromName} → {toName}
        </p>
        {note ? <p className="mt-1 whitespace-pre-wrap text-amber-900/90">&ldquo;{note}&rdquo;</p> : null}
        <p className="mt-1 text-[10px] text-amber-700/80">{formatWhen(item.createdAt)}</p>
      </div>
    );
  }

  if (item.type === "note" || item.type === "legacy_note") {
    const text = String(item.payload.text ?? "");
    return (
      <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs">
        <p className="inline-flex items-center gap-1 font-semibold text-slate-700">
          <MessageSquareText size={12} />
          {item.type === "legacy_note" ? "Nota legada" : "Nota interna"} · {item.actor?.name ?? "Equipe"}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-slate-700">{renderMentionText(text)}</p>
        <p className="mt-1 text-[10px] text-slate-500">
          {item.type === "legacy_note" ? "Importada do painel antigo" : formatWhen(item.createdAt)}
        </p>
      </div>
    );
  }

  const assignedToId = item.payload.assignedToId;
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <p className="font-semibold text-slate-700">Atualizacao · {item.actor?.name ?? "Sistema"}</p>
      <p className="mt-1">Responsavel alterado {assignedToId ? `(${String(assignedToId)})` : ""}</p>
      <p className="mt-1 text-[10px] text-slate-500">{formatWhen(item.createdAt)}</p>
    </div>
  );
}

export function ConversationActivityPanel({
  token,
  conversationId,
  agents,
  mode = "all"
}: ConversationActivityPanelProps) {
  const [items, setItems] = useState<ConversationActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!conversationId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await listConversationActivity(token, conversationId);
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return agents
      .filter((agent) => {
        const first = agent.name.split(/\s+/)[0]?.toLowerCase() ?? "";
        return first.includes(q) || agent.name.toLowerCase().includes(q);
      })
      .slice(0, 6);
  }, [agents, mentionQuery]);

  function handleDraftChange(value: string) {
    setDraft(value);
    const match = value.match(/@([a-zA-Z0-9._-]*)$/);
    setMentionQuery(match ? (match[1] ?? "") : null);
  }

  function insertMention(agent: UserRow) {
    const firstName = agent.name.split(/\s+/)[0] ?? agent.name;
    setDraft((current) => current.replace(/@([a-zA-Z0-9._-]*)$/, `@${firstName} `));
    setMentionQuery(null);
  }

  async function submitNote() {
    if (!conversationId || !draft.trim()) return;
    setSaving(true);
    try {
      await createConversationNote(token, conversationId, draft.trim());
      setDraft("");
      setMentionQuery(null);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function importLegacyNote(text: string) {
    if (!conversationId || !text.trim()) return;
    setSaving(true);
    try {
      await createConversationNote(token, conversationId, text.trim());
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  const visibleItems = useMemo(() => {
    if (mode === "notes") return items.filter((item) => item.type === "note" || item.type === "legacy_note");
    return items;
  }, [items, mode]);

  const showComposer = mode === "all" || mode === "notes";

  if (!conversationId) {
    return <p className="text-xs text-atlas-muted">Selecione uma conversa para ver notas e transferencias.</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showComposer ? (
      <div className="space-y-2">
        <textarea
          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-blue-300"
          rows={4}
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          placeholder="Nota interna... use @ para mencionar colega"
        />
        {mentionSuggestions.length ? (
          <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {mentionSuggestions.map((agent) => (
              <button
                key={agent.id}
                type="button"
                className="flex w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50"
                onClick={() => insertMention(agent)}
              >
                <span className="font-semibold text-slate-700">@{agent.name.split(/\s+/)[0]}</span>
                <span className="ml-2 truncate text-slate-500">{agent.name}</span>
              </button>
            ))}
          </div>
        ) : null}
        <Button className="h-8 w-full text-xs" disabled={saving || !draft.trim()} onClick={() => void submitNote()}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : "Adicionar nota"}
        </Button>
      </div>
      ) : null}

      <div className={`atlas-scroll min-h-0 flex-1 space-y-2 overflow-auto pr-1 ${showComposer ? "mt-4" : ""}`}>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin text-slate-400" size={18} />
          </div>
        ) : null}
        {!loading && !visibleItems.length ? (
          <p className="text-xs text-atlas-muted">
            {mode === "notes" ? "Nenhuma nota registrada ainda." : "Nenhuma atividade registrada ainda."}
          </p>
        ) : null}
        {visibleItems.map((item) =>
          item.type === "legacy_note" && mode !== "history" ? (
            <div key={item.id}>
              <ActivityCard item={item} />
              <Button
                variant="glass"
                className="mt-2 h-7 w-full text-[10px]"
                disabled={saving}
                onClick={() => void importLegacyNote(String(item.payload.text ?? ""))}
              >
                Importar nota legada para timeline
              </Button>
            </div>
          ) : (
            <ActivityCard key={item.id} item={item} />
          )
        )}
      </div>
    </div>
  );
}
