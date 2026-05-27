import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { cn } from "../utils/cn";

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn("inline-flex rounded-2xl bg-white/60 p-1", className)} {...props} />
));

TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn("rounded-xl px-4 py-2 text-sm text-slate-600 transition data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm", className)}
    {...props}
  />
));

TabsTrigger.displayName = "TabsTrigger";
export const TabsContent = TabsPrimitive.Content;

