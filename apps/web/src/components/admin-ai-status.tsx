"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { getAtlasAiStatus } from "../lib/atlas-ai";
import type { SessionUser } from "../lib/api";
import { hasPermission } from "../lib/session-user";

type Props = { token: string; user: SessionUser };

type AdminAiState = "loading" | "ready" | "unconfigured" | "denied" | "error";

export function AdminAiStatus({ token, user }: Props) {
  const [state, setState] = useState<AdminAiState>("loading");

  useEffect(() => {
    let cancelled = false;

    if (!hasPermission(user, "ai:use")) {
      setState("denied");
      return () => {
        cancelled = true;
      };
    }

    void getAtlasAiStatus(token)
      .then((status) => {
        if (cancelled) return;
        const configured = !!status.configured && status.ready !== false;
        if (!configured) {
          setState("unconfigured");
          return;
        }
        if (status.canUse === false) {
          setState("denied");
          return;
        }
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [token, user.id, user.role, user.permissions?.join("|")]);

  const label =
    state === "loading"
      ? "verificando…"
      : state === "ready"
        ? "pronto para a equipe"
        : state === "denied"
          ? "libere a permissão Atlas AI para usuários"
          : state === "error"
            ? "não foi possível verificar agora"
            : "aguardando chaves de IA no servidor";

  const tone =
    state === "ready"
      ? "text-emerald-700"
      : state === "denied"
        ? "text-violet-700"
        : state === "error"
          ? "text-slate-600"
          : state === "loading"
            ? "text-slate-500"
            : "text-amber-700";

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-violet-200/60 bg-violet-50/50 px-2.5 py-1.5 text-[11px] text-slate-600">
      <Sparkles size={14} className="text-violet-600" />
      <span>
        Atlas AI: <strong className={tone}>{label}</strong>
      </span>
    </div>
  );
}
