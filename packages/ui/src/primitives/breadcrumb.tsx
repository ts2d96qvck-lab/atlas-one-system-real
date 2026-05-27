import * as React from "react";
import { cn } from "../utils/cn";

export function Breadcrumb({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <nav aria-label="Breadcrumb" className={cn("flex items-center gap-2 text-sm text-slate-500", className)} {...props} />;
}

export function BreadcrumbItem({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex items-center gap-2", className)} {...props} />;
}

export function BreadcrumbSeparator() {
  return <span aria-hidden="true" className="text-slate-300">/</span>;
}

