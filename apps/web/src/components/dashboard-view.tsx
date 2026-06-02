"use client";

import { useEffect, useState } from "react";
import { Activity, BarChart3, Download, Gauge, Loader2, Target, Timer, TrendingUp, Zap } from "lucide-react";
import { Button, Card } from "@atlas-one/ui";
import { apiUrl } from "../lib/config";
import { downloadOpsExport } from "../lib/api";

type Props = { token: string };

export function DashboardView({ token }: Props) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [projectionInput, setProjectionInput] = useState({
    meetingsPlanned: "20",
    closeRatePercent: "30",
    averageTicket: "3500",
    extraRevenue: "0"
  });

  function emptyDashboard() {
    return {
      metrics: {
        conversationTotal: 0,
        openConversations: 0,
        resolvedConversations: 0,
        leads: 0,
        sentMessages: 0,
        totalLeadValue: 0,
        closedRevenueMonth: 0,
        projectedRevenueMonth: 0,
        targetRevenue: 0,
        targetProgressPercent: 0,
        averageTicket: 0,
        conversionRate: 0,
        closedDealsMonth: 0,
        projectedDealsMonth: 0,
        gapToTarget: 0,
        weightedPipeline: 0,
        confidenceLevel: 0
      },
      pipeline: {
        "Novos leads": { count: 0, value: 0 },
        "Contato feito": { count: 0, value: 0 },
        "Reunião marcada": { count: 0, value: 0 },
        "Proposta enviada": { count: 0, value: 0 },
        Negociação: { count: 0, value: 0 },
        Fechado: { count: 0, value: 0 },
        Perdido: { count: 0, value: 0 }
      },
      salesForecast: {
        conservative: 0,
        realistic: 0,
        optimistic: 0,
        runRateRevenue: 0
      },
      teamPerformance: [],
      instances: [],
      sla: {
        config: { firstResponseMinutes: 15, resolutionHours: 24 },
        periodDays: 30,
        conversationsAnalyzed: 0,
        avgFirstResponseMinutes: null,
        avgResolutionHours: null,
        firstResponseWithinSlaPercent: 0,
        resolutionWithinSlaPercent: 0,
        openOverSlaCount: 0,
        agentPerformance: []
      }
    };
  }

  async function handleExport(kind: "leads" | "conversations" | "messages") {
    setExporting(kind);
    try {
      await downloadOpsExport(token, kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao exportar");
    } finally {
      setExporting(null);
    }
  }

  useEffect(() => {
    fetch(`${apiUrl()}/dashboard`, { headers: { authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (!r.ok) {
          setError("Painel indisponível no momento. Exibindo dados padrao.");
          return emptyDashboard();
        }
        return r.json();
      })
      .then((payload) => setData(payload ?? emptyDashboard()))
      .catch(() => {
        setError("Painel indisponível no momento. Exibindo dados padrao.");
        setData(emptyDashboard());
      });
  }, [token]);

  if (!data) {
    return (
      <div className="grid min-h-[40vh] place-items-center py-16">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const metrics = (data.metrics ?? data) as Record<string, number>;
  const pipeline = (data.pipeline ?? {}) as Record<string, { count: number; value: number }>;
  const salesForecast = (data.salesForecast ?? {}) as Record<string, number>;
  const teamPerformance = (data.teamPerformance ?? []) as {
    name: string;
    leads: number;
    closed: number;
    revenue: number;
    weighted: number;
    conversionRate: number;
  }[];
  const instances = (data.instances ?? []) as {
    label: string;
    name: string;
    status: string;
    connectionStatus?: string;
    phone?: string | null;
  }[];
  const sla = (data.sla ?? {}) as {
    config?: { firstResponseMinutes?: number; resolutionHours?: number };
    avgFirstResponseMinutes?: number | null;
    avgResolutionHours?: number | null;
    firstResponseWithinSlaPercent?: number;
    resolutionWithinSlaPercent?: number;
    openOverSlaCount?: number;
    conversationsAnalyzed?: number;
    agentPerformance?: Array<{
      name: string;
      conversations: number;
      avgFirstResponseMinutes: number | null;
      withinSlaPercent: number;
    }>;
  };

  function toMoney(value: number) {
    return `R$ ${Number(value || 0).toLocaleString("pt-BR")}`;
  }

  function toPercent(value: number) {
    return `${Number(value || 0).toFixed(0)}%`;
  }

  const meetings = Number(projectionInput.meetingsPlanned || 0);
  const closeRate = Number(projectionInput.closeRatePercent || 0);
  const avgTicketInput = Number(projectionInput.averageTicket || 0);
  const extraRevenue = Number(projectionInput.extraRevenue || 0);
  const projectedClosedByTeamInput = Math.max(0, Math.round((meetings * closeRate) / 100));
  const projectedRevenueByTeamInput = projectedClosedByTeamInput * avgTicketInput + extraRevenue;
  const closedRevenue = Number(metrics.closedRevenueMonth ?? 0);
  const targetRevenue = Number(metrics.targetRevenue ?? 0);
  const targetProgressPercent = Math.max(
    0,
    Math.min(
      100,
      Number(
        metrics.targetProgressPercent ??
          (targetRevenue > 0 ? (closedRevenue / targetRevenue) * 100 : 0)
      )
    )
  );
  const stageRows = Object.entries(pipeline)
    .map(([stage, info]) => ({
      stage,
      count: Number(info.count ?? 0),
      value: Number(info.value ?? 0)
    }))
    .sort((a, b) => b.value - a.value);
  const stageMax = Math.max(...stageRows.map((row) => row.value), 1);
  const teamRows = [...teamPerformance].sort((a, b) => Number(b.revenue ?? 0) - Number(a.revenue ?? 0));
  const teamMaxRevenue = Math.max(...teamRows.map((row) => Number(row.revenue ?? 0)), 1);
  const connectedInstances = instances.filter((item) => {
    const state = String(item.connectionStatus ?? item.status ?? "").toLowerCase();
    return state === "connected" || state === "open";
  }).length;

  const projectionRows = [
    { label: "Real fechado", value: closedRevenue, tone: "bg-slate-300" },
    { label: "Equipe (simulação)", value: projectedRevenueByTeamInput, tone: "bg-cyan-400" },
    { label: "Conservador", value: Number(salesForecast.conservative ?? 0), tone: "bg-amber-300" },
    { label: "Realista", value: Number(salesForecast.realistic ?? 0), tone: "bg-blue-400" },
    { label: "Otimista", value: Number(salesForecast.optimistic ?? 0), tone: "bg-emerald-400" },
    { label: "Meta", value: targetRevenue, tone: "bg-fuchsia-300" }
  ];
  const projectionMax = Math.max(...projectionRows.map((row) => row.value), 1);

  const lineSeries = [
    Math.max(closedRevenue * 0.32, 0),
    Math.max(closedRevenue * 0.55, 0),
    closedRevenue,
    Number(salesForecast.runRateRevenue ?? 0),
    Number(salesForecast.realistic ?? projectedRevenueByTeamInput),
    Number(salesForecast.optimistic ?? projectedRevenueByTeamInput * 1.2)
  ].map((value) => Math.max(0, Number(value || 0)));

  const chartWidth = 620;
  const chartHeight = 230;
  const chartPadding = 24;
  const chartUsableHeight = chartHeight - chartPadding * 2;
  const chartUsableWidth = chartWidth - chartPadding * 2;
  const chartMax = Math.max(...lineSeries, 1);
  const chartPoints = lineSeries.map((value, index) => {
    const x = chartPadding + (index / Math.max(lineSeries.length - 1, 1)) * chartUsableWidth;
    const y = chartHeight - chartPadding - (value / chartMax) * chartUsableHeight;
    return { x, y, value };
  });
  const chartLine = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const firstPoint = chartPoints[0];
  const lastPoint = chartPoints[chartPoints.length - 1];
  const chartArea =
    chartPoints.length > 1 && firstPoint && lastPoint
      ? `M ${firstPoint.x} ${chartHeight - chartPadding} L ${chartLine.replaceAll(",", " ")} L ${lastPoint.x} ${
          chartHeight - chartPadding
        } Z`
      : "";

  return (
    <main className="atlas-page">
      <div className="atlas-page-inner w-full min-w-0 max-w-[88rem]">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-slate-900 text-cyan-300">
              <BarChart3 size={20} />
            </div>
            <div>
              <p className="atlas-section-title">Operação e vendas</p>
              <h1 className="text-2xl font-semibold text-slate-900 lg:text-3xl">Painel de performance</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-right">
              <p className="text-[11px] font-medium text-slate-500">Confiança da previsão</p>
              <p className="text-xl font-semibold text-slate-900">{toPercent(Number(metrics.confidenceLevel ?? 0))}</p>
            </div>
            <Button
              variant="glass"
              className="h-10 gap-2 text-xs"
              disabled={!!exporting}
              onClick={() => void handleExport("leads")}
            >
              {exporting === "leads" ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
              Leads CSV
            </Button>
            <Button
              variant="glass"
              className="h-10 gap-2 text-xs"
              disabled={!!exporting}
              onClick={() => void handleExport("conversations")}
            >
              {exporting === "conversations" ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
              Conversas CSV
            </Button>
            <Button
              variant="glass"
              className="h-10 gap-2 text-xs"
              disabled={!!exporting}
              onClick={() => void handleExport("messages")}
            >
              {exporting === "messages" ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
              Mensagens CSV
            </Button>
          </div>
        </header>
        {error ? <p className="mb-4 text-sm text-amber-700">{error}</p> : null}

        <div className="mb-5 grid gap-3 lg:grid-cols-4">
          <Card className="border border-slate-200 bg-white p-4 lg:col-span-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Timer size={18} className="text-cyan-700" />
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">SLA operacional</p>
                  <p className="text-lg font-semibold text-slate-900">
                    Meta: {sla.config?.firstResponseMinutes ?? 15} min · {sla.config?.resolutionHours ?? 24}h resolução
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500">{sla.conversationsAnalyzed ?? 0} conversas (30 dias)</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-white/90 p-3">
                <p className="text-xs text-slate-500">Tempo médio 1ª resposta</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {sla.avgFirstResponseMinutes != null ? `${sla.avgFirstResponseMinutes} min` : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-white/90 p-3">
                <p className="text-xs text-slate-500">Dentro do SLA (1ª resposta)</p>
                <p className="text-2xl font-semibold text-emerald-700">
                  {toPercent(Number(sla.firstResponseWithinSlaPercent ?? 0))}
                </p>
              </div>
              <div className="rounded-xl bg-white/90 p-3">
                <p className="text-xs text-slate-500">Tempo médio resolução</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {sla.avgResolutionHours != null ? `${sla.avgResolutionHours} h` : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-white/90 p-3">
                <p className="text-xs text-slate-500">Abertas fora do SLA</p>
                <p className="text-2xl font-semibold text-rose-700">{Number(sla.openOverSlaCount ?? 0)}</p>
              </div>
            </div>
            {(sla.agentPerformance ?? []).length ? (
              <div className="mt-3 space-y-2">
                {(sla.agentPerformance ?? []).slice(0, 5).map((agent) => (
                  <div key={agent.name} className="flex items-center justify-between rounded-lg border border-white bg-white/80 px-3 py-2 text-xs">
                    <span className="font-medium text-slate-700">{agent.name}</span>
                    <span className="text-slate-500">
                      {agent.conversations} conv · SLA {toPercent(agent.withinSlaPercent)}
                      {agent.avgFirstResponseMinutes != null ? ` · ${agent.avgFirstResponseMinutes} min` : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card className="border border-white/70 bg-white/75 p-4 backdrop-blur">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Receita fechada</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{toMoney(closedRevenue)}</p>
          </Card>
          <Card className="border border-white/70 bg-white/75 p-4 backdrop-blur">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Negócios fechados</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{Number(metrics.closedDealsMonth ?? 0)}</p>
          </Card>
          <Card className="border border-white/70 bg-white/75 p-4 backdrop-blur">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Conversas abertas</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{Number(metrics.openConversations ?? 0)}</p>
          </Card>
          <Card className="border border-white/70 bg-white/75 p-4 backdrop-blur">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Meta do mês</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{toMoney(targetRevenue)}</p>
          </Card>
          <Card className="border border-white/70 bg-white/75 p-4 backdrop-blur">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Gap para meta</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{toMoney(Number(metrics.gapToTarget ?? 0))}</p>
          </Card>
          <Card className="border border-white/70 bg-white/75 p-4 backdrop-blur">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Ritmo mensal</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{toMoney(Number(salesForecast.runRateRevenue ?? 0))}</p>
          </Card>
        </div>

        <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-12">
          <Card className="min-w-0 border border-white/70 bg-white/70 p-4 backdrop-blur-xl lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Projeção comercial</p>
                <p className="text-lg font-semibold text-slate-900">Trajetória de receita</p>
              </div>
              <div className="inline-flex items-center gap-1 rounded-lg border border-white/70 bg-white/80 px-2 py-1 text-xs text-slate-600">
                <TrendingUp size={13} />
                {toMoney(Number(salesForecast.realistic ?? 0))} realista
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-white/80 bg-white/80 p-2">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-56 w-full">
                <defs>
                  <linearGradient id="dashboard-line" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.03" />
                  </linearGradient>
                </defs>
                {[0, 1, 2, 3].map((index) => (
                  <line
                    key={index}
                    x1={chartPadding}
                    x2={chartWidth - chartPadding}
                    y1={chartPadding + (chartUsableHeight / 3) * index}
                    y2={chartPadding + (chartUsableHeight / 3) * index}
                    stroke="rgba(148,163,184,0.25)"
                    strokeWidth="1"
                  />
                ))}
                {chartArea ? <path d={chartArea} fill="url(#dashboard-line)" /> : null}
                <polyline points={chartLine} fill="none" stroke="#2563eb" strokeWidth="2.5" />
                {chartPoints.map((point, index) => (
                  <circle key={index} cx={point.x} cy={point.y} r="3.5" fill="#3b82f6" />
                ))}
              </svg>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {projectionRows.map((row) => (
                <div key={row.label} className="rounded-xl border border-white/80 bg-white/80 p-2.5">
                  <div className="mb-2 flex items-center justify-between text-[11px] text-slate-600">
                    <span>{row.label}</span>
                    <span>{toMoney(row.value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full ${row.tone}`}
                      style={{ width: `${Math.max(6, (row.value / projectionMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="min-w-0 border border-white/70 bg-white/70 p-4 backdrop-blur-xl lg:col-span-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Execução da meta</p>
                <p className="text-lg font-semibold text-slate-900">Indicador de meta</p>
              </div>
              <Target size={18} className="text-slate-600" />
            </div>
            <div className="mt-3 grid place-items-center">
              <div
                className="grid h-36 w-36 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(#22d3ee ${targetProgressPercent * 3.6}deg, rgba(71,85,105,0.35) 0deg)`
                }}
              >
                <div className="grid h-28 w-28 place-items-center rounded-full bg-white text-center">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Progresso</p>
                  <p className="text-2xl font-semibold text-slate-900">{toPercent(targetProgressPercent)}</p>
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-white/85 px-2 py-1.5">
                <span className="text-slate-500">Receita fechada</span>
                <strong className="text-slate-900">{toMoney(closedRevenue)}</strong>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/85 px-2 py-1.5">
                <span className="text-slate-500">Meta atual</span>
                <strong className="text-slate-900">{toMoney(targetRevenue)}</strong>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/85 px-2 py-1.5">
                <span className="text-slate-500">Fechamentos previstos</span>
                <strong className="text-slate-900">{projectedClosedByTeamInput}</strong>
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                <strong>Simulador (não altera a meta oficial).</strong> Use estes campos apenas para projetar cenários:
                reuniões × taxa de fechamento = negócios previstos; negócios × ticket + extra = receita simulada.
              </p>
              <label className="text-[11px] font-medium text-slate-600">
                Reuniões planejadas no mês
                <input
                  className="mt-1 w-full rounded-lg border border-white/70 bg-white/90 px-3 py-2 text-xs text-slate-800"
                  type="number"
                  min={0}
                  value={projectionInput.meetingsPlanned}
                  onChange={(e) => setProjectionInput((s) => ({ ...s, meetingsPlanned: e.target.value }))}
                />
                <span className="mt-0.5 block text-[10px] font-normal text-slate-500">Quantas reuniões comerciais você espera realizar.</span>
              </label>
              <label className="text-[11px] font-medium text-slate-600">
                Taxa de fechamento (%)
                <input
                  className="mt-1 w-full rounded-lg border border-white/70 bg-white/90 px-3 py-2 text-xs text-slate-800"
                  type="number"
                  min={0}
                  max={100}
                  value={projectionInput.closeRatePercent}
                  onChange={(e) => setProjectionInput((s) => ({ ...s, closeRatePercent: e.target.value }))}
                />
                <span className="mt-0.5 block text-[10px] font-normal text-slate-500">
                  Percentual de reuniões que viram venda. Ex.: 30 = 30% das reuniões fecham.
                </span>
              </label>
              <label className="text-[11px] font-medium text-slate-600">
                Ticket médio esperado (R$)
                <input
                  className="mt-1 w-full rounded-lg border border-white/70 bg-white/90 px-3 py-2 text-xs text-slate-800"
                  type="number"
                  min={0}
                  value={projectionInput.averageTicket}
                  onChange={(e) => setProjectionInput((s) => ({ ...s, averageTicket: e.target.value }))}
                />
                <span className="mt-0.5 block text-[10px] font-normal text-slate-500">Valor médio de cada negócio fechado na simulação.</span>
              </label>
              <label className="text-[11px] font-medium text-slate-600">
                Receita extra prevista (R$)
                <input
                  className="mt-1 w-full rounded-lg border border-white/70 bg-white/90 px-3 py-2 text-xs text-slate-800"
                  type="number"
                  min={0}
                  value={projectionInput.extraRevenue}
                  onChange={(e) => setProjectionInput((s) => ({ ...s, extraRevenue: e.target.value }))}
                />
                <span className="mt-0.5 block text-[10px] font-normal text-slate-500">Renovações, upsell ou receitas fora do funil de reuniões.</span>
              </label>
            </div>
            <div className="mt-3 rounded-lg bg-cyan-50 px-3 py-2 text-[11px] text-cyan-950">
              Resultado da simulação: <strong>{projectedClosedByTeamInput} fechamentos</strong> ·{" "}
              <strong>{toMoney(projectedRevenueByTeamInput)}</strong> de receita projetada.
            </div>
            <div className="mt-3 rounded-lg bg-white/90 px-3 py-2 text-xs">
              <p className="text-slate-500">Meta oficial do mes (CRM / Admin)</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{toMoney(targetRevenue)}</p>
              <p className="mt-1 text-[10px] text-slate-500">Defina em Admin → Metas comerciais. O gauge usa esta meta, não a simulação.</p>
            </div>
            </Card>

          <Card className="lg:col-span-7 border border-white/70 bg-white/75 p-4 backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Intensidade do funil</p>
                <p className="text-lg font-semibold text-slate-900">Etapas com maior valor em aberto</p>
              </div>
              <Activity size={18} className="text-slate-600" />
            </div>
            <div className="space-y-2.5">
              {stageRows.map((row) => (
                <div key={row.stage} className="rounded-xl border border-white/70 bg-white/80 p-2.5">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{row.stage}</span>
                    <span className="text-slate-500">
                      {row.count} leads · {toMoney(row.value)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-slate-700 via-cyan-500 to-cyan-300"
                      style={{ width: `${Math.max(5, (row.value / stageMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {!stageRows.length ? <p className="text-xs text-slate-500">Sem dados de pipeline ainda.</p> : null}
            </div>
          </Card>

          <Card className="lg:col-span-5 border border-white/70 bg-white/75 p-4 backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Operação WhatsApp</p>
                <p className="text-lg font-semibold text-slate-900">Números conectados</p>
              </div>
              <Gauge size={18} className="text-slate-700" />
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-white px-2 py-2">
                <p className="text-slate-500">Conectados</p>
                <p className="text-lg font-semibold text-emerald-600">{connectedInstances}</p>
              </div>
              <div className="rounded-lg bg-white px-2 py-2">
                <p className="text-slate-500">Total</p>
                <p className="text-lg font-semibold text-slate-900">{instances.length}</p>
              </div>
              <div className="rounded-lg bg-white px-2 py-2">
                <p className="text-slate-500">Mensagens</p>
                <p className="text-lg font-semibold text-slate-900">{Number(metrics.sentMessages ?? 0)}</p>
              </div>
            </div>
            <div className="space-y-2">
              {instances.map((item) => {
                const label = item.connectionStatus ?? item.status;
                const normalized = String(label ?? "").toLowerCase();
                const tone =
                  normalized === "connected" || normalized === "open"
                    ? "text-emerald-600 bg-emerald-50"
                    : normalized === "connecting"
                      ? "text-amber-600 bg-amber-50"
                      : normalized === "needs_setup"
                        ? "text-slate-600 bg-slate-100"
                        : "text-rose-600 bg-rose-50";
                const display =
                  normalized === "connected" || normalized === "open"
                    ? "Conectado"
                    : normalized === "connecting"
                      ? "Conectando"
                      : normalized === "disconnected" || normalized === "closed"
                        ? "Desconectado"
                        : normalized === "needs_setup"
                          ? "Configurar"
                          : label;
                return (
                  <div key={item.name} className="flex items-center justify-between rounded-lg border border-white bg-white px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.phone ?? item.name}</p>
                    </div>
                    <p className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>
                      {display}
                    </p>
                  </div>
                );
              })}
              {!instances.length ? <p className="text-xs text-slate-500">Sem números cadastrados.</p> : null}
            </div>
          </Card>
        </div>

        <Card className="mt-3 border border-white/70 bg-white/75 p-4 backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ranking da equipe</p>
              <p className="text-lg font-semibold text-slate-900">Desempenho por responsável</p>
            </div>
            <Zap size={18} className="text-slate-700" />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {teamRows.map((row) => (
              <div key={row.name} className="rounded-xl border border-white bg-white/90 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">{row.name}</p>
                  <p className="text-xs text-slate-500">{toPercent(Number(row.conversionRate ?? 0))} conversao</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {row.leads} leads · {row.closed} fechados · {toMoney(Number(row.revenue ?? 0))}
                </p>
                <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                    style={{ width: `${Math.max(6, (Number(row.revenue ?? 0) / teamMaxRevenue) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {!teamRows.length ? <p className="text-xs text-slate-500">Sem dados de desempenho ainda.</p> : null}
          </div>
        </Card>
      </div>
    </main>
  );
}
