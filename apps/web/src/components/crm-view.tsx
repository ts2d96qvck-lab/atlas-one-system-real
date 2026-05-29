"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { Badge, Button, Card } from "@atlas-one/ui";
import { apiUrl } from "../lib/config";
import { createLead, deleteLead, listUsers, updateLead, type Lead, type UserRow } from "../lib/api";

type Props = { token: string };

type PipelineData = {
  pipeline: { stages: { id: string; name: string; order: number }[] } | null;
  leads: Lead[];
};

function formatPhoneBr(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCurrencyBrFromNumber(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCurrencyBrInput(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const numeric = Number(digits) / 100;
  return formatCurrencyBrFromNumber(numeric);
}

function parseCurrencyBrInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits) / 100;
}

function agentInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function AgentAssigneeSelect({
  value,
  agents,
  onChange
}: {
  value: string;
  agents: UserRow[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm outline-none sm:col-span-2"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Sem responsavel</option>
      {agents.map((agent) => (
        <option key={agent.id} value={agent.id}>
          {agent.name}
        </option>
      ))}
    </select>
  );
}

export function CrmView({ token }: Props) {
  const [data, setData] = useState<PipelineData | null>(null);
  const [agents, setAgents] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [savingLead, setSavingLead] = useState(false);
  const [editForm, setEditForm] = useState({
    company: "",
    contact: "",
    phone: "",
    email: "",
    status: "",
    value: "",
    expectedCloseDate: "",
    assignedToId: ""
  });
  const [creatingLead, setCreatingLead] = useState(false);
  const [createForm, setCreateForm] = useState({
    company: "",
    contact: "",
    phone: "",
    email: "",
    status: "Novos leads",
    value: "",
    assignedToId: ""
  });
  const [savingCreate, setSavingCreate] = useState(false);

  async function load() {
    const [pipelineRes, usersRes] = await Promise.all([
      fetch(`${apiUrl()}/crm/pipeline`, {
        headers: { authorization: `Bearer ${token}` }
      }),
      listUsers(token).catch(() => [] as UserRow[])
    ]);
    if (pipelineRes.ok) setData(await pipelineRes.json());
    setAgents(usersRes);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [token]);

  async function moveLead(leadId: string, status: string) {
    await fetch(`${apiUrl()}/crm/leads/${leadId}`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ status })
    });
    await load();
  }

  async function removeLead(lead: Lead) {
    const ok = window.confirm(`Excluir lead ${lead.company}? Essa acao nao pode ser desfeita.`);
    if (!ok) return;
    setDeletingLeadId(lead.id);
    try {
      await deleteLead(token, lead.id);
      setFeedback({ type: "success", text: `Lead ${lead.company} excluido com sucesso.` });
      await load();
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Falha ao excluir lead" });
    } finally {
      setDeletingLeadId(null);
    }
  }

  function toDatetimeLocal(value?: string | null) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    const tzOffset = parsed.getTimezoneOffset() * 60000;
    return new Date(parsed.getTime() - tzOffset).toISOString().slice(0, 16);
  }

  function openEditor(lead: Lead) {
    setEditingLead(lead);
    setEditForm({
      company: lead.company ?? "",
      contact: lead.contact ?? "",
      phone: formatPhoneBr(lead.phone ?? ""),
      email: lead.email ?? "",
      status: lead.status ?? "",
      value: formatCurrencyBrFromNumber(Number(lead.value ?? 0)),
      expectedCloseDate: toDatetimeLocal(lead.expectedCloseDate),
      assignedToId: lead.assignedToId ?? lead.assignedTo?.id ?? ""
    });
  }

  async function saveLeadEdit() {
    if (!editingLead) return;
    if (!editForm.company.trim() || !editForm.contact.trim() || !editForm.phone.trim() || !editForm.status.trim()) {
      setFeedback({ type: "error", text: "Preencha os campos obrigatorios do lead." });
      return;
    }
    setSavingLead(true);
    try {
      await updateLead(token, editingLead.id, {
        company: editForm.company.trim(),
        contact: editForm.contact.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim() || undefined,
        status: editForm.status.trim(),
        value: parseCurrencyBrInput(editForm.value),
        expectedCloseDate: editForm.expectedCloseDate ? new Date(editForm.expectedCloseDate).toISOString() : "",
        assignedToId: editForm.assignedToId || null
      });
      setEditingLead(null);
      setFeedback({ type: "success", text: "Lead atualizado com sucesso." });
      await load();
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Falha ao atualizar lead" });
    } finally {
      setSavingLead(false);
    }
  }

  async function saveNewLead() {
    if (!createForm.company.trim() || !createForm.contact.trim() || !createForm.phone.trim()) {
      setFeedback({ type: "error", text: "Preencha empresa, contato e telefone." });
      return;
    }
    setSavingCreate(true);
    try {
      await createLead(token, {
        company: createForm.company.trim(),
        contact: createForm.contact.trim(),
        phone: createForm.phone.trim(),
        email: createForm.email.trim() || undefined,
        status: createForm.status,
        value: parseCurrencyBrInput(createForm.value),
        assignedToId: createForm.assignedToId || null
      });
      setCreatingLead(false);
      setCreateForm({
        company: "",
        contact: "",
        phone: "",
        email: "",
        status: "Novos leads",
        value: "",
        assignedToId: ""
      });
      setFeedback({ type: "success", text: "Lead criado com sucesso." });
      await load();
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Falha ao criar lead" });
    } finally {
      setSavingCreate(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center py-16">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const stages = data?.pipeline?.stages ?? [];
  const leads = data?.leads ?? [];

  const total = leads.reduce((s, l) => s + Number(l.value), 0);
  const averageTicket = leads.length ? total / leads.length : 0;
  const leadsWithPhone = leads.filter((lead) => (lead.phone ?? "").trim().length > 0).length;

  function formatMoney(value: number) {
    return `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
  }

  function formatDate(value?: string | null) {
    if (!value) return "Sem data";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Data invalida";
    return parsed.toLocaleDateString("pt-BR");
  }

  return (
    <main className="w-full overflow-x-hidden p-4 pb-28 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">CRM · Funil</h1>
            <p className="text-sm text-atlas-muted">Arraste cards entre colunas</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setCreatingLead(true)}>
              <Plus size={16} className="mr-2" />
              Novo lead
            </Button>
            <Card className="px-5 py-3">
              <p className="text-xs text-atlas-muted">Pipeline total</p>
              <p className="text-xl font-semibold">{formatMoney(total)}</p>
            </Card>
          </div>
        </header>

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs text-atlas-muted">Leads no funil</p>
            <p className="mt-1 text-2xl font-semibold">{leads.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-atlas-muted">Ticket medio</p>
            <p className="mt-1 text-2xl font-semibold">{formatMoney(averageTicket)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-atlas-muted">Leads com telefone</p>
            <p className="mt-1 text-2xl font-semibold">{leadsWithPhone}</p>
          </Card>
        </div>

        {feedback ? (
          <p className={`mb-3 text-sm ${feedback.type === "error" ? "text-red-600" : "text-emerald-700"}`}>{feedback.text}</p>
        ) : null}

        <div className="flex gap-4 overflow-x-auto pb-8">
          {stages.map((stage) => {
            const column = leads.filter((l) => l.status === stage.name);
            const columnValue = column.reduce((s, l) => s + Number(l.value), 0);
            return (
              <Card
                key={stage.id}
                className="min-w-[280px] flex-shrink-0 p-4"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId) moveLead(dragId, stage.name);
                  setDragId(null);
                }}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{stage.name}</p>
                  <Badge>{column.length}</Badge>
                </div>
                <p className="mt-1 text-xs text-atlas-muted">{formatMoney(columnValue)}</p>
                <div className="mt-4 space-y-3">
                  {column.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => setDragId(lead.id)}
                      onDoubleClick={() => openEditor(lead)}
                      className="cursor-grab rounded-2xl bg-white/85 p-4 shadow-sm active:cursor-grabbing"
                    >
                      <p className="font-medium">{lead.company}</p>
                      <p className="text-xs text-atlas-muted">{lead.contact || "Sem contato definido"}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700">
                          {lead.assignedTo?.name ? agentInitials(lead.assignedTo.name) : "—"}
                        </span>
                        <p className="text-[11px] text-atlas-muted">
                          {lead.assignedTo?.name ?? "Sem responsavel"}
                        </p>
                      </div>
                      <p className="text-[11px] text-atlas-muted">{lead.phone ? `Telefone: ${lead.phone}` : "Telefone nao informado"}</p>
                      <p className="text-[11px] text-atlas-muted">
                        Fechamento previsto: {lead.expectedCloseDate ? formatDate(lead.expectedCloseDate) : "Sem previsao"}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-atlas-blue">
                        {formatMoney(Number(lead.value))}
                      </p>
                      <p className="mt-1 text-[11px] text-atlas-muted">Atualizado em {formatDate(lead.updatedAt)}</p>
                      <p className="mt-1 text-[10px] text-atlas-muted">Duplo clique para editar</p>
                      <div className="mt-3 flex gap-2">
                        <Button
                          variant="glass"
                          className="w-full text-xs"
                          onClick={() => {
                            const idx = stages.findIndex((s) => s.id === stage.id);
                            const next = stages[idx + 1];
                            if (next) moveLead(lead.id, next.name);
                          }}
                        >
                          Avancar etapa
                        </Button>
                        <Button
                          variant="glass"
                          className="h-9 px-3"
                          disabled={deletingLeadId === lead.id}
                          onClick={() => void removeLead(lead)}
                          aria-label={`Excluir lead ${lead.company}`}
                        >
                          {deletingLeadId === lead.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
      {editingLead ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/25 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/70 bg-white/95 p-4 shadow-xl backdrop-blur">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-semibold">Editar lead</p>
                <p className="text-xs text-atlas-muted">Atualize os dados comerciais no mesmo padrao do sistema.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingLead(null)}
                className="rounded-full border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
              >
                <X size={14} />
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm outline-none"
                placeholder="Empresa"
                value={editForm.company}
                onChange={(e) => setEditForm((s) => ({ ...s, company: e.target.value }))}
              />
              <input
                className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm outline-none"
                placeholder="Contato"
                value={editForm.contact}
                onChange={(e) => setEditForm((s) => ({ ...s, contact: e.target.value }))}
              />
              <input
                className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm outline-none"
                placeholder="Telefone"
                value={editForm.phone}
                onChange={(e) => setEditForm((s) => ({ ...s, phone: formatPhoneBr(e.target.value) }))}
              />
              <input
                className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm outline-none"
                placeholder="Email (opcional)"
                value={editForm.email}
                onChange={(e) => setEditForm((s) => ({ ...s, email: e.target.value }))}
              />
              <select
                className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm outline-none"
                value={editForm.status}
                onChange={(e) => setEditForm((s) => ({ ...s, status: e.target.value }))}
              >
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.name}>
                    {stage.name}
                  </option>
                ))}
              </select>
              <input
                className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm outline-none"
                placeholder="Valor (R$)"
                type="text"
                inputMode="decimal"
                value={editForm.value}
                onChange={(e) => setEditForm((s) => ({ ...s, value: formatCurrencyBrInput(e.target.value) }))}
              />
              <input
                className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm outline-none sm:col-span-2"
                type="datetime-local"
                value={editForm.expectedCloseDate}
                onChange={(e) => setEditForm((s) => ({ ...s, expectedCloseDate: e.target.value }))}
              />
              <AgentAssigneeSelect
                value={editForm.assignedToId}
                agents={agents}
                onChange={(assignedToId) => setEditForm((s) => ({ ...s, assignedToId }))}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="glass" className="h-8 px-3 text-xs" onClick={() => setEditingLead(null)} disabled={savingLead}>
                Cancelar
              </Button>
              <Button className="h-8 px-3 text-xs" onClick={() => void saveLeadEdit()} disabled={savingLead}>
                {savingLead ? <Loader2 size={14} className="animate-spin" /> : null}
                Salvar alteracoes
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {creatingLead ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/25 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/70 bg-white/95 p-4 shadow-xl backdrop-blur">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-semibold">Novo lead</p>
                <p className="text-xs text-atlas-muted">Cadastre manualmente no funil comercial.</p>
              </div>
              <button
                type="button"
                onClick={() => setCreatingLead(false)}
                className="rounded-full border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
              >
                <X size={14} />
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input className="atlas-field rounded-xl px-3 py-2 text-sm outline-none" placeholder="Empresa" value={createForm.company} onChange={(e) => setCreateForm((s) => ({ ...s, company: e.target.value }))} />
              <input className="atlas-field rounded-xl px-3 py-2 text-sm outline-none" placeholder="Contato" value={createForm.contact} onChange={(e) => setCreateForm((s) => ({ ...s, contact: e.target.value }))} />
              <input className="atlas-field rounded-xl px-3 py-2 text-sm outline-none" placeholder="Telefone" value={createForm.phone} onChange={(e) => setCreateForm((s) => ({ ...s, phone: formatPhoneBr(e.target.value) }))} />
              <input className="atlas-field rounded-xl px-3 py-2 text-sm outline-none" placeholder="Email (opcional)" value={createForm.email} onChange={(e) => setCreateForm((s) => ({ ...s, email: e.target.value }))} />
              <select className="atlas-field rounded-xl px-3 py-2 text-sm outline-none" value={createForm.status} onChange={(e) => setCreateForm((s) => ({ ...s, status: e.target.value }))}>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.name}>{stage.name}</option>
                ))}
              </select>
              <input className="atlas-field rounded-xl px-3 py-2 text-sm outline-none" placeholder="Valor (R$)" value={createForm.value} onChange={(e) => setCreateForm((s) => ({ ...s, value: formatCurrencyBrInput(e.target.value) }))} />
              <AgentAssigneeSelect
                value={createForm.assignedToId}
                agents={agents}
                onChange={(assignedToId) => setCreateForm((s) => ({ ...s, assignedToId }))}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="glass" className="h-8 px-3 text-xs" onClick={() => setCreatingLead(false)} disabled={savingCreate}>Cancelar</Button>
              <Button className="h-8 px-3 text-xs" onClick={() => void saveNewLead()} disabled={savingCreate}>
                {savingCreate ? <Loader2 size={14} className="animate-spin" /> : null}
                Criar lead
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
