"use client";

import { ConfirmDialog, PromptDialog } from "@atlas-one/ui";
import * as React from "react";

interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

interface PromptOptions {
  title: string;
  description?: React.ReactNode;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  multiline?: boolean;
  confirmLabel?: string;
}

interface DialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

type ConfirmState = ConfirmOptions & { resolve: (ok: boolean) => void };
type PromptState = PromptOptions & { resolve: (value: string | null) => void };

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [confirmState, setConfirmState] = React.useState<ConfirmState | null>(null);
  const [promptState, setPromptState] = React.useState<PromptState | null>(null);

  const confirm = React.useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ ...options, resolve });
      }),
    []
  );

  const prompt = React.useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setPromptState({ ...options, resolve });
      }),
    []
  );

  const value = React.useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      {confirmState ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              confirmState.resolve(false);
              setConfirmState(null);
            }
          }}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          tone={confirmState.tone}
          onConfirm={() => {
            confirmState.resolve(true);
            setConfirmState(null);
          }}
        />
      ) : null}
      {promptState ? (
        <PromptDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              promptState.resolve(null);
              setPromptState(null);
            }
          }}
          title={promptState.title}
          description={promptState.description}
          label={promptState.label}
          placeholder={promptState.placeholder}
          defaultValue={promptState.defaultValue}
          multiline={promptState.multiline}
          confirmLabel={promptState.confirmLabel}
          onSubmit={(value) => {
            promptState.resolve(value);
            setPromptState(null);
          }}
        />
      ) : null}
    </DialogContext.Provider>
  );
}

export function useAppDialogs(): DialogContextValue {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error("useAppDialogs must be used within DialogProvider");
  return ctx;
}
