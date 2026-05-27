import * as Dialog from "@radix-ui/react-dialog";
import * as React from "react";
import { cn } from "../utils/cn";

export const Modal = Dialog.Root;
export const ModalTrigger = Dialog.Trigger;
export const ModalClose = Dialog.Close;

export function ModalContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof Dialog.Content>) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm" />
      <Dialog.Content
        className={cn(
          "glass-panel fixed left-1/2 top-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] p-6",
          className
        )}
        {...props}
      />
    </Dialog.Portal>
  );
}

export const ModalTitle = Dialog.Title;
export const ModalDescription = Dialog.Description;

