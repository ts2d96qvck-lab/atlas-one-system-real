"use client";

import { useEffect, useState } from "react";
import { Bot, Loader2, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card } from "@atlas-one/ui";
import { apiUrl } from "../lib/config";
import { AtlasViewHeader } from "./atlas-view-header";
import { EmptyState } from "./empty-state";
import { useAppDialogs } from "./ui/dialog-provider";
import { notify } from "../lib/notify";

const TRIGGER_LABEL: Record<string, string> = {
  "lead.stage.changed": "Lead mudou de etapa",
  "lead.created": "Lead criado",
  "lead.closed": "Lead fechado",
  "lead.lost": "Lead perdido",
  "conversation.created": "Conversa criada",
  "conversation.unassigned": "Conversa sem atendente"
};

const SEND_TYPE_LABEL: Record<string, string> = {
  text: "Enviar texto no WhatsApp",
  audit: "Somente auditoria (sem envio)"
};

function triggerLabel(key: string) {
  return TRIGGER_LABEL[key] ?? key;
}

type Props = { token: string };

type Automation = {
  id: string;
  name: string;
  trigger: string;
  enabled: boolean;
  config?: Record<string, unknown>;
};

export function AutomationsView({ token }: Props) {
  const { confirm } = useAppDialogs();
  const [items, setItems] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [form, setForm] = useState({
    name: "",
    trigger: "lead.stage.changed",
    whenStage: "Proposta enviada",
    message: "",
    sendType: "text",
    minLeadValue: "",
    onlyBusinessHours: false,
    scheduleAt: "",
    scheduleTime: "",
    audioUrl: ""
  });

  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  async function load() {
    const res = await fetch(`${apiUrl()}/automations`, { headers });
    if (res.ok) {
      setItems(await res.json());
      setError("");
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body?.error ?? "Falha ao carregar automações");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [token]);

  async function create() {
    if (!form.name.trim()) {
      setError("Informe um nome para a automação.");
      return;
    }
    const response = await fetch(`${apiUrl()}/automations`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: form.name,
        trigger: form.trigger,
        enabled: true,
        config: {
          whenStage: form.whenStage,
          sendType: form.sendType,
          message: form.message,
          minLeadValue: form.minLeadValue ? Number(form.minLeadValue) : null,
          onlyBusinessHours: form.onlyBusinessHours,
          audioUrl: form.audioUrl || null,
          scheduleAt: form.scheduleAt || null,
          scheduleTime: form.scheduleTime || null
        }
      })
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body?.error ?? "Falha ao criar automação");
      return;
    }
    setForm({
      name: "",
      trigger: "lead.stage.changed",
      whenStage: "Proposta enviada",
      message: "",
      sendType: "text",
      minLeadValue: "",
      onlyBusinessHours: false,
      scheduleAt: "",
      scheduleTime: "",
      audioUrl: ""
    });
    notify.success("Automação criada com sucesso.");
    setInfo("");
    setError("");
    await load();
  }

  async function toggle(id: string, enabled: boolean) {
    const response = await fetch(`${apiUrl()}/automations/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ enabled: !enabled })
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      notify.error(body?.error ?? "Falha ao atualizar automação");
      return;
    }
    notify.success(enabled ? "Automação pausada." : "Automação reativada.");
    setError("");
    await load();
  }

  async function remove(id: string, name: string) {
    const ok = await confirm({
      title: `Excluir automação "${name}"?`,
      description: "A regra deixa de rodar imediatamente. Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      tone: "danger"
    });
    if (!ok) return;
    const response = await fetch(`${apiUrl()}/automations/${id}`, { method: "DELETE", headers });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      notify.error(body?.error ?? "Falha ao excluir automação");
      return;
    }
    notify.success("Automação excluída.");
    setError("");
    await load();
  }

  return (
    <main className="atlas-page">
      <div className="atlas-page-inner w-full min-w-0">
        <div className="atlas-v5-module-shell atlas-v5-stack min-h-0">
        <AtlasViewHeader
          icon={Bot}
          section="Operação"
          title="Automações"
          description="Regras automáticas para leads e conversas"
          iconClassName="bg-violet-600 text-white border-violet-500/30"
        />

        <Card className="atlas-v5-card-pad">
          <p className="font-semibold text-slate-900">Nova automação</p>
          <p className="mt-1 text-xs text-slate-500">
            Use variáveis no texto: {"{{customer_name}}"}, {"{{lead_status}}"}, {"{{lead_value}}"}.
          </p>
          <div className="mt-4 space-y-3">
            <input
              className="atlas-field w-full px-3 py-2 text-sm outline-none"
              placeholder="Nome da automação"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="atlas-field w-full px-3 py-2 text-sm outline-none"
              placeholder="Quando etapa for... (opcional)"
              value={form.whenStage}
              onChange={(e) => setForm({ ...form, whenStage: e.target.value })}
              disabled={form.trigger !== "lead.stage.changed"}
            />
            <select
              className="atlas-field w-full px-3 py-2 text-sm outline-none"
              value={form.trigger}
              onChange={(e) => setForm({ ...form, trigger: e.target.value })}
            >
              <option value="lead.stage.changed">Lead mudou de etapa</option>
              <option value="lead.created">Lead criado</option>
              <option value="lead.closed">Lead fechado</option>
              <option value="lead.lost">Lead perdido</option>
              <option value="conversation.created">Conversa criada</option>
              <option value="conversation.unassigned">Conversa sem atendente</option>
            </select>
            <textarea
              className="atlas-field w-full px-3 py-2 text-sm outline-none"
              placeholder="Mensagem automática para enviar no WhatsApp"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
            <select
              className="atlas-field w-full px-3 py-2 text-sm outline-none"
              value={form.sendType}
              onChange={(e) => setForm({ ...form, sendType: e.target.value })}
            >
              <option value="text">Enviar texto</option>
              <option value="audit">Somente auditoria (não envia mensagem)</option>
            </select>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.onlyBusinessHours}
                onChange={(e) => setForm({ ...form, onlyBusinessHours: e.target.checked })}
              />
              Rodar apenas em horário comercial (seg–sex, 08h–18h)
            </label>
            <details className="rounded-xl border border-slate-200 bg-slate-50/80">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-700">Opções avançadas</summary>
              <div className="space-y-3 border-t border-slate-200 px-3 py-3">
                <label className="block text-xs font-medium text-slate-600">
                  Valor mínimo do lead (R$)
                  <input
                    className="atlas-field mt-1 w-full px-3 py-2 text-sm outline-none"
                    type="number"
                    min={0}
                    placeholder="Opcional"
                    value={form.minLeadValue}
                    onChange={(e) => setForm({ ...form, minLeadValue: e.target.value })}
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  Agendar data e hora
                  <input
                    className="atlas-field mt-1 w-full px-3 py-2 text-sm outline-none"
                    type="datetime-local"
                    value={form.scheduleAt}
                    onChange={(e) => setForm({ ...form, scheduleAt: e.target.value })}
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  Horário fixo diário
                  <input
                    className="atlas-field mt-1 w-full px-3 py-2 text-sm outline-none"
                    type="time"
                    value={form.scheduleTime}
                    onChange={(e) => setForm({ ...form, scheduleTime: e.target.value })}
                  />
                </label>
              </div>
            </details>
          </div>
          <Button className="mt-4" onClick={create}>
            <Plus size={16} /> Criar
          </Button>
          {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
          {!error && info ? <p className="mt-2 text-xs text-emerald-700">{info}</p> : null}
        </Card>

        {loading ? (
          <Loader2 className="animate-spin" />
        ) : !items.length ? (
          <EmptyState
            title="Nenhuma automação"
            description="Crie regras para disparar mensagens ou auditoria quando leads ou conversas mudarem."
            actionLabel="Nova automação"
            onAction={() => {
              const first = document.querySelector<HTMLInputElement>('input[placeholder="Nome da automação"]');
              first?.focus();
            }}
          />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Card key={item.id} className="atlas-v5-card-pad-sm flex items-center justify-between">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-atlas-muted">{triggerLabel(item.trigger)}</p>
                  <p className="mt-1 text-xs text-atlas-muted">
                    {SEND_TYPE_LABEL[String(item.config?.sendType ?? "text")] ?? "Ação"} · Horário comercial:{" "}
                    {item.config?.onlyBusinessHours ? "sim" : "não"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="glass" onClick={() => toggle(item.id, item.enabled)}>
                    <Badge>{item.enabled ? "Ativa" : "Pausada"}</Badge>
                  </Button>
                  <Button variant="glass" onClick={() => remove(item.id, item.name)} aria-label="Excluir automação">
                    <Trash2 size={16} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
        </div>
      </div>
    </main>
  );
}
