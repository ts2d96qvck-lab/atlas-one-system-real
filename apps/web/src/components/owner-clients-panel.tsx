"use client";

import { useMemo, useState } from "react";
import {
  Ban,
  Building2,
  CheckCircle2,
  Clock3,
  Download,
  Loader2,
  Search,
  ShieldCheck,
  Users
} from "lucide-react";
import { Badge, Button, Card } from "@atlas-one/ui";
import type { TenantSummary } from "../lib/api";

type OwnerSummary = {
  tenants: number;
  active: number;
  overdue: number;
  blocked: number;
  users: number;
  numbers: number;
};

type Props = {
  tenants: TenantSummary[];
  summary: OwnerSummary;
  busyId: string | null;
  onBillingChange: (tenantId: string, status: "active" | "overdue" | "blocked") => void | Promise<void>;
};

type Filter = "all" | "active" | "overdue" | "blocked";

function billingLabel(status: TenantSummary["billingStatus"]) {
  if (status === "blocked") return { text: "Bloqueado", tone: "bg-rose-100 text-rose-800" };
  if (status === "overdue") return { text: "Atrasado", tone: "bg-amber-100 text-amber-900" };
  return { text: "Ativo", tone: "bg-emerald-100 text-emerald-800" };
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("pt-BR");
}

export function OwnerClientsPanel({ tenants, summary, busyId, onBillingChange }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tenants.filter((tenant) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && tenant.billingStatus === "active" && !tenant.blockedAt) ||
        (filter === "overdue" && tenant.billingStatus === "overdue" && !tenant.blockedAt) ||
        (filter === "blocked" && (tenant.billingStatus === "blocked" || Boolean(tenant.blockedAt)));
      if (!matchesFilter) return false;
      if (!normalized) return true;
      return (
        tenant.name.toLowerCase().includes(normalized) ||
        tenant.slug.toLowerCase().includes(normalized) ||
        tenant.plan.toLowerCase().includes(normalized)
      );
    });
  }, [tenants, query, filter]);

  function exportCsv() {
    const header = ["Empresa", "Slug", "Plano", "Status", "Vencimento", "Usuarios", "Numeros", "Conversas", "Leads"];
    const rows = filtered.map((tenant) => [
      tenant.name,
      tenant.slug,
      tenant.plan,
      tenant.billingStatus,
      tenant.billingDueAt ?? "",
      String(tenant._count.users),
      String(tenant._count.instances),
      String(tenant._count.conversations),
      String(tenant._count.leads)
    ]);
    const csv = [header, ...rows]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `clientes-atlas-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "Todos", count: summary.tenants || tenants.length },
    { id: "active", label: "Ativos", count: summary.active },
    { id: "overdue", label: "Atrasados", count: summary.overdue },
    { id: "blocked", label: "Bloqueados", count: summary.blocked }
  ];

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-white/60 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-blue-200">SaaS · Gestao comercial</p>
            <h2 className="mt-1 text-xl font-semibold">Central de clientes</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Controle pagamentos, liberacao de acesso, numeros conectados e volume de conversas de cada empresa.
            </p>
          </div>
          <Button variant="glass" className="border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={exportCsv}>
            <Download size={16} /> Exportar CSV
          </Button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
            <p className="text-[11px] text-slate-300">Clientes</p>
            <p className="mt-1 text-2xl font-semibold">{summary.tenants || tenants.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
            <p className="text-[11px] text-slate-300">Ativos</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-300">{summary.active}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
            <p className="text-[11px] text-slate-300">Atrasados</p>
            <p className="mt-1 text-2xl font-semibold text-amber-300">{summary.overdue}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
            <p className="text-[11px] text-slate-300">Bloqueados</p>
            <p className="mt-1 text-2xl font-semibold text-rose-300">{summary.blocked}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
            <p className="text-[11px] text-slate-300">Usuarios / numeros</p>
            <p className="mt-1 text-lg font-semibold">
              {summary.users} · {summary.numbers}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                filter === item.id
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none ring-blue-500 focus:ring-2"
            placeholder="Buscar por empresa, slug ou plano..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">Plano</th>
                <th className="px-4 py-3 font-semibold">Financeiro</th>
                <th className="px-4 py-3 font-semibold">Uso</th>
                <th className="px-4 py-3 font-semibold">Vencimento</th>
                <th className="px-4 py-3 font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tenant) => {
                const busy = busyId === tenant.id;
                const status = billingLabel(tenant.billingStatus);
                return (
                  <tr key={tenant.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-xl bg-blue-50 p-2 text-blue-700">
                          <Building2 size={16} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{tenant.name}</p>
                          <p className="text-xs text-slate-500">{tenant.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 capitalize text-slate-700">{tenant.plan}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.tone}`}>{status.text}</span>
                      {tenant.blockedAt ? (
                        <p className="mt-1 text-[11px] text-rose-600">Bloqueado em {formatDate(tenant.blockedAt)}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600">
                      <p className="flex items-center gap-1">
                        <Users size={12} /> {tenant._count.users} usuarios
                      </p>
                      <p className="mt-1">{tenant._count.instances} numeros · {tenant._count.conversations} conversas</p>
                      <p className="mt-1">{tenant._count.leads} leads</p>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600">
                      <p className="flex items-center gap-1">
                        <Clock3 size={12} /> {formatDate(tenant.billingDueAt)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          variant="glass"
                          className="h-8 px-2.5 text-[11px]"
                          disabled={busy}
                          onClick={() => void onBillingChange(tenant.id, "active")}
                        >
                          {busy ? <Loader2 className="animate-spin" size={12} /> : <CheckCircle2 size={12} />}
                          Liberar
                        </Button>
                        <Button
                          variant="glass"
                          className="h-8 px-2.5 text-[11px]"
                          disabled={busy}
                          onClick={() => void onBillingChange(tenant.id, "overdue")}
                        >
                          <ShieldCheck size={12} /> Atraso
                        </Button>
                        <Button
                          variant="glass"
                          className="h-8 px-2.5 text-[11px] text-rose-700"
                          disabled={busy}
                          onClick={() => void onBillingChange(tenant.id, "blocked")}
                        >
                          <Ban size={12} /> Bloquear
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">Nenhum cliente encontrado para os filtros atuais.</div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
