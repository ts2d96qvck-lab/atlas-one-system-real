import * as React from "react";
import { cn } from "../utils/cn";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("glass-panel rounded-[32px]", className)}
      {...props}
    />
  )
);

Card.displayName = "Card";

