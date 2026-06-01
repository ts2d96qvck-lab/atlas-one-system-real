"use client";

import { useEffect, useState } from "react";
import { Bot, Loader2, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card } from "@atlas-one/ui";
import { apiUrl } from "../lib/config";

type Props = { token: string };

type Automation = {
  id: string;
  name: string;
  trigger: string;
  enabled: boolean;
  config?: Record<string, unknown>;
};

export function AutomationsView({ token }: Props) {
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
      setError(body?.error ?? "Falha ao carregar automacoes");
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
    setInfo("Automação criada com sucesso.");
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
      setError(body?.error ?? "Falha ao atualizar automação");
      return;
    }
    setInfo(enabled ? "Automação pausada." : "Automação reativada.");
    setError("");
    await load();
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Excluir automação "${name}"?`)) return;
    const response = await fetch(`${apiUrl()}/automations/${id}`, { method: "DELETE", headers });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body?.error ?? "Falha ao excluir automação");
      return;
    }
    setInfo("Automação excluída.");
    setError("");
    await load();
  }

  return (
    <main className="atlas-page">
      <div className="atlas-page-inner max-w-3xl space-y-6">
        <header className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-violet-600 text-white">
            <Bot size={20} />
          </div>
          <div>
            <p className="atlas-section-title">Operação</p>
            <h1 className="text-2xl font-semibold text-slate-900">Automações</h1>
            <p className="text-sm text-slate-500">Regras automáticas para leads e conversas</p>
          </div>
        </header>

        <Card className="p-5">
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
              placeholder="Mensagem automatica para enviar no WhatsApp"
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
            <input
              className="atlas-field w-full px-3 py-2 text-sm outline-none"
              type="number"
              min={0}
              placeholder="Valor minimo do lead para disparar (opcional)"
              value={form.minLeadValue}
              onChange={(e) => setForm({ ...form, minLeadValue: e.target.value })}
            />
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.onlyBusinessHours}
                onChange={(e) => setForm({ ...form, onlyBusinessHours: e.target.checked })}
              />
              Rodar apenas em horario comercial (seg-sex, 08h-18h)
            </label>
            <input
              className="atlas-field w-full px-3 py-2 text-sm outline-none"
              type="datetime-local"
              value={form.scheduleAt}
              onChange={(e) => setForm({ ...form, scheduleAt: e.target.value })}
            />
            <input
              className="atlas-field w-full px-3 py-2 text-sm outline-none"
              type="time"
              value={form.scheduleTime}
              onChange={(e) => setForm({ ...form, scheduleTime: e.target.value })}
            />
          </div>
          <Button className="mt-4" onClick={create}>
            <Plus size={16} /> Criar
          </Button>
          {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
          {!error && info ? <p className="mt-2 text-xs text-emerald-700">{info}</p> : null}
        </Card>

        {loading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Card key={item.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-atlas-muted">{item.trigger}</p>
                  <p className="mt-1 text-xs text-atlas-muted">
                    Ação: {String(item.config?.sendType ?? "text")} · Horario comercial:{" "}
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

        <Card className="p-4 text-sm text-atlas-muted">
          Webhook Atlas One (pagamentos):
          <code className="mt-2 block break-all rounded bg-white/70 p-2 text-xs">
            POST {apiUrl()}/payments/webhook/atlas-one
          </code>
          <p className="mt-2 text-xs">Body exemplo: {`{"event":"payment.paid","customerPhone":"5517999999999","amount":1200}`}</p>
        </Card>
      </div>
    </main>
  );
}
