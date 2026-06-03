"use client";

import { useEffect, useState } from "react";
import { Loader2, Megaphone, Pause, Play, Plus, Trash2, XCircle } from "lucide-react";
import { Badge, Button, Card } from "@atlas-one/ui";
import { apiUrl } from "../lib/config";
import type { SessionUser } from "../lib/api";
import { hasPermission } from "../lib/session-user";
import { AtlasViewHeader } from "./atlas-view-header";
import { EmptyState } from "./empty-state";
import { AtlasAiCampaignsPanel } from "./atlas-ai/atlas-ai-campaigns-panel";

const MESSAGE_KIND_LABEL: Record<string, string> = {
  session: "Mensagem livre",
  template: "Template Meta"
};

type Props = { token: string; user: SessionUser };

type Instance = { id: string; name: string; label: string; status: string };

type Campaign = {
  id: string;
  name: string;
  status: string;
  messageKind: string;
  message?: string | null;
  templateName?: string | null;
  stats?: { pending: number; sent: number; failed: number; skipped: number; total: number };
  instance?: Instance;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  running: "Enviando",
  paused: "Pausada",
  completed: "Concluída",
  cancelled: "Cancelada"
};

export function CampaignsView({ token, user }: Props) {
  const [items, setItems] = useState<Campaign[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [form, setForm] = useState({
    name: "",
    instanceId: "",
    messageKind: "session" as "session" | "template",
    message: "",
    templateName: "",
    templateLanguage: "pt_BR",
    recipientsText: "",
    messagesPerMinute: "15",
    onlyBusinessHours: true
  });

  const headers = { authorization: `Bearer ${token}` };
  const jsonHeaders = { ...headers, "content-type": "application/json" };

  async function load() {
    const [campaignRes, instanceRes] = await Promise.all([
      fetch(`${apiUrl()}/campaigns`, { headers }),
      fetch(`${apiUrl()}/whatsapp/instances`, { headers })
    ]);
    if (campaignRes.ok) {
      setItems(await campaignRes.json());
      setError("");
    } else {
      const body = await campaignRes.json().catch(() => ({}));
      setError(body?.error ?? "Falha ao carregar campanhas");
    }
    if (instanceRes.ok) {
      const list = await instanceRes.json();
      setInstances(Array.isArray(list) ? list : []);
      if (!form.instanceId && Array.isArray(list) && list[0]?.id) {
        setForm((prev) => ({ ...prev, instanceId: list[0].id }));
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [token]);

  async function create() {
    if (!form.name.trim()) {
      setError("Informe o nome da campanha.");
      return;
    }
    if (!form.instanceId) {
      setError("Selecione a instância WhatsApp.");
      return;
    }
    if (!form.recipientsText.trim()) {
      setError("Informe os destinatários (um telefone por linha).");
      return;
    }
    const response = await fetch(`${apiUrl()}/campaigns`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        name: form.name,
        instanceId: form.instanceId,
        messageKind: form.messageKind,
        message: form.message,
        templateName: form.templateName || undefined,
        templateLanguage: form.templateLanguage,
        recipientsText: form.recipientsText,
        config: {
          messagesPerMinute: Number(form.messagesPerMinute) || 15,
          onlyBusinessHours: form.onlyBusinessHours,
          respectOptOut: true
        }
      })
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body?.error ?? body?.details ?? "Falha ao criar campanha");
      return;
    }
    setForm({
      name: "",
      instanceId: form.instanceId,
      messageKind: "session",
      message: "",
      templateName: "",
      templateLanguage: "pt_BR",
      recipientsText: "",
      messagesPerMinute: "15",
      onlyBusinessHours: true
    });
    setInfo("Campanha criada. Clique em Iniciar para disparar.");
    setError("");
    await load();
  }

  async function action(id: string, kind: "start" | "pause" | "cancel" | "delete") {
    if (kind === "delete" && !window.confirm("Excluir esta campanha?")) return;
    const response = await fetch(`${apiUrl()}/campaigns/${id}${kind === "delete" ? "" : `/${kind}`}`, {
      method: kind === "delete" ? "DELETE" : "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: kind === "delete" ? undefined : JSON.stringify({})
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body?.error ?? body?.details ?? "Falha na ação");
      return;
    }
    setInfo(
      kind === "start"
        ? "Campanha iniciada — envios em fila."
        : kind === "pause"
          ? "Campanha pausada."
          : kind === "cancel"
            ? "Campanha cancelada."
            : "Campanha excluída."
    );
    setError("");
    await load();
  }

  return (
    <main className="atlas-page">
      <div className="atlas-page-inner w-full min-w-0">
        <div className="atlas-v5-module-shell atlas-v5-stack min-h-0">
        <AtlasViewHeader
          icon={Megaphone}
          section="Marketing"
          title="Campanhas"
          description="Disparo em massa via WhatsApp"
          iconClassName="bg-blue-600 text-white border-blue-500/30"
        />

        <Card className="atlas-v5-card-pad">
          <p className="font-semibold text-slate-900">Nova campanha</p>
          <p className="mt-1 text-xs text-slate-500">
            Destinatários: um telefone por linha. Opcional: <code className="rounded bg-slate-100 px-1">5517999999999,Nome</code>. Variáveis:{" "}
            {"{{customer_name}}"}.
          </p>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="atlas-label mb-1.5">Nome da campanha</span>
              <input
                className="atlas-field w-full px-3 py-2 text-sm outline-none"
                placeholder="Ex.: Promoção março"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="atlas-label mb-1.5">Instância WhatsApp</span>
              <select
                className="atlas-field w-full px-3 py-2 text-sm outline-none"
                value={form.instanceId}
                onChange={(e) => setForm({ ...form, instanceId: e.target.value })}
              >
                <option value="">Selecione a instância</option>
              {instances.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label || item.name} ({item.status})
                </option>
              ))}
              </select>
            </label>
            <label className="block">
              <span className="atlas-label mb-1.5">Tipo de mensagem</span>
              <select
              className="atlas-field w-full px-3 py-2 text-sm outline-none"
              value={form.messageKind}
              onChange={(e) => setForm({ ...form, messageKind: e.target.value as "session" | "template" })}
            >
              <option value="session">Mensagem livre (Evolution / janela 24h Meta)</option>
              <option value="template">Template Meta (API oficial)</option>
              </select>
            </label>
            {form.messageKind === "template" ? (
              <>
                <label className="block">
                  <span className="atlas-label mb-1.5">Nome do template Meta</span>
                  <input
                    className="atlas-field w-full px-3 py-2 text-sm outline-none"
                    placeholder="ex: hello_world"
                    value={form.templateName}
                    onChange={(e) => setForm({ ...form, templateName: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="atlas-label mb-1.5">Idioma do template</span>
                  <input
                    className="atlas-field w-full px-3 py-2 text-sm outline-none"
                    placeholder="pt_BR"
                    value={form.templateLanguage}
                    onChange={(e) => setForm({ ...form, templateLanguage: e.target.value })}
                  />
                </label>
              </>
            ) : null}
            <label className="block">
              <span className="atlas-label mb-1.5">Mensagem da campanha</span>
              <textarea
                className="atlas-field min-h-[100px] w-full px-3 py-2 text-sm outline-none"
                placeholder="Texto enviado aos destinatários"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </label>
            {hasPermission(user, "ai:use") ? (
              <AtlasAiCampaignsPanel
                token={token}
                message={form.messageKind === "session" ? form.message : form.templateName || form.message}
                campaignName={form.name}
                messageKind={form.messageKind}
                templateName={form.templateName}
                onApplyMessage={(text) => setForm((prev) => ({ ...prev, message: text }))}
              />
            ) : null}
            <label className="block">
              <span className="atlas-label mb-1.5">Destinatários</span>
              <textarea
                className="atlas-field min-h-[120px] w-full px-3 py-2 font-mono text-sm outline-none"
              placeholder={"5517999999999,Joao\n5517988888888,Maria"}
              value={form.recipientsText}
              onChange={(e) => setForm({ ...form, recipientsText: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/80">
              <input
                type="checkbox"
                checked={form.onlyBusinessHours}
                onChange={(e) => setForm({ ...form, onlyBusinessHours: e.target.checked })}
              />
              Enviar apenas em horário comercial
            </label>
            <details className="rounded-xl border border-slate-200 bg-slate-50/80">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-700">Limites de envio</summary>
              <label className="block border-t border-slate-200 px-3 py-3">
                <span className="atlas-label mb-1.5">Mensagens por minuto</span>
                <input
                  className="atlas-field w-full px-3 py-2 text-sm outline-none"
                  type="number"
                  min={1}
                  max={60}
                  placeholder="15"
                  value={form.messagesPerMinute}
                  onChange={(e) => setForm({ ...form, messagesPerMinute: e.target.value })}
                />
              </label>
            </details>
          </div>
          <Button className="mt-4" onClick={create}>
            <Plus size={16} /> Criar campanha
          </Button>
          {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
          {!error && info ? <p className="mt-2 text-xs text-emerald-700">{info}</p> : null}
        </Card>

        {loading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <div className="space-y-3">
            {items.length === 0 ? (
              <EmptyState
                title="Nenhuma campanha"
                description="Crie uma campanha para disparar mensagens em massa pelo WhatsApp."
                actionLabel="Nova campanha"
                onAction={() => {
                  const first = document.querySelector<HTMLInputElement>('input[placeholder="Ex.: Promoção março"]');
                  first?.focus();
                }}
              />
            ) : null}
            {items.map((item) => (
              <Card key={item.id} className="atlas-v5-card-pad-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-atlas-muted">
                      {item.instance?.label ?? item.instance?.name ?? "WhatsApp"} ·{" "}
                      {MESSAGE_KIND_LABEL[item.messageKind] ?? item.messageKind}
                    </p>
                    <p className="mt-1 text-xs text-atlas-muted">
                      Enviados {item.stats?.sent ?? 0}/{item.stats?.total ?? 0} · Falhas {item.stats?.failed ?? 0} ·
                      Pendentes {item.stats?.pending ?? 0}
                    </p>
                  </div>
                  <Badge>{STATUS_LABEL[item.status] ?? item.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["draft", "scheduled", "paused"].includes(item.status) ? (
                    <Button variant="glass" onClick={() => action(item.id, "start")}>
                      <Play size={14} /> Iniciar
                    </Button>
                  ) : null}
                  {item.status === "running" ? (
                    <Button variant="glass" onClick={() => action(item.id, "pause")}>
                      <Pause size={14} /> Pausar
                    </Button>
                  ) : null}
                  {!["completed", "cancelled"].includes(item.status) ? (
                    <Button variant="glass" onClick={() => action(item.id, "cancel")}>
                      <XCircle size={14} /> Cancelar
                    </Button>
                  ) : null}
                  {item.status !== "running" ? (
                    <Button variant="glass" onClick={() => action(item.id, "delete")}>
                      <Trash2 size={14} />
                    </Button>
                  ) : null}
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
