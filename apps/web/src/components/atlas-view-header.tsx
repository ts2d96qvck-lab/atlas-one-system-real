"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  icon: LucideIcon;
  section: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  iconClassName?: string;
};

export function AtlasViewHeader({ icon: Icon, section, title, description, actions, iconClassName }: Props) {
  return (
    <header className="glass-panel mb-5 flex flex-wrap items-center justify-between gap-4 rounded-atlas-lg p-4 sm:p-5">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-atlas border border-white/70 bg-slate-900 text-cyan-300 shadow-sm ${iconClassName ?? ""}`}
        >
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="atlas-section-title">{section}</p>
          <h1 className="truncate text-xl font-semibold text-slate-900 sm:text-2xl lg:text-3xl">{title}</h1>
          {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
