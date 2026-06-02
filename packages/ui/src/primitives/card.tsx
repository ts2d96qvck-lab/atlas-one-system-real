import * as React from "react";
import { cn } from "../utils/cn";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "atlas-glass-card border border-white/60 bg-white/80 shadow-glass backdrop-blur-glass dark:border-slate-700/60 dark:bg-slate-900/70",
        className
      )}
      {...props}
    />
  )
);

Card.displayName = "Card";
