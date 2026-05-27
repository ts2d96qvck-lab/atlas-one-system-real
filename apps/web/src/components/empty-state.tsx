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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200/80 bg-white/40 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/30">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
        <Icon size={22} />
      </div>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">{description}</p>
      {actionLabel && onAction ? (
        <Button className="mt-4 h-9 px-4 text-xs" variant="glass" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
