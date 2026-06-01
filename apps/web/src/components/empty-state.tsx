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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
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
