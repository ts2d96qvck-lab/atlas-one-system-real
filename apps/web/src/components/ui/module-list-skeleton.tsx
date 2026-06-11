"use client";

import { Card, Skeleton } from "@atlas-one/ui";

export function ModuleListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando conteúdo">
      {Array.from({ length: rows }).map((_, index) => (
        <Card key={index} className="atlas-v5-card-pad-sm">
          <Skeleton className="mb-2 h-4 w-40" />
          <Skeleton className="mb-3 h-3 w-56" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </Card>
      ))}
    </div>
  );
}
