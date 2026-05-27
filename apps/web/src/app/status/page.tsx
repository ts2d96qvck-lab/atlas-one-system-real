"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "../../lib/config";

type StatusLevel = "operational" | "degraded" | "partial_outage" | "major_outage" | "maintenance";

type StatusPayload = {
  ok: boolean;
  overall: StatusLevel;
  updatedAt: string;
  components: Array<{ id: string; name: string; status: StatusLevel; description?: string }>;
  incidents: Array<{ id: string; title: string; status: string; impact: StatusLevel; startedAt: string }>;
};

const LABEL: Record<StatusLevel, string> = {
  operational: "Operacional",
  degraded: "Desempenho reduzido",
  partial_outage: "Interrupcao parcial",
  major_outage: "Interrupcao major",
  maintenance: "Manutencao programada"
};

const COLOR: Record<StatusLevel, string> = {
  operational: "bg-emerald-500",
  degraded: "bg-amber-500",
  partial_outage: "bg-orange-500",
  major_outage: "bg-rose-500",
  maintenance: "bg-blue-500"
};

export default function StatusPage() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`${apiUrl()}/api/status`, { cache: "no-store" });
        if (!response.ok) throw new Error("Falha ao carregar status");
        const body = (await response.json()) as StatusPayload;
        if (!cancelled) {
          setData(body);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro de status");
          setData(null);
        }
      }
    };
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const overall = data?.overall ?? "major_outage";

  return (
    <main className="min-h-dvh bg-gradient-to-br from-slate-50 via-blue-50/30 to-violet-50/20 px-4 py-10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Atlas One</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Status da plataforma</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Transparencia operacional para clientes e equipes de TI.
          </p>
        </header>

        <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-xl shadow-blue-500/10 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${COLOR[overall]}`} />
            <p className="text-lg font-semibold">{LABEL[overall]}</p>
          </div>
          {data ? (
            <p className="mt-2 text-xs text-slate-500">
              Atualizado em {new Date(data.updatedAt).toLocaleString("pt-BR")}
            </p>
          ) : null}
          {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        </section>

        <section className="mt-6 space-y-3">
          {(data?.components ?? []).map((component) => (
            <div
              key={component.id}
              className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{component.name}</p>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {LABEL[component.status]}
                </span>
              </div>
              {component.description ? (
                <p className="mt-1 text-xs text-slate-500">{component.description}</p>
              ) : null}
            </div>
          ))}
        </section>

        {data?.incidents.length ? (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Incidentes abertos</h2>
            <div className="space-y-3">
              {data.incidents.map((incident) => (
                <div key={incident.id} className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <p className="font-semibold">{incident.title}</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {incident.status} · desde {new Date(incident.startedAt).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <p className="mt-10 text-center text-xs text-slate-500">
          Monitoramento: <code>/api/health</code> · <code>/api/ready</code> · <code>/api/status</code>
        </p>
      </div>
    </main>
  );
}
