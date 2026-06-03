import * as React from "react";
import { cn } from "../utils/cn";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("atlas-v5-card", className)}
      {...props}
    />
  )
);

Card.displayName = "Card";
