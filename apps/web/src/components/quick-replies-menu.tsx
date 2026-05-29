"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Hash, Search } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@atlas-one/ui";
import type { ShortcutItem } from "../lib/api";

type QuickRepliesMenuProps = {
  shortcuts: ShortcutItem[];
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (shortcut: ShortcutItem) => void;
};

export function QuickRepliesMenu({ shortcuts, disabled, open, onOpenChange, onSelect }: QuickRepliesMenuProps) {
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shortcuts;
    return shortcuts.filter(
      (item) => item.tag.toLowerCase().includes(q) || item.text.toLowerCase().includes(q)
    );
  }, [query, shortcuts]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setHighlightIndex(0);
      return;
    }
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>(`[data-shortcut-index="${highlightIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, open]);

  function pick(item: ShortcutItem) {
    onSelect(item);
    onOpenChange(false);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (e.key === "Enter" && filtered[highlightIndex]) {
      e.preventDefault();
      pick(filtered[highlightIndex]);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    }
  }

  if (!shortcuts.length) return null;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="glass"
          size="icon"
          disabled={disabled}
          aria-label="Respostas rapidas"
          title="Respostas rapidas (Ctrl+K)"
        >
          <Hash size={18} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-[min(100vw-2rem,360px)] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
      >
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
          <Search size={14} className="shrink-0 text-slate-400" />
          <input
            ref={searchRef}
            className="w-full bg-transparent text-sm outline-none"
            placeholder="Buscar por tag ou texto..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
        <div ref={listRef} className="max-h-64 overflow-auto">
          {filtered.map((item, index) => (
            <button
              key={item.tag}
              type="button"
              data-shortcut-index={index}
              className={`flex w-full flex-col rounded-xl px-2.5 py-2 text-left transition ${
                index === highlightIndex ? "bg-blue-50 text-blue-900" : "hover:bg-slate-50"
              }`}
              onMouseEnter={() => setHighlightIndex(index)}
              onClick={() => pick(item)}
            >
              <span className="text-sm font-semibold">{item.tag}</span>
              <span className="line-clamp-2 text-xs text-slate-500">{item.text}</span>
            </button>
          ))}
          {!filtered.length ? (
            <p className="px-2 py-3 text-xs text-slate-500">Nenhuma resposta rapida encontrada.</p>
          ) : null}
        </div>
        <p className="mt-2 px-1 text-[10px] text-slate-400">Setas para navegar · Enter para inserir · Esc para fechar</p>
      </PopoverContent>
    </Popover>
  );
}
