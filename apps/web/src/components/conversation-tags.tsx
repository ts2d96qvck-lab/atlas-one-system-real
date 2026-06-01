"use client";

import { useMemo, useState } from "react";
import { Filter, Plus, X } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@atlas-one/ui";
import type { TagCatalogItem } from "../lib/api";
import { conversationDisplayTags, tagChipStyle } from "../lib/inbox-tags";

type ConversationTagChipsProps = {
  tags: unknown;
  catalog: TagCatalogItem[];
  compact?: boolean;
  className?: string;
};

export function ConversationTagChips({ tags, catalog, compact, className = "" }: ConversationTagChipsProps) {
  const visible = conversationDisplayTags(tags);
  const shown = compact ? visible.slice(0, 1) : visible;
  const overflow = compact ? Math.max(0, visible.length - shown.length) : 0;

  if (!visible.length) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {shown.map((tag) => (
        <span
          key={tag}
          className="inline-flex max-w-[120px] truncate rounded-full border px-2 py-0.5 text-[10px] font-medium"
          style={tagChipStyle(tag, catalog)}
          title={tag}
        >
          {tag}
        </span>
      ))}
      {overflow ? <span className="text-[10px] text-slate-500">+{overflow}</span> : null}
    </div>
  );
}

type ConversationTagEditorProps = {
  tags: unknown;
  catalog: TagCatalogItem[];
  disabled?: boolean;
  saving?: boolean;
  onChange: (tags: string[]) => void | Promise<void>;
};

export function ConversationTagEditor({ tags, catalog, disabled, saving, onChange }: ConversationTagEditorProps) {
  const [open, setOpen] = useState(false);
  const [customTag, setCustomTag] = useState("");
  const current = useMemo(() => conversationDisplayTags(tags), [tags]);

  const available = useMemo(
    () => catalog.filter((item) => !current.some((tag) => tag.toLowerCase() === item.name.toLowerCase())),
    [catalog, current]
  );

  async function removeTag(name: string) {
    await onChange(current.filter((tag) => tag.toLowerCase() !== name.toLowerCase()));
  }

  async function addTag(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (current.some((tag) => tag.toLowerCase() === trimmed.toLowerCase())) return;
    await onChange([...current, trimmed]);
    setCustomTag("");
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <ConversationTagChips tags={tags} catalog={catalog} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="glass" className="h-7 px-2 text-[10px]" disabled={disabled || saving}>
            {saving ? "Salvando..." : "Tags"}
            <Plus size={12} className="ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(100vw-2rem,280px)] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <p className="mb-2 text-xs font-semibold text-slate-700">Tags da conversa</p>
          <div className="mb-2 flex flex-wrap gap-1">
            {current.length ? (
              current.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                  style={tagChipStyle(tag, catalog)}
                  onClick={() => void removeTag(tag)}
                  title="Remover tag"
                >
                  {tag}
                  <X size={10} />
                </button>
              ))
            ) : (
              <p className="text-[11px] text-slate-500">Nenhuma tag aplicada.</p>
            )}
          </div>
          {available.length ? (
            <div className="mb-2 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Catalogo</p>
              <div className="flex flex-wrap gap-1">
                {available.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    className="rounded-full border px-2 py-0.5 text-[10px] font-medium hover:opacity-80"
                    style={tagChipStyle(item.name, catalog)}
                    onClick={() => void addTag(item.name)}
                  >
                    + {item.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-blue-300"
              placeholder="Nova tag..."
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addTag(customTag);
                }
              }}
            />
            <Button type="button" className="h-8 px-2 text-xs" disabled={!customTag.trim()} onClick={() => void addTag(customTag)}>
              Add
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

type TagFilterBarProps = {
  catalog: TagCatalogItem[];
  selected: string[];
  onChange: (selected: string[]) => void;
  compact?: boolean;
};

export function TagFilterBar({ catalog, selected, onChange, compact = false }: TagFilterBarProps) {
  if (!catalog.length) return null;

  function toggle(name: string) {
    const key = name.toLowerCase();
    if (selected.some((tag) => tag.toLowerCase() === key)) {
      onChange(selected.filter((tag) => tag.toLowerCase() !== key));
      return;
    }
    onChange([...selected, name]);
  }

  return (
    <div className={`${compact ? "mt-1.5 rounded-lg p-1.5" : "mt-2 rounded-xl p-2"} border border-slate-200 bg-white/85`}>
      {!compact ? <p className="mb-1 text-[10px] font-semibold text-slate-500">Filtrar por tag</p> : null}
      <div className="flex flex-wrap items-center gap-1">
        {compact && !selected.length ? (
          <span className="text-[10px] font-semibold text-slate-500">Tags</span>
        ) : null}
        {catalog.map((item) => {
          const active = selected.some((tag) => tag.toLowerCase() === item.name.toLowerCase());
          return (
            <button
              key={item.name}
              type="button"
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                active ? "ring-1 ring-blue-300" : "opacity-80 hover:opacity-100"
              }`}
              style={tagChipStyle(item.name, catalog)}
              onClick={() => toggle(item.name)}
            >
              {item.name}
            </button>
          );
        })}
        {selected.length ? (
          <button type="button" className="rounded-full px-2 py-0.5 text-[10px] text-slate-500 underline" onClick={() => onChange([])}>
            Limpar
          </button>
        ) : null}
      </div>
    </div>
  );
}

type TagFilterPopoverProps = {
  catalog: TagCatalogItem[];
  selected: string[];
  onChange: (selected: string[]) => void;
  embedded?: boolean;
};

function TagFilterContent({ catalog, selected, onChange }: Omit<TagFilterPopoverProps, "embedded">) {
  if (!catalog.length) return <p className="text-[11px] text-slate-500">Nenhuma tag disponivel.</p>;

  function toggle(name: string) {
    const key = name.toLowerCase();
    if (selected.some((tag) => tag.toLowerCase() === key)) {
      onChange(selected.filter((tag) => tag.toLowerCase() !== key));
      return;
    }
    onChange([...selected, name]);
  }

  return (
    <>
      <p className="mb-2 text-[11px] font-medium text-slate-500">Tags</p>
      <div className="flex flex-wrap gap-1">
        {catalog.map((item) => {
          const active = selected.some((tag) => tag.toLowerCase() === item.name.toLowerCase());
          return (
            <button
              key={item.name}
              type="button"
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                active ? "bg-slate-100 ring-1 ring-slate-300" : "opacity-80 hover:opacity-100"
              }`}
              style={tagChipStyle(item.name, catalog)}
              onClick={() => toggle(item.name)}
            >
              {item.name}
            </button>
          );
        })}
      </div>
      {selected.length ? (
        <button type="button" className="mt-2 text-[11px] text-slate-500 underline" onClick={() => onChange([])}>
          Limpar tags
        </button>
      ) : null}
    </>
  );
}

export function TagFilterPopover({ catalog, selected, onChange, embedded }: TagFilterPopoverProps) {
  if (embedded) {
    return <TagFilterContent catalog={catalog} selected={selected} onChange={onChange} />;
  }

  if (!catalog.length) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="glass" className="h-8 px-2.5 text-[11px]" title="Filtrar conversas">
          <Filter size={13} />
          Filtros
          {selected.length ? (
            <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px]">{selected.length}</span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(100vw-2rem,300px)] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
        <TagFilterContent catalog={catalog} selected={selected} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}
