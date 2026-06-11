"use client";

import { X } from "lucide-react";

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ["↑", "↓"], label: "Navegar entre conversas" },
  { keys: ["/"], label: "Focar a busca" },
  { keys: ["Ctrl", "K"], label: "Respostas rápidas" },
  { keys: ["Esc"], label: "Fechar painel / voltar" },
  { keys: ["Enter"], label: "Enviar mensagem" },
  { keys: ["Shift", "Enter"], label: "Quebrar linha" },
  { keys: ["?"], label: "Mostrar atalhos" }
];

export function ShortcutsHelpOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="atlas-v5-modal-backdrop" onClick={onClose}>
      <div
        className="atlas-v5-modal-panel max-w-sm animate-atlas-pop-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Atalhos de teclado"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-semibold">Atalhos de teclado</p>
            <p className="text-xs text-slate-500">Opere o inbox sem tirar as mãos do teclado</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
            aria-label="Fechar"
          >
            <X size={14} />
          </button>
        </div>
        <div className="mt-4 space-y-1.5">
          {SHORTCUTS.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[13px]">
              <span className="text-slate-600 dark:text-slate-300">{item.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {item.keys.map((key) => (
                  <kbd
                    key={key}
                    className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] font-medium text-slate-600 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
