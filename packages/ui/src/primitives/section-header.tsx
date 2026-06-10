import * as React from "react";
import { cn } from "../utils/cn";

export interface SectionHeaderProps {
  kicker?: string;
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/** Standard in-card section header: optional kicker, title, description, right-aligned actions. */
export function SectionHeader({ kicker, title, description, icon, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? <span className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500">{icon}</span> : null}
        <div className="min-w-0">
          {kicker ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              {kicker}
            </p>
          ) : null}
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
          {description ? <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
