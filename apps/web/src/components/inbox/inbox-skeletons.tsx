"use client";

import { Skeleton } from "@atlas-one/ui";

/** Loading placeholder for the conversation queue. */
export function QueueSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="space-y-1 px-2 py-1.5" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 rounded-atlas px-2 py-2.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Loading placeholder for the message thread. */
export function ThreadSkeleton() {
  const widths = ["w-48", "w-64", "w-40", "w-56", "w-44"];
  return (
    <div className="inbox-v43-thread-column space-y-3 px-4 py-6 sm:px-5" aria-hidden>
      {widths.map((w, i) => (
        <div key={i} className={`flex ${i % 2 ? "justify-end" : "justify-start"}`}>
          <Skeleton className={`h-12 ${w} rounded-[1.125rem]`} />
        </div>
      ))}
    </div>
  );
}
