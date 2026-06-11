"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "../utils/cn";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;
export const SheetTitle = Dialog.Title;
export const SheetDescription = Dialog.Description;

type SheetSide = "right" | "bottom";

const sideClasses: Record<SheetSide, string> = {
  right:
    "inset-y-0 right-0 h-full w-[min(92vw,400px)] border-l data-[state=open]:animate-atlas-slide-in-right data-[state=closed]:animate-atlas-slide-out-right",
  bottom:
    "inset-x-0 bottom-0 max-h-[88dvh] w-full rounded-t-atlas-xl border-t pb-[env(safe-area-inset-bottom)] data-[state=open]:animate-atlas-slide-in-bottom data-[state=closed]:animate-atlas-slide-out-bottom"
};

export interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof Dialog.Content> {
  side?: SheetSide;
  showClose?: boolean;
}

export function SheetContent({ side = "right", showClose = true, className, children, ...props }: SheetContentProps) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[70] bg-slate-950/35 backdrop-blur-[3px] data-[state=open]:animate-atlas-fade-in data-[state=closed]:animate-atlas-fade-out" />
      <Dialog.Content
        className={cn(
          "fixed z-[71] flex flex-col overflow-hidden border-slate-200/70 bg-white shadow-2xl outline-none dark:border-slate-700/70 dark:bg-slate-900",
          sideClasses[side],
          className
        )}
        {...props}
      >
        {showClose ? (
          <Dialog.Close
            aria-label="Fechar"
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors duration-atlas ease-atlas hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={16} />
          </Dialog.Close>
        ) : null}
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
