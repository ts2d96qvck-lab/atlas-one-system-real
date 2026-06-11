import * as React from "react";
import { cn } from "../utils/cn";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

export interface StatusBadgeProps {
  tone?: StatusTone;
  /** Show a small leading dot. */
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}

const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  danger: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  info: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  accent: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
};

const dotClasses: Record<StatusTone, string> = {
  neutral: "bg-slate-400",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-sky-500",
  accent: "bg-blue-500"
};

/** Semantic status pill (connection states, campaign status, SLA, etc.). */
export function StatusBadge({ tone = "neutral", dot = false, className, children }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight",
        toneClasses[tone],
        className
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClasses[tone])} /> : null}
      {children}
    </span>
  );
}
