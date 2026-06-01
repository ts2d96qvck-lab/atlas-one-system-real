"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { apiUrl } from "../lib/config";

type Props = {
  path: string | null | undefined;
  token: string;
  type: "image" | "audio" | "video" | "document";
  alt?: string;
  fileName?: string;
};

function resolveUrl(path: string) {
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  const base = apiUrl().replace(/\/$/, "");
  const segments = path.split("/");
  const encoded = segments
    .map((segment, index) => {
      if (index < 2 || !segment) return segment;
      return encodeURIComponent(decodeURIComponent(segment));
    })
    .join("/");
  return `${base}${encoded}`;
}

function inferMime(path: string, type: Props["type"], headerType: string | null) {
  if (headerType && headerType !== "application/octet-stream") return headerType.split(";")[0]?.trim() ?? headerType;
  const lower = path.toLowerCase();
  if (type === "audio" || lower.includes(".ogg") || lower.includes("opus")) return "audio/ogg";
  if (lower.includes(".mp3")) return "audio/mpeg";
  if (lower.includes(".m4a")) return "audio/mp4";
  if (lower.includes(".webm")) return type === "video" ? "video/webm" : "audio/webm";
  if (type === "video" || lower.includes(".mp4")) return "video/mp4";
  if (type === "image") return "image/jpeg";
  return headerType ?? "application/octet-stream";
}

export function SecureMedia({ path, token, type, alt, fileName }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const directAudioSrc = useMemo(() => {
    if (!path || type !== "audio") return null;
    const url = resolveUrl(path);
    const joiner = url.includes("?") ? "&" : "?";
    return `${url}${joiner}token=${encodeURIComponent(token)}`;
  }, [path, token, type]);

  useEffect(() => {
    if (!path) {
      setSrc(null);
      return;
    }
    if (type === "audio" && directAudioSrc) {
      setSrc(directAudioSrc);
      setError(false);
      return;
    }
    const url = resolveUrl(path);
    if (url.startsWith("data:")) {
      setSrc(url);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const response = await fetch(url, {
          headers: { authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("media_fetch_failed");
        const headerType = response.headers.get("content-type");
        const mime = inferMime(path, type, headerType);
        const buffer = await response.arrayBuffer();
        const blob = new Blob([buffer], { type: mime });
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setSrc(objectUrl);
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, token, type, directAudioSrc]);

  if (!path) return null;
  if (error) return <p className="text-xs text-rose-600">Mídia indisponível</p>;
  if (!src) return <Loader2 size={16} className="animate-spin text-atlas-muted" />;

  if (type === "image") {
    return (
      <a href={src} target="_blank" rel="noreferrer" className="block">
        <img src={src} alt={alt ?? "Imagem"} className="max-h-56 rounded-xl object-cover" />
      </a>
    );
  }

  if (type === "audio") {
    return (
      <audio controls preload="metadata" src={src} className="w-full min-w-[220px] max-w-sm">
        Seu navegador não suporta reproducao de audio.
      </audio>
    );
  }

  if (type === "video") {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white/70">
        <video controls src={src} className="max-h-56 w-full rounded-lg" />
      </div>
    );
  }

  const label = fileName ?? "Documento";
  const extension = label.includes(".") ? label.split(".").pop()?.toUpperCase() : "DOC";

  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      download={fileName}
      className="flex min-w-[200px] max-w-sm items-center gap-3 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2.5 text-xs text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-white"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
        <FileText size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{label}</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">{extension ?? "Arquivo"} · Toque para abrir</span>
      </span>
    </a>
  );
}
