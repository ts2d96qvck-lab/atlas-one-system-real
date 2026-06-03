"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { getAtlasAiStatus } from "../lib/atlas-ai";

type Props = { token: string };

export function AdminAiStatus({ token }: Props) {
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    void getAtlasAiStatus(token)
      .then((s) => setReady(!!s.configured))
      .catch(() => setReady(false));
  }, [token]);

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-violet-200/60 bg-violet-50/50 px-2.5 py-1.5 text-[11px] text-slate-600">
      <Sparkles size={14} className="text-violet-600" />
      <span>
        Atlas AI:{" "}
        <strong className={ready ? "text-emerald-700" : ready === false ? "text-amber-700" : "text-slate-500"}>
          {ready === null ? "verificando…" : ready ? "pronto para a equipe" : "aguardando configuração no servidor"}
        </strong>
      </span>
    </div>
  );
}
