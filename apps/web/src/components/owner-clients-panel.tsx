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
  Settings2,
  Users
} from "lucide-react";
import { Badge, Button, Card } from "@atlas-one/ui";
import type { TenantControlsPayload, TenantSummary } from "../lib/api";

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
  savingControlsId: string | null;
  onBillingChange: (tenantId: string, status: "active" | "blocked") => void | Promise<void>;
  onSaveControls: (tenantId: string, payload: TenantControlsPayload) => void | Promise<void>;
};

type Filter = "all" | "active" | "overdue" | "blocked";

type DraftControls = {
  plan: "starter" | "pro" | "enterprise";
  maxUsers: string;
  maxInstances: string;
  trialEndsAt: string;
};

function billingLabel(tenant: TenantSummary) {
  if (tenant.billingStatus === "blocked" || tenant.blockedAt) {
    return { text: "Bloqueado", tone: "bg-rose-100 text-rose-800" };
  }
  if (tenant.trialExpired) {
    return { text: "Trial expirado", tone: "bg-orange-100 text-orange-900" };
  }
  if (tenant.billingStatus === "overdue") {
    return { text: "Atrasado", tone: "bg-amber-100 text-amber-900" };
  }
  if (tenant.trialActive) {
    return { text: "Trial ativo", tone: "bg-sky-100 text-sky-800" };
  }
  return { text: "Ativo", tone: "bg-emerald-100 text-emerald-800" };
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("pt-BR");
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function draftFromTenant(tenant: TenantSummary): DraftControls {
  return {
    plan: (tenant.plan === "pro" || tenant.plan === "enterprise" ? tenant.plan : "starter") as DraftControls["plan"],
    maxUsers: String(tenant.maxUsers ?? 5),
    maxInstances: String(tenant.maxInstances ?? 1),
    trialEndsAt: toDateInputValue(tenant.trialEndsAt)
  };
}

export function OwnerClientsPanel({
  tenants,
  summary,
  busyId,
  savingControlsId,
  onBillingChange,
  onSaveControls
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftControls>>({});

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tenants.filter((tenant) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && tenant.billingStatus === "active" && !tenant.blockedAt && !tenant.trialExpired) ||
        (filter === "overdue" && tenant.billingStatus === "overdue" && !tenant.blockedAt) ||
        (filter === "blocked" &&
          (tenant.billingStatus === "blocked" || Boolean(tenant.blockedAt) || Boolean(tenant.trialExpired)));
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
    const header = [
      "Empresa",
      "Slug",
      "Plano",
      "Status",
      "Trial ate",
      "Dias trial",
      "Max usuarios",
      "Max numeros",
      "Usuarios",
      "Numeros"
    ];
    const rows = filtered.map((tenant) => [
      tenant.name,
      tenant.slug,
      tenant.plan,
      tenant.billingStatus,
      tenant.trialEndsAt ?? "",
      tenant.trialDaysRemaining != null ? String(tenant.trialDaysRemaining) : "",
      String(tenant.maxUsers ?? ""),
      String(tenant.maxInstances ?? ""),
      String(tenant._count.users),
      String(tenant._count.instances)
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

  function openEditor(tenant: TenantSummary) {
    setExpandedId((current) => (current === tenant.id ? null : tenant.id));
    setDrafts((current) => ({
      ...current,
      [tenant.id]: current[tenant.id] ?? draftFromTenant(tenant)
    }));
  }

  function updateDraft(tenantId: string, patch: Partial<DraftControls>) {
    setDrafts((current) => ({
      ...current,
      [tenantId]: { ...(current[tenantId] ?? draftFromTenant(tenants.find((row) => row.id === tenantId)!)), ...patch }
    }));
  }

  async function saveControls(tenant: TenantSummary) {
    const draft = drafts[tenant.id] ?? draftFromTenant(tenant);
    const maxUsers = Number(draft.maxUsers);
    const maxInstances = Number(draft.maxInstances);
    if (!Number.isFinite(maxUsers) || maxUsers < 1 || !Number.isFinite(maxInstances) || maxInstances < 1) return;

    const trialEndsAt = draft.trialEndsAt
      ? new Date(`${draft.trialEndsAt}T23:59:59`).toISOString()
      : null;

    await onSaveControls(tenant.id, {
      plan: draft.plan,
      maxUsers,
      maxInstances,
      trialEndsAt
    });
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
            <p className="text-xs uppercase tracking-[0.18em] text-blue-200">Plataforma · Beta</p>
            <h2 className="mt-1 text-xl font-semibold">Controle de clientes</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Limites, trial e bloqueio manual para empresas em teste. Acesso restrito ao administrador da plataforma.
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

        <div className="space-y-3">
          {filtered.map((tenant) => {
            const busy = busyId === tenant.id;
            const saving = savingControlsId === tenant.id;
            const expanded = expandedId === tenant.id;
            const draft = drafts[tenant.id] ?? draftFromTenant(tenant);
            const status = billingLabel(tenant);
            const isBlocked = tenant.billingStatus === "blocked" || Boolean(tenant.blockedAt);

            return (
              <div key={tenant.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
                      <Building2 size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{tenant.name}</p>
                      <p className="text-xs text-slate-500">{tenant.slug}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.tone}`}>
                          {status.text}
                        </span>
                        <Badge className="capitalize">{tenant.plan}</Badge>
                        {tenant.trialActive && tenant.trialDaysRemaining != null ? (
                          <span className="text-[11px] text-sky-700">{tenant.trialDaysRemaining} dias de trial</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600">
                    <p className="flex items-center gap-1">
                      <Users size={12} /> {tenant._count.users}/{tenant.maxUsers ?? "—"} usuarios
                    </p>
                    <p className="mt-1">
                      {tenant._count.instances}/{tenant.maxInstances ?? "—"} numeros · {tenant._count.conversations} conversas
                    </p>
                    <p className="mt-1 flex items-center gap-1">
                      <Clock3 size={12} /> Trial ate {formatDate(tenant.trialEndsAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Button variant="glass" className="h-8 px-2.5 text-[11px]" onClick={() => openEditor(tenant)}>
                      <Settings2 size={12} /> Gerenciar
                    </Button>
                    {isBlocked ? (
                      <Button
                        variant="glass"
                        className="h-8 px-2.5 text-[11px]"
                        disabled={busy}
                        onClick={() => void onBillingChange(tenant.id, "active")}
                      >
                        {busy ? <Loader2 className="animate-spin" size={12} /> : <CheckCircle2 size={12} />}
                        Desbloquear
                      </Button>
                    ) : (
                      <Button
                        variant="glass"
                        className="h-8 px-2.5 text-[11px] text-rose-700"
                        disabled={busy}
                        onClick={() => void onBillingChange(tenant.id, "blocked")}
                      >
                        {busy ? <Loader2 className="animate-spin" size={12} /> : <Ban size={12} />}
                        Bloquear
                      </Button>
                    )}
                  </div>
                </div>

                {expanded ? (
                  <div className="border-t border-slate-100 bg-slate-50/80 p-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="text-xs text-slate-600">
                        Plano
                        <select
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none"
                          value={draft.plan}
                          onChange={(e) =>
                            updateDraft(tenant.id, { plan: e.target.value as DraftControls["plan"] })
                          }
                        >
                          <option value="starter">Starter</option>
                          <option value="pro">Pro</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                      </label>
                      <label className="text-xs text-slate-600">
                        Trial ate
                        <input
                          type="date"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none"
                          value={draft.trialEndsAt}
                          onChange={(e) => updateDraft(tenant.id, { trialEndsAt: e.target.value })}
                        />
                      </label>
                      <label className="text-xs text-slate-600">
                        Max usuarios
                        <input
                          type="number"
                          min={1}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none"
                          value={draft.maxUsers}
                          onChange={(e) => updateDraft(tenant.id, { maxUsers: e.target.value })}
                        />
                      </label>
                      <label className="text-xs text-slate-600">
                        Max numeros WhatsApp
                        <input
                          type="number"
                          min={1}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none"
                          value={draft.maxInstances}
                          onChange={(e) => updateDraft(tenant.id, { maxInstances: e.target.value })}
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-500">
                        Status financeiro: <strong className="capitalize">{tenant.billingStatus}</strong>
                        {tenant.subscriptionStatus ? ` · Assinatura: ${tenant.subscriptionStatus}` : ""}
                      </p>
                      <Button className="h-8 px-3 text-xs" disabled={saving} onClick={() => void saveControls(tenant)}>
                        {saving ? <Loader2 className="animate-spin" size={14} /> : "Salvar"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {!filtered.length ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
            Nenhum cliente encontrado para os filtros atuais.
          </div>
        ) : null}
      </div>
    </Card>
  );
}
