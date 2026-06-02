"use client";

import { Download, ExternalLink, Loader2, Plus } from "lucide-react";
import { Badge, Button } from "@atlas-one/ui";
import type { LeadAttachment } from "../lib/api";
import {
  canOpenLeadAttachmentInline,
  downloadLeadAttachment,
  leadAttachmentCategoryLabel,
  leadAttachmentMediaUrl
} from "../lib/lead-attachments";

type Props = {
  token: string;
  attachments: LeadAttachment[];
  uploading?: boolean;
  compact?: boolean;
  showTimeline?: boolean;
  onUpload?: (file: File) => void | Promise<void>;
  onRemove?: (attachmentId: string) => void | Promise<void>;
};

export function LeadAttachmentsPanel({
  token,
  attachments,
  uploading = false,
  compact = false,
  showTimeline = false,
  onUpload,
  onRemove
}: Props) {
  const sorted = [...attachments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const timeline = showTimeline
    ? [...attachments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : [];

  function openAttachment(attachment: LeadAttachment) {
    const url = leadAttachmentMediaUrl(attachment.fileUrl, token);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className={compact ? "space-y-2" : "rounded-xl border border-slate-200 bg-slate-50/70 p-3"}>
      {sorted.length ? (
        <ul className="space-y-2">
          {sorted.map((item) => (
            <li key={item.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-800" title={item.fileName}>
                    {item.fileName}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {new Date(item.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <Badge className="h-5 shrink-0 px-2 text-[10px]">{leadAttachmentCategoryLabel(item.category)}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {canOpenLeadAttachmentInline(item.mimeType) ? (
                  <Button
                    type="button"
                    variant="glass"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => openAttachment(item)}
                  >
                    <ExternalLink size={12} />
                    Abrir
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="glass"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => openAttachment(item)}
                  >
                    <ExternalLink size={12} />
                    Visualizar
                  </Button>
                )}
                <Button
                  type="button"
                  variant="glass"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => void downloadLeadAttachment(token, item).catch(() => undefined)}
                >
                  <Download size={12} />
                  Baixar
                </Button>
                {onRemove ? (
                  <button
                    type="button"
                    className="text-[11px] text-rose-600 hover:underline"
                    onClick={() => void onRemove(item.id)}
                  >
                    Remover
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">Nenhum anexo ainda. Envie PDF, imagem, áudio ou proposta.</p>
      )}

      {showTimeline && timeline.length ? (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Linha do tempo</p>
          <ol className="mt-2 space-y-2">
            {timeline.map((item) => (
              <li key={`timeline-${item.id}`} className="flex gap-2 text-[11px] text-slate-600">
                <span className="shrink-0 text-slate-400">{new Date(item.createdAt).toLocaleDateString("pt-BR")}</span>
                <span className="min-w-0 truncate">
                  {leadAttachmentCategoryLabel(item.category)} — {item.fileName}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {onUpload ? (
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Adicionar arquivo
          <input
            type="file"
            className="hidden"
            accept=".pdf,image/*,audio/*,.doc,.docx"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void onUpload(file);
              e.target.value = "";
            }}
          />
        </label>
      ) : null}
    </div>
  );
}
