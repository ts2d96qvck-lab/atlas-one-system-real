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
    <header className="atlas-v5-header">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`atlas-v5-icon-badge ${iconClassName ?? ""}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="atlas-v5-kicker">{section}</p>
          <h1 className="atlas-v5-title truncate">{title}</h1>
          {description ? <p className="atlas-v5-subtitle">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
