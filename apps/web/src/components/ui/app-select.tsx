"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@atlas-one/ui";

export type AppSelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type AppSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: AppSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  searchable?: boolean;
  emptyLabel?: string;
  className?: string;
};

export function AppSelect({
  value,
  onChange,
  options,
  placeholder = "Selecionar",
  disabled,
  loading,
  searchable = false,
  emptyLabel = "Nenhuma opcao disponivel",
  className = ""
}: AppSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((item) => item.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (item) => item.label.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q)
    );
  }, [options, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || loading}
          className={`flex h-9 w-full items-center justify-between rounded-xl border border-slate-200 bg-white/90 px-3 text-left text-sm text-slate-700 shadow-sm transition hover:border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        >
          <span className="truncate">{loading ? "Carregando..." : selected?.label ?? placeholder}</span>
          {loading ? <Loader2 size={14} className="animate-spin text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(100vw-2rem,320px)] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
        {searchable ? (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
            <Search size={14} className="text-slate-400" />
            <input
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Buscar..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        ) : null}
        <div className="max-h-64 overflow-auto">
          {filtered.map((item) => (
            <button
              key={item.value}
              type="button"
              disabled={item.disabled}
              className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-sm transition ${
                item.value === value ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"
              } ${item.disabled ? "cursor-not-allowed opacity-50" : ""}`}
              onClick={() => {
                if (item.disabled) return;
                onChange(item.value);
                setOpen(false);
                setQuery("");
              }}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{item.label}</p>
                {item.description ? <p className="truncate text-xs text-slate-500">{item.description}</p> : null}
              </div>
              {item.value === value ? <Check size={14} /> : null}
            </button>
          ))}
          {!filtered.length ? <p className="px-2 py-3 text-xs text-slate-500">{emptyLabel}</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AppCombobox(props: AppSelectProps) {
  return <AppSelect {...props} searchable />;
}
