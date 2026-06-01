"use client";

import { useEffect, useState } from "react";
import { Loader2, Megaphone, Pause, Play, Plus, Trash2, XCircle } from "lucide-react";
import { Badge, Button, Card } from "@atlas-one/ui";
import { apiUrl } from "../lib/config";

type Props = { token: string };

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

export function CampaignsView({ token }: Props) {
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
      setError("Selecione a instancia WhatsApp.");
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
    <main className="w-full p-4 pb-28 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center gap-3">
          <Megaphone className="text-atlas-blue" size={28} />
          <div>
            <h1 className="text-3xl font-semibold">Campanhas</h1>
            <p className="text-sm text-atlas-muted">Disparo em massa via WhatsApp (Evolution ou Meta template)</p>
          </div>
        </header>

        <Card className="p-5">
          <p className="font-semibold">Nova campanha</p>
          <p className="mt-1 text-xs text-atlas-muted">
            Destinatários: um telefone por linha. Opcional: <code>5517999999999,Nome</code>. Variáveis:{" "}
            {"{{customer_name}}"}.
          </p>
          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded-xl bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/80"
              placeholder="Nome da campanha"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              className="w-full rounded-xl bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/80"
              value={form.instanceId}
              onChange={(e) => setForm({ ...form, instanceId: e.target.value })}
            >
              <option value="">Instancia WhatsApp</option>
              {instances.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label || item.name} ({item.status})
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-xl bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/80"
              value={form.messageKind}
              onChange={(e) => setForm({ ...form, messageKind: e.target.value as "session" | "template" })}
            >
              <option value="session">Mensagem livre (Evolution / janela 24h Meta)</option>
              <option value="template">Template Meta (API oficial)</option>
            </select>
            {form.messageKind === "template" ? (
              <>
                <input
                  className="w-full rounded-xl bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/80"
                  placeholder="Nome do template Meta (ex: hello_world)"
                  value={form.templateName}
                  onChange={(e) => setForm({ ...form, templateName: e.target.value })}
                />
                <input
                  className="w-full rounded-xl bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/80"
                  placeholder="Idioma (ex: pt_BR)"
                  value={form.templateLanguage}
                  onChange={(e) => setForm({ ...form, templateLanguage: e.target.value })}
                />
              </>
            ) : null}
            <textarea
              className="min-h-[100px] w-full rounded-xl bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/80"
              placeholder="Mensagem da campanha"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
            <textarea
              className="min-h-[120px] w-full rounded-xl bg-white/80 px-3 py-2 text-sm font-mono dark:bg-slate-900/80"
              placeholder={"5517999999999,Joao\n5517988888888,Maria"}
              value={form.recipientsText}
              onChange={(e) => setForm({ ...form, recipientsText: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="w-full rounded-xl bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/80"
                type="number"
                min={1}
                max={60}
                placeholder="Msgs/min"
                value={form.messagesPerMinute}
                onChange={(e) => setForm({ ...form, messagesPerMinute: e.target.value })}
              />
              <label className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/80">
                <input
                  type="checkbox"
                  checked={form.onlyBusinessHours}
                  onChange={(e) => setForm({ ...form, onlyBusinessHours: e.target.checked })}
                />
                Horario comercial
              </label>
            </div>
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
              <Card className="p-4 text-sm text-atlas-muted">Nenhuma campanha ainda.</Card>
            ) : null}
            {items.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-atlas-muted">
                      {item.instance?.label ?? item.instance?.name ?? "WhatsApp"} · {item.messageKind}
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
    </main>
  );
}
