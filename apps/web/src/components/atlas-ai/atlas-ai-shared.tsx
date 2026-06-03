"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Check, Copy, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@atlas-one/ui";
import { getAtlasAiStatus, type AtlasAiResponse } from "../../lib/atlas-ai";

export function AtlasAiShell({ subtitle, children }: { subtitle?: string; children: ReactNode }) {
  return (
    <div className="atlas-ai-shell">
      <div className="atlas-ai-shell-header">
        <span className="atlas-ai-badge">
          <Sparkles size={18} />
        </span>
        <div>
          <p className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">Atlas AI</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle ?? "Assistente inteligente da operação"}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function AtlasAiConfigureEmpty() {
  return (
    <div className="atlas-ai-empty">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Atlas AI em configuração</p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
        Seu administrador pode ativar o assistente para acelerar respostas, resumos e decisões comerciais.
      </p>
    </div>
  );
}

export function AtlasAiPermissionEmpty() {
  return (
    <div className="atlas-ai-empty">
      <p className="text-sm font-semibold text-slate-800">Recurso premium</p>
      <p className="mt-1.5 text-xs text-slate-500">Peça ao gestor a permissão Atlas AI para sua equipe.</p>
    </div>
  );
}

export function useAtlasAiReady(token: string) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    void getAtlasAiStatus(token)
      .then((s) => setConfigured(!!s.configured && s.ready !== false))
      .catch(() => setConfigured(false));
  }, [token]);
  return configured;
}

export function AtlasAiSection({
  title,
  description,
  loading,
  loadingLabel,
  error,
  onRun,
  runLabel,
  disabled,
  children,
  actions
}: {
  title: string;
  description?: string;
  loading?: boolean;
  loadingLabel?: string;
  error?: string;
  onRun: () => void;
  runLabel: string;
  disabled?: boolean;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="atlas-ai-section">
      <div className="atlas-ai-section-head">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{title}</p>
          {description ? <p className="mt-0.5 text-[11px] text-slate-500">{description}</p> : null}
        </div>
        <Button
          variant="glass"
          className="h-8 shrink-0 px-2.5 text-[11px]"
          disabled={disabled || loading}
          onClick={onRun}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : runLabel}
        </Button>
      </div>
      {(loading || error || children) && (
        <div className="atlas-ai-section-body">
          {loading ? (
            <p className="atlas-ai-loading">
              <Loader2 size={14} className="animate-spin" />
              {loadingLabel ?? "Gerando…"}
            </p>
          ) : null}
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
          {children}
          {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      )}
    </div>
  );
}

export function AtlasAiResultCard({ children }: { children: ReactNode }) {
  return <div className="atlas-ai-result-card space-y-2 text-xs text-slate-700 dark:text-slate-200">{children}</div>;
}

export function AtlasAiField({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 leading-relaxed">{value}</p>
    </div>
  );
}

export function AtlasAiList({ label, items }: { label: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <ul className="mt-1 list-disc space-y-1 pl-4">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function AtlasAiPriority({ value }: { value?: string }) {
  if (!value) return null;
  const v = value.toLowerCase();
  const cls = v.includes("alta") ? "atlas-ai-priority-alta" : v.includes("media") ? "atlas-ai-priority-media" : "atlas-ai-priority-baixa";
  return (
    <p className="text-xs">
      Prioridade: <span className={cls}>{value}</span>
    </p>
  );
}

export function AtlasAiActionBar({
  onPrimary,
  primaryLabel,
  onCopy,
  onRegenerate,
  copied
}: {
  onPrimary?: () => void;
  primaryLabel?: string;
  onCopy?: () => void;
  onRegenerate?: () => void;
  copied?: boolean;
}) {
  return (
    <>
      {onPrimary && primaryLabel ? (
        <Button className="h-8 px-2.5 text-[11px]" onClick={onPrimary}>
          {primaryLabel}
        </Button>
      ) : null}
      {onCopy ? (
        <Button variant="glass" className="h-8 gap-1 px-2.5 text-[11px]" onClick={onCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      ) : null}
      {onRegenerate ? (
        <Button variant="glass" className="h-8 gap-1 px-2.5 text-[11px]" onClick={onRegenerate}>
          <RefreshCw size={14} />
          Melhorar novamente
        </Button>
      ) : null}
    </>
  );
}

export function useAiRunner(token: string) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Record<string, AtlasAiResponse>>({});

  const run = useCallback(
    async (key: string, fn: () => Promise<AtlasAiResponse>) => {
      setLoadingKey(key);
      setError("");
      try {
        const res = await fn();
        setResults((prev) => ({ ...prev, [key]: res }));
        return res;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Não consegui gerar agora. Tente novamente em instantes.";
        setError(msg);
        throw err;
      } finally {
        setLoadingKey(null);
      }
    },
    []
  );

  return { loadingKey, error, setError, results, run };
}

export function AtlasAiPills<T extends string>({
  options,
  labels,
  value,
  onChange
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="atlas-ai-pill-row">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={`atlas-ai-pill ${value === opt ? "atlas-ai-pill-active" : ""}`}
          onClick={() => onChange(opt)}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}
