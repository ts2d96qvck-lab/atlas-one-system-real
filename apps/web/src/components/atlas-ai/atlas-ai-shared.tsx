"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Check, Copy, Loader2, RefreshCw, Sparkles, X, type LucideIcon } from "lucide-react";
import { Button } from "@atlas-one/ui";
import { getAtlasAiStatus, type AtlasAiResponse } from "../../lib/atlas-ai";
import type { SessionUser } from "../../lib/api";
import { canUseAtlasAi, hasFullAccess, hasPermission } from "../../lib/session-user";

export type AtlasAiAccessState = "loading" | "ready" | "unconfigured" | "denied" | "error";

export function AtlasAiHero() {
  return (
    <header className="atlas-ai-hero">
      <div className="atlas-ai-hero-glow" aria-hidden />
      <div className="atlas-ai-hero-inner">
        <span className="atlas-ai-hero-badge">
          <Sparkles size={20} />
        </span>
        <div className="min-w-0">
          <p className="atlas-ai-hero-title">
            <span aria-hidden>✨</span> Atlas AI
          </p>
          <p className="atlas-ai-hero-subtitle">Copiloto inteligente da operação</p>
        </div>
      </div>
    </header>
  );
}

export function AtlasAiShell({ subtitle, children }: { subtitle?: string; children: ReactNode }) {
  return (
    <div className="atlas-ai-shell">
      <AtlasAiHero />
      {subtitle ? <p className="atlas-ai-shell-subline">{subtitle}</p> : null}
      {children}
    </div>
  );
}

export function AtlasAiConfigureEmpty() {
  return (
    <div className="atlas-ai-empty atlas-ai-empty-premium">
      <span className="atlas-ai-empty-icon">
        <Sparkles size={22} />
      </span>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Quase pronto para sua equipe</p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
        O administrador precisa conectar as chaves de IA no servidor. Depois disso, resumos, respostas e handoffs ficam disponíveis em um clique.
      </p>
      <ul className="atlas-ai-empty-features">
        <li>Resumos instantâneos</li>
        <li>Respostas no tom certo</li>
        <li>Próxima ação priorizada</li>
      </ul>
    </div>
  );
}

export function AtlasAiPermissionEmpty() {
  return (
    <div className="atlas-ai-empty atlas-ai-empty-premium">
      <span className="atlas-ai-empty-icon">
        <Sparkles size={22} />
      </span>
      <p className="text-sm font-semibold text-slate-800">Atlas AI — recurso premium</p>
      <p className="mt-1.5 text-xs text-slate-500">Peça ao gestor a permissão <strong>Atlas AI</strong> para liberar o copiloto na sua equipe.</p>
    </div>
  );
}

export function AtlasAiHubActionCard({
  icon: Icon,
  title,
  benefit,
  cta,
  active,
  loading,
  ready,
  disabled,
  onSelect,
  onRun
}: {
  icon: LucideIcon;
  title: string;
  benefit: string;
  cta: string;
  active?: boolean;
  loading?: boolean;
  ready?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onRun: () => void;
}) {
  return (
    <article className={`atlas-ai-hub-card ${active ? "atlas-ai-hub-card-active" : ""} ${ready ? "atlas-ai-hub-card-ready" : ""}`}>
      <button type="button" className="atlas-ai-hub-card-main" onClick={onSelect}>
        <span className="atlas-ai-hub-card-icon">
          <Icon size={18} />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="atlas-ai-hub-card-title">{title}</span>
          <span className="atlas-ai-hub-card-benefit">{benefit}</span>
        </span>
        {ready ? <span className="atlas-ai-hub-card-dot" title="Resultado disponível" /> : null}
      </button>
      <Button
        className="atlas-ai-hub-card-cta"
        disabled={disabled || loading}
        onClick={(e) => {
          e.stopPropagation();
          onRun();
        }}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : cta}
      </Button>
    </article>
  );
}

export function AtlasAiHubWorkspace({
  title,
  children,
  error,
  onClose
}: {
  title: string;
  children: ReactNode;
  error?: string;
  onClose: () => void;
}) {
  return (
    <section className="atlas-ai-workspace">
      <div className="atlas-ai-workspace-head">
        <p className="atlas-ai-workspace-title">{title}</p>
        <button type="button" className="atlas-ai-workspace-close" onClick={onClose} aria-label="Fechar">
          <X size={14} />
        </button>
      </div>
      {error ? <p className="atlas-ai-workspace-error">{error}</p> : null}
      <div className="atlas-ai-workspace-body">{children}</div>
    </section>
  );
}

