"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@atlas-one/ui";

type Props = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  tone?: "warning" | "danger";
};

export function ViewStateBanner({ message, onRetry, retryLabel = "Tentar novamente", tone = "warning" }: Props) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200/80 bg-rose-50/90 text-rose-900 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-100"
      : "border-amber-200/80 bg-amber-50/90 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/35 dark:text-amber-50";

  return (
    <div role="alert" className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm ${toneClass}`}>
      <p className="inline-flex min-w-0 flex-1 items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 opacity-80" aria-hidden />
        <span>{message}</span>
      </p>
      {onRetry ? (
        <Button type="button" variant="glass" className="h-8 shrink-0 px-3 text-xs" onClick={onRetry}>
          <RefreshCw size={13} />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
