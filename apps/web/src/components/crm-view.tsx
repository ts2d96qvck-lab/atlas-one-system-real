"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { Loader2, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { Badge, Button, Card, Skeleton } from "@atlas-one/ui";
import { apiUrl } from "../lib/config";
import {
  createLead,
  deleteLead,
  deleteLeadAttachment,
  listLeadAttachments,
  listUsers,
  updateLead,
  uploadLeadAttachment,
  type Lead,
  type LeadAttachment,
  type SessionUser,
  type UserRow
} from "../lib/api";
import { crmStageLabel, EMPTY_COPY } from "../lib/product-copy";
import { EmptyState } from "./empty-state";
import { AtlasViewHeader } from "./atlas-view-header";
import { LeadAttachmentsPanel } from "./lead-attachments-panel";
import { AtlasAiCrmPanel } from "./atlas-ai/atlas-ai-crm-panel";
import { hasPermission } from "../lib/session-user";
import { useAppDialogs } from "./ui/dialog-provider";
import { notify } from "../lib/notify";

type Props = { token: string; user: SessionUser };

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

function DroppableStage({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-0 flex-1 flex-col rounded-xl transition-shadow ${
        isOver ? "bg-blue-50/50 ring-2 ring-blue-300/60" : ""
      }`}
    >
      {children}
    </div>
  );
}

function DraggableLead({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`${className ?? ""} ${isDragging ? "relative z-20 opacity-80 shadow-xl" : ""}`}
      style={{
        touchAction: "manipulation",
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined
      }}
    >
      {children}
    </div>
  );
}

function CrmBoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden pb-10 pt-1">
      {Array.from({ length: 4 }).map((_, column) => (
        <Card key={column} className="atlas-v5-card-pad-sm min-h-[420px] min-w-[272px] flex-shrink-0">
          <Skeleton className="mb-2 h-4 w-28" />
          <Skeleton className="mb-4 h-3 w-16" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, row) => (
              <Skeleton key={row} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
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
      className="atlas-field w-full px-3 py-2 text-sm outline-none sm:col-span-2"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Sem responsável</option>
      {agents.map((agent) => (
        <option key={agent.id} value={agent.id}>
          {agent.name}
        </option>
      ))}
    </select>
  );
}

export function CrmView({ token, user }: Props) {
  const { confirm } = useAppDialogs();
  const [data, setData] = useState<PipelineData | null>(null);
  const [agents, setAgents] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [leadAttachments, setLeadAttachments] = useState<LeadAttachment[]>([]);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
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

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  );

  async function moveLead(leadId: string, status: string) {
    // Optimistic move: the card lands instantly and reverts only on failure.
    const previous = data;
    setData((current) =>
      current
        ? { ...current, leads: current.leads.map((lead) => (lead.id === leadId ? { ...lead, status } : lead)) }
        : current
    );
    const res = await fetch(`${apiUrl()}/crm/leads/${leadId}`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ status })
    }).catch(() => null);
    if (!res || !res.ok) {
      setData(previous);
      notify.error("Não foi possível mover o lead. Tente novamente.");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const leadId = String(event.active.id);
    const stageName = event.over ? String(event.over.id) : null;
    if (!stageName) return;
    const lead = data?.leads.find((item) => item.id === leadId);
    if (!lead || lead.status === stageName) return;
    void moveLead(leadId, stageName);
  }

  async function removeLead(lead: Lead) {
    const ok = await confirm({
      title: `Excluir lead "${lead.company}"?`,
      description:
        "Esta ação não pode ser desfeita e remove o lead do CRM. O histórico de conversas é preservado.",
      confirmLabel: "Excluir lead",
      tone: "danger"
    });
    if (!ok) return;
    setDeletingLeadId(lead.id);
    try {
      await deleteLead(token, lead.id);
      notify.success(`Lead ${lead.company} excluído.`);
      await load();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Falha ao excluir lead");
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
    void listLeadAttachments(token, lead.id)
      .then(setLeadAttachments)
      .catch(() => setLeadAttachments([]));
  }

  async function saveLeadEdit() {
    if (!editingLead) return;
    if (!editForm.company.trim() || !editForm.contact.trim() || !editForm.phone.trim() || !editForm.status.trim()) {
      notify.error("Preencha os campos obrigatórios do lead.");
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
      notify.success("Lead atualizado com sucesso.");
      await load();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Falha ao atualizar lead");
    } finally {
      setSavingLead(false);
    }
  }

  async function saveNewLead() {
    if (!createForm.company.trim() || !createForm.contact.trim() || !createForm.phone.trim()) {
      notify.error("Preencha empresa, contato e telefone.");
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
      notify.success("Lead criado com sucesso.");
      await load();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Falha ao criar lead");
    } finally {
      setSavingCreate(false);
    }
  }

  if (loading) {
    return (
      <main className="atlas-page">
        <div className="atlas-page-inner w-full min-w-0">
          <div className="atlas-v5-module-shell atlas-v5-stack min-h-0">
            <AtlasViewHeader icon={Users} section="Comercial" title="CRM · Funil de vendas" />
            <CrmBoardSkeleton />
          </div>
        </div>
      </main>
    );
  }

  const stages = data?.pipeline?.stages ?? [];
  const leads = data?.leads ?? [];

  const total = leads.reduce((s, l) => s + Number(l.value), 0);

  function formatMoney(value: number) {
    return `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
  }

  function formatDate(value?: string | null) {
    if (!value) return "Sem data";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Data inválida";
    return parsed.toLocaleDateString("pt-BR");
  }

  return (
    <main className="atlas-page">
      <div className="atlas-page-inner w-full min-w-0">
        <div className="atlas-v5-module-shell atlas-v5-stack min-h-0">
        <AtlasViewHeader
          icon={Users}
          section="Comercial"
          title="CRM · Funil de vendas"
          actions={
            <>
              <Button onClick={() => setCreatingLead(true)}>
                <Plus size={16} />
                Novo lead
              </Button>
              <Card className="atlas-v5-card-pad-sm">
                <p className="text-xs text-slate-500">Pipeline total</p>
                <p className="text-xl font-semibold text-slate-900">{formatMoney(total)}</p>
              </Card>
            </>
          }
        />

        <DndContext sensors={dndSensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-10 pt-1">
            {stages.map((stage) => {
              const column = leads.filter((l) => l.status === stage.name);
              const columnValue = column.reduce((s, l) => s + Number(l.value), 0);
              return (
                <Card
                  key={stage.id}
                  className="atlas-v5-card-pad-sm flex min-h-[420px] min-w-[272px] flex-shrink-0 flex-col"
                >
                  <div className="mb-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{crmStageLabel(stage.name)}</p>
                      <Badge className="h-5 px-2 text-[10px]">{column.length}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{formatMoney(columnValue)}</p>
                  </div>
                  <DroppableStage id={stage.name}>
                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                      {!column.length ? (
                        <EmptyState
                          title={EMPTY_COPY.crmColumn.title}
                          description={EMPTY_COPY.crmColumn.description}
                          actionLabel={EMPTY_COPY.crmColumn.action}
                          onAction={() => setCreatingLead(true)}
                        />
                      ) : null}
                      {column.map((lead) => (
                        <DraggableLead key={lead.id} id={lead.id} className="atlas-v5-list-row cursor-grab active:cursor-grabbing">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-900">{lead.company}</p>
                              <p className="truncate text-xs text-slate-500">{lead.contact || "Sem contato definido"}</p>
                            </div>
                            <Button
                              variant="glass"
                              className="h-8 w-8 shrink-0 px-0"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() => openEditor(lead)}
                              title="Editar lead"
                              aria-label={`Editar lead ${lead.company}`}
                            >
                              <Pencil size={14} />
                            </Button>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-700">
                              {lead.assignedTo?.name ? agentInitials(lead.assignedTo.name) : "—"}
                            </span>
                            <p className="truncate text-[11px] text-slate-600">{lead.assignedTo?.name ?? "Sem responsável"}</p>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500">{lead.phone ? lead.phone : "Telefone não informado"}</p>
                          <p className="text-[11px] text-slate-500">
                            Fechamento previsto: {lead.expectedCloseDate ? formatDate(lead.expectedCloseDate) : "Sem previsão"}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-blue-700">{formatMoney(Number(lead.value))}</p>
                          {stages.findIndex((s) => s.id === stage.id) < stages.length - 1 ? (
                            <Button
                              variant="glass"
                              className="mt-3 h-8 w-full text-xs"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() => {
                                const idx = stages.findIndex((s) => s.id === stage.id);
                                const next = stages[idx + 1];
                                if (next) void moveLead(lead.id, next.name);
                              }}
                            >
                              Avançar etapa
                            </Button>
                          ) : null}
                        </DraggableLead>
                      ))}
                    </div>
                  </DroppableStage>
                </Card>
              );
            })}
          </div>
        </DndContext>
        </div>
      </div>
      {editingLead ? (
        <div className="atlas-v5-modal-backdrop">
          <div className="atlas-v5-modal-panel max-w-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-semibold text-slate-900">Editar lead</p>
                <p className="text-xs text-slate-500">Atualize os dados comerciais do lead.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingLead(null)}
                className="rounded-full border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
              >
                <X size={14} />
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-1">
                <span className="atlas-label mb-1.5">Empresa</span>
                <input className="atlas-field w-full px-3 py-2 text-sm outline-none" value={editForm.company} onChange={(e) => setEditForm((s) => ({ ...s, company: e.target.value }))} />
              </label>
              <label className="block sm:col-span-1">
                <span className="atlas-label mb-1.5">Contato</span>
                <input className="atlas-field w-full px-3 py-2 text-sm outline-none" value={editForm.contact} onChange={(e) => setEditForm((s) => ({ ...s, contact: e.target.value }))} />
              </label>
              <label className="block sm:col-span-1">
                <span className="atlas-label mb-1.5">Telefone</span>
                <input className="atlas-field w-full px-3 py-2 text-sm outline-none" value={editForm.phone} onChange={(e) => setEditForm((s) => ({ ...s, phone: formatPhoneBr(e.target.value) }))} />
              </label>
              <label className="block sm:col-span-1">
                <span className="atlas-label mb-1.5">E-mail (opcional)</span>
                <input className="atlas-field w-full px-3 py-2 text-sm outline-none" value={editForm.email} onChange={(e) => setEditForm((s) => ({ ...s, email: e.target.value }))} />
              </label>
              <label className="block sm:col-span-1">
                <span className="atlas-label mb-1.5">Etapa</span>
                <select className="atlas-field w-full px-3 py-2 text-sm outline-none" value={editForm.status} onChange={(e) => setEditForm((s) => ({ ...s, status: e.target.value }))}>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.name}>
                      {crmStageLabel(stage.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-1">
                <span className="atlas-label mb-1.5">Valor (R$)</span>
                <input className="atlas-field w-full px-3 py-2 text-sm outline-none" type="text" inputMode="decimal" value={editForm.value} onChange={(e) => setEditForm((s) => ({ ...s, value: formatCurrencyBrInput(e.target.value) }))} />
              </label>
              <label className="block sm:col-span-2">
                <span className="atlas-label mb-1.5">Previsão de fechamento</span>
                <input className="atlas-field w-full px-3 py-2 text-sm outline-none" type="datetime-local" value={editForm.expectedCloseDate} onChange={(e) => setEditForm((s) => ({ ...s, expectedCloseDate: e.target.value }))} />
              </label>
              <label className="block sm:col-span-2">
                <span className="atlas-label mb-1.5">Responsável</span>
                <AgentAssigneeSelect value={editForm.assignedToId} agents={agents} onChange={(assignedToId) => setEditForm((s) => ({ ...s, assignedToId }))} />
              </label>
              <div className="block sm:col-span-2">
                <span className="atlas-label mb-1.5">Anexos do lead</span>
                <LeadAttachmentsPanel
                  token={token}
                  attachments={leadAttachments}
                  uploading={attachmentUploading}
                  showTimeline
                  onUpload={(file) => {
                    if (!editingLead) return Promise.resolve();
                    setAttachmentUploading(true);
                    return uploadLeadAttachment(token, editingLead.id, file)
                      .then(() => openEditor(editingLead))
                      .catch((err) =>
                        notify.error(err instanceof Error ? err.message : "Falha ao anexar arquivo")
                      )
                      .finally(() => setAttachmentUploading(false));
                  }}
                  onRemove={(attachmentId) =>
                    deleteLeadAttachment(token, editingLead.id, attachmentId).then(() => openEditor(editingLead))
                  }
                />
              </div>
              {hasPermission(user, "ai:use") ? (
                <AtlasAiCrmPanel
                  token={token}
                  user={user}
                  leadId={editingLead.id}
                  onApplyTask={(task) =>
                    notify.success(
                      `Tarefa sugerida: ${task.titulo}${task.descricao ? ` — ${task.descricao}` : ""}`
                    )
                  }
                />
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="glass"
                className="h-9 px-3 text-xs text-rose-700 hover:bg-rose-50"
                disabled={savingLead || deletingLeadId === editingLead.id}
                onClick={() => void removeLead(editingLead).then(() => setEditingLead(null))}
              >
                {deletingLeadId === editingLead.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Excluir lead
              </Button>
              <div className="flex gap-2">
                <Button variant="glass" className="h-9 px-3 text-xs" onClick={() => setEditingLead(null)} disabled={savingLead}>
                  Cancelar
                </Button>
                <Button className="h-9 px-3 text-xs" onClick={() => void saveLeadEdit()} disabled={savingLead}>
                  {savingLead ? <Loader2 size={14} className="animate-spin" /> : null}
                  Salvar alterações
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {creatingLead ? (
        <div className="atlas-v5-modal-backdrop">
          <div className="atlas-v5-modal-panel max-w-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-semibold text-slate-900">Novo lead</p>
                <p className="text-xs text-slate-500">Cadastre manualmente no funil comercial.</p>
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
              <input className="atlas-field w-full px-3 py-2 text-sm outline-none" placeholder="Empresa" value={createForm.company} onChange={(e) => setCreateForm((s) => ({ ...s, company: e.target.value }))} />
              <input className="atlas-field w-full px-3 py-2 text-sm outline-none" placeholder="Contato" value={createForm.contact} onChange={(e) => setCreateForm((s) => ({ ...s, contact: e.target.value }))} />
              <input className="atlas-field w-full px-3 py-2 text-sm outline-none" placeholder="Telefone" value={createForm.phone} onChange={(e) => setCreateForm((s) => ({ ...s, phone: formatPhoneBr(e.target.value) }))} />
              <input className="atlas-field w-full px-3 py-2 text-sm outline-none" placeholder="E-mail (opcional)" value={createForm.email} onChange={(e) => setCreateForm((s) => ({ ...s, email: e.target.value }))} />
              <select className="atlas-field w-full px-3 py-2 text-sm outline-none" value={createForm.status} onChange={(e) => setCreateForm((s) => ({ ...s, status: e.target.value }))}>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.name}>{stage.name}</option>
                ))}
              </select>
              <input className="atlas-field w-full px-3 py-2 text-sm outline-none" placeholder="Valor (R$)" value={createForm.value} onChange={(e) => setCreateForm((s) => ({ ...s, value: formatCurrencyBrInput(e.target.value) }))} />
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
