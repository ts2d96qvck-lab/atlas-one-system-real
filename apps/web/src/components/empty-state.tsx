"use client";

import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { Button } from "@atlas-one/ui";

type Props = {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon: Icon = Inbox, title, description, actionLabel, onAction }: Props) {
  return (
    <div className="atlas-v5-empty">
      <div className="atlas-v5-empty-icon">
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
      {actionLabel && onAction ? (
        <Button className="mt-5 h-9 px-4 text-xs" variant="glass" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
