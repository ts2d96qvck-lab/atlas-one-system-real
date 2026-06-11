import * as React from "react";
import { cn } from "../utils/cn";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

/** Shimmering placeholder. Style via className (height/width/rounded). */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div aria-hidden className={cn("atlas-skeleton", className)} {...props} />;
}

/** Stack of text-line skeletons. */
export function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="atlas-skeleton h-3.5" style={{ width: `${100 - i * 12}%` }} />
      ))}
    </div>
  );
}
