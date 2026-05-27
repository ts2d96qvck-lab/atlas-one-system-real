import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-blue-600 text-white shadow-glass hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400",
        glass:
          "border border-slate-200/90 bg-white/90 text-slate-700 shadow-sm hover:bg-white dark:border-slate-600 dark:bg-slate-800/85 dark:text-slate-100 dark:hover:bg-slate-700/80",
        ghost: "text-slate-700 hover:bg-white/60 dark:text-slate-200 dark:hover:bg-slate-800/60"
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4",
        icon: "h-12 w-12 rounded-full"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);

Button.displayName = "Button";

