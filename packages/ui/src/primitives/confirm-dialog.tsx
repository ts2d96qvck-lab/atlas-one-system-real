"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as React from "react";
import { Button } from "./button";
import { cn } from "../utils/cn";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Use "danger" for destructive actions. */
  tone?: "default" | "danger";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  loading = false,
  onConfirm,
  children
}: ConfirmDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog.Root open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="atlas-overlay fixed inset-0 z-[80] bg-slate-950/35 backdrop-blur-[3px]" />
        <Dialog.Content
          className="atlas-dialog fixed left-1/2 top-1/2 z-[81] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-atlas-lg border border-slate-200/70 bg-white p-5 shadow-2xl outline-none dark:border-slate-700/70 dark:bg-slate-900"
          onEscapeKeyDown={(e) => loading && e.preventDefault()}
          onPointerDownOutside={(e) => loading && e.preventDefault()}
        >
          <Dialog.Title className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </Dialog.Title>
          {description ? (
            <Dialog.Description className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {description}
            </Dialog.Description>
          ) : null}
          {children}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="glass" size="sm" type="button" disabled={loading} onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
            <Button
              size="sm"
              type="button"
              disabled={loading}
              onClick={handleConfirm}
              className={cn(
                tone === "danger" &&
                  "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500/40 dark:bg-rose-600 dark:hover:bg-rose-500"
              )}
            >
              {loading ? "Aguarde…" : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  multiline?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onSubmit: (value: string) => void | Promise<void>;
}

/** Styled replacement for window.prompt. */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  defaultValue = "",
  multiline = false,
  confirmLabel = "Salvar",
  cancelLabel = "Cancelar",
  loading = false,
  onSubmit
}: PromptDialogProps) {
  const [value, setValue] = React.useState(defaultValue);

  React.useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  const fieldClass =
    "w-full rounded-atlas border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

  return (
    <Dialog.Root open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="atlas-overlay fixed inset-0 z-[80] bg-slate-950/35 backdrop-blur-[3px]" />
        <Dialog.Content className="atlas-dialog fixed left-1/2 top-1/2 z-[81] w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-atlas-lg border border-slate-200/70 bg-white p-5 shadow-2xl outline-none dark:border-slate-700/70 dark:bg-slate-900">
          <Dialog.Title className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </Dialog.Title>
          {description ? (
            <Dialog.Description className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {description}
            </Dialog.Description>
          ) : null}
          <form
            className="mt-4"
            onSubmit={async (e) => {
              e.preventDefault();
              await onSubmit(value);
            }}
          >
            {label ? (
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{label}</label>
            ) : null}
            {multiline ? (
              <textarea
                autoFocus
                rows={3}
                className={fieldClass}
                placeholder={placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            ) : (
              <input
                autoFocus
                type="text"
                className={fieldClass}
                placeholder={placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="glass" size="sm" type="button" disabled={loading} onClick={() => onOpenChange(false)}>
                {cancelLabel}
              </Button>
              <Button size="sm" type="submit" disabled={loading}>
                {loading ? "Aguarde…" : confirmLabel}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