export function AtlasAiHubLoading({ label }: { label: string }) {
  return (
    <div className="atlas-ai-hub-loading">
      <div className="atlas-ai-hub-loading-shimmer" aria-hidden />
      <Loader2 size={16} className="animate-spin text-violet-600" />
      <span>{label}</span>
    </div>
  );
}

export function AtlasAiExecutiveQuote({ text, label }: { text: string; label?: string }) {
  if (!text.trim()) return null;
  return (
    <blockquote className="atlas-ai-executive-quote">
      {label ? <p className="atlas-ai-executive-label">{label}</p> : null}
      <p>{text}</p>
    </blockquote>
  );
}

export function AtlasAiExecutiveField({
  label,
  value,
  highlight
}: {
  label: string;
  value?: string | null;
  highlight?: boolean;
}) {
  if (!value?.trim()) return null;
  return (
    <div className={`atlas-ai-executive-field ${highlight ? "atlas-ai-executive-field-highlight" : ""}`}>
      <p className="atlas-ai-executive-label">{label}</p>
      <p className="atlas-ai-executive-value">{value}</p>
    </div>
  );
}

export function AtlasAiExecutiveList({
  label,
  items,
  variant
}: {
  label: string;
  items?: string[];
  variant?: "default" | "risk";
}) {
  if (!items?.length) return null;
  return (
    <div className={`atlas-ai-executive-list ${variant === "risk" ? "atlas-ai-executive-list-risk" : ""}`}>
      <p className="atlas-ai-executive-label">{label}</p>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function AtlasAiPriorityBadge({ value }: { value?: string }) {
  if (!value) return null;
  const v = value.toLowerCase();
  const cls = v.includes("alta") ? "alta" : v.includes("media") ? "media" : "baixa";
  return (
    <div className="atlas-ai-priority-badge">
      <span className="atlas-ai-executive-label">Prioridade</span>
      <span className={`atlas-ai-priority-chip atlas-ai-priority-${cls}`}>{value}</span>
    </div>
  );
}

export function useAtlasAiAccess(token: string, user?: SessionUser): AtlasAiAccessState {
  const [state, setState] = useState<AtlasAiAccessState>("loading");
  const permissionKey = user?.permissions?.join("|") ?? "";
  const fullAccess = user ? hasFullAccess(user) : false;

  useEffect(() => {
    let cancelled = false;

    if (user && !canUseAtlasAi(user)) {
      setState("denied");
      return () => {
        cancelled = true;
      };
    }

    void getAtlasAiStatus(token)
      .then((status) => {
        if (cancelled) return;
        const configured = !!status.configured && status.ready !== false;
        if (!configured) {
          setState("unconfigured");
          return;
        }
        if (status.canUse === false && !fullAccess) {
          setState("denied");
          return;
        }
        setState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        if (fullAccess || (user && canUseAtlasAi(user))) {
          setState("ready");
          return;
        }
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [token, user?.id, user?.role, permissionKey, fullAccess]);

  return state;
}

/** @deprecated Prefer useAtlasAiAccess for permission-aware UI. */
export function useAtlasAiReady(token: string, user?: SessionUser) {
  const access = useAtlasAiAccess(token, user);
  if (access === "loading") return null;
  return access === "ready";
}

export function AtlasAiAccessFallback({ access }: { access: AtlasAiAccessState }) {
  if (access === "loading") return <AtlasAiHubLoading label="Verificando Atlas AI…" />;
  if (access === "denied") return <AtlasAiPermissionEmpty />;
  if (access === "unconfigured") return <AtlasAiConfigureEmpty />;
  if (access === "error") {
    return (
      <div className="atlas-ai-empty atlas-ai-empty-premium">
        <p className="text-sm font-semibold text-slate-800">Não foi possível verificar agora</p>
        <p className="mt-1.5 text-xs text-slate-500">Tente novamente em instantes ou recarregue a página.</p>
      </div>
    );
  }
  return null;
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
  regenerateLabel = "Gerar novamente",
  copied
}: {
  onPrimary?: () => void;
  primaryLabel?: string;
  onCopy?: () => void;
  onRegenerate?: () => void;
  regenerateLabel?: string;
  copied?: boolean;
}) {
  return (
    <div className="atlas-ai-action-bar">
      {onPrimary && primaryLabel ? (
        <Button className="atlas-ai-action-primary" onClick={onPrimary}>
          {primaryLabel}
        </Button>
      ) : null}
      {onCopy ? (
        <Button variant="glass" className="atlas-ai-action-secondary" onClick={onCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      ) : null}
      {onRegenerate ? (
        <Button variant="glass" className="atlas-ai-action-secondary" onClick={onRegenerate}>
          <RefreshCw size={14} />
          {regenerateLabel}
        </Button>
      ) : null}
    </div>
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
