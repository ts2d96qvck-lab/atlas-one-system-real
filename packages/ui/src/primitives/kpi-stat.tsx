import * as React from "react";
import { cn } from "../utils/cn";

export interface KpiStatProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "accent";
  className?: string;
}

const toneClass: Record<NonNullable<KpiStatProps["tone"]>, string> = {
  default: "text-slate-900 dark:text-slate-100",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-rose-600 dark:text-rose-400",
  accent: "text-blue-600 dark:text-blue-400"
};

/** Unified KPI tile (replaces ad-hoc stat markup). */
export function KpiStat({ label, value, hint, tone = "default", className }: KpiStatProps) {
  return (
    <div className={cn("atlas-v5-stat", className)}>
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tracking-tight", toneClass[tone])}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{hint}</p> : null}
    </div>
  );
}
