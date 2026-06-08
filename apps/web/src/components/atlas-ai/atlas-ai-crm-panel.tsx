"use client";

import {
  aiLeadCloseProbability,
  aiLeadNextTask,
  aiLeadSummary,
  aiLeadWinLossInsight,
  copyAtlasAiText
} from "../../lib/atlas-ai";
import type { SessionUser } from "../../lib/api";
import {
  AtlasAiAccessFallback,
  AtlasAiActionBar,
  AtlasAiField,
  AtlasAiList,
  AtlasAiResultCard,
  AtlasAiSection,
  AtlasAiShell,
  useAiRunner,
  useAtlasAiAccess
} from "./atlas-ai-shared";

type Props = {
  token: string;
  user?: SessionUser;
  leadId?: string;
  onApplyTask?: (task: { titulo: string; descricao: string }) => void;
};

export function AtlasAiCrmPanel({ token, user, leadId, onApplyTask }: Props) {
  const access = useAtlasAiAccess(token, user);
  const { loadingKey, error, results, run } = useAiRunner(token);

  if (!leadId) return null;
  if (access !== "ready") return <AtlasAiAccessFallback access={access} />;

  const summary = results.leadSummary?.data;
  const prob = results.probability?.data;
  const task = results.task?.data;
  const insight = results.insight?.data;

  return (
    <AtlasAiShell subtitle="Inteligência comercial do lead">
      <AtlasAiSection
        title="Resumo do lead"
        loading={loadingKey === "leadSummary"}
        loadingLabel="Analisando lead…"
        runLabel="Resumir lead"
        disabled={!!loadingKey}
        onRun={() => void run("leadSummary", () => aiLeadSummary(token, leadId))}
      >
        {summary ? (
          <AtlasAiResultCard>
            <AtlasAiField label="Resumo executivo" value={String(summary.resumoExecutivo ?? summary.summary ?? "")} />
            <AtlasAiField label="Perfil" value={String(summary.perfilLead ?? "")} />
            <AtlasAiField label="Interesse" value={String(summary.interesseIdentificado ?? "")} />
            <AtlasAiField label="Última interação" value={String(summary.ultimaInteracao ?? "")} />
            <AtlasAiField label="Próxima ação" value={String(summary.proximaAcao ?? "")} />
          </AtlasAiResultCard>
        ) : null}
      </AtlasAiSection>

      <AtlasAiSection
        title="Probabilidade de fechamento"
        loading={loadingKey === "probability"}
        loadingLabel="Calculando chance…"
        runLabel="Calcular chance"
        disabled={!!loadingKey}
        onRun={() => void run("probability", () => aiLeadCloseProbability(token, leadId))}
      >
        {prob ? (
          <AtlasAiResultCard>
            <p className="text-lg font-semibold text-violet-700">
              {typeof prob.chancePercent === "number" ? `${prob.chancePercent}%` : "—"}
            </p>
            <AtlasAiField label="Justificativa" value={String(prob.justificativa ?? "")} />
            <AtlasAiList label="Sinais positivos" items={prob.sinaisPositivos as string[]} />
            <AtlasAiList label="Riscos" items={prob.sinaisRisco as string[]} />
            <AtlasAiList label="Para aumentar a chance" items={prob.paraAumentarChance as string[]} />
            <AtlasAiField label="Dados em falta" value={String(prob.dadosIndisponiveis ?? "")} />
          </AtlasAiResultCard>
        ) : null}
      </AtlasAiSection>

      <AtlasAiSection
        title="Próxima tarefa"
        loading={loadingKey === "task"}
        loadingLabel="Sugerindo tarefa…"
        runLabel="Criar sugestão"
        disabled={!!loadingKey}
        onRun={() => void run("task", () => aiLeadNextTask(token, leadId))}
      >
        {task ? (
          <AtlasAiResultCard>
            <AtlasAiField label="Título" value={String(task.titulo ?? "")} />
            <AtlasAiField label="Prazo" value={String(task.prazoSugerido ?? "")} />
            <AtlasAiField label="Descrição" value={String(task.descricao ?? "")} />
            <AtlasAiField label="Canal" value={String(task.canalRecomendado ?? "")} />
            <AtlasAiActionBar
              primaryLabel="Criar tarefa"
              onPrimary={
                onApplyTask && task.titulo
                  ? () =>
                      onApplyTask({
                        titulo: String(task.titulo),
                        descricao: String(task.descricao ?? "")
                      })
                  : undefined
              }
              onCopy={() =>
                void copyAtlasAiText(
                  `${task.titulo}\n${task.prazoSugerido}\n${task.descricao}\n${task.canalRecomendado}`
                )
              }
            />
          </AtlasAiResultCard>
        ) : null}
      </AtlasAiSection>

      <AtlasAiSection
        title="Insight ganho / perda"
        loading={loadingKey === "insight"}
        loadingLabel="Analisando resultado…"
        runLabel="Ver insight"
        disabled={!!loadingKey}
        onRun={() => void run("insight", () => aiLeadWinLossInsight(token, leadId))}
      >
        {insight ? (
          <AtlasAiResultCard>
            {insight.aplicavel === false ? (
              <p className="text-xs text-slate-600">{String(insight.dadosIndisponiveis ?? insight.insight)}</p>
            ) : (
              <>
                <AtlasAiField label="Insight" value={String(insight.insight ?? "")} />
                <AtlasAiList label="Lições" items={insight.licoes as string[]} />
                <AtlasAiField label="Recomendação" value={String(insight.recomendacao ?? "")} />
              </>
            )}
          </AtlasAiResultCard>
        ) : null}
      </AtlasAiSection>

      {error && !loadingKey ? <p className="mx-3 mb-2 text-xs text-rose-600">{error}</p> : null}
    </AtlasAiShell>
  );
}
