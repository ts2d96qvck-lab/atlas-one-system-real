import * as React from "react";
import { cn } from "../utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-11 w-full rounded-2xl border border-white/70 bg-white/70 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";

