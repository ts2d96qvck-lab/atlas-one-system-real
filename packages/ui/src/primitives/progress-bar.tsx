import * as React from "react";
import { cn } from "../utils/cn";

export interface ProgressBarProps {
  /** 0..100 */
  value: number;
  tone?: "accent" | "success" | "warning" | "danger";
  className?: string;
  "aria-label"?: string;
}

const toneClass: Record<NonNullable<ProgressBarProps["tone"]>, string> = {
  accent: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500"
};

export function ProgressBar({ value, tone = "accent", className, ...rest }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60", className)}
      {...rest}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-atlas-slow ease-atlas", toneClass[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
