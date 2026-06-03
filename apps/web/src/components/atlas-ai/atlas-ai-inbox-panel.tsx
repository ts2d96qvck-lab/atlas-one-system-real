"use client";

import { useEffect, useState } from "react";
import {
  aiConversationSummary,
  aiMessagePolish,
  aiNextBestAction,
  aiSuggestedReply,
  aiTransferSummary,
  copyAtlasAiText,
  POLISH_MODE_LABELS,
  type PolishMode,
  type ReplyTone,
  REPLY_TONE_LABELS
} from "../../lib/atlas-ai";
import {
  AtlasAiActionBar,
  AtlasAiConfigureEmpty,
  AtlasAiField,
  AtlasAiList,
  AtlasAiPriority,
  AtlasAiPills,
  AtlasAiResultCard,
  AtlasAiSection,
  AtlasAiShell,
  useAiRunner,
  useAtlasAiReady
} from "./atlas-ai-shared";

const TONES = ["formal", "comercial", "executivo", "suporte", "amigavel", "cobranca"] as const;
const POLISH = ["corrigir", "profissional", "encurtar", "consultivo", "humano", "cobranca_educada"] as const;

type Props = {
  token: string;
  conversationId?: string;
  composerDraft?: string;
  transferNote?: string;
  targetAgentName?: string;
  onApplyReply?: (text: string) => void;
  onApplyPolish?: (text: string) => void;
  onApplyTransferSummary?: (text: string) => void;
};

export function AtlasAiInboxPanel({
  token,
  conversationId,
  composerDraft = "",
  transferNote,
  targetAgentName,
  onApplyReply,
  onApplyPolish,
  onApplyTransferSummary
}: Props) {
  const configured = useAtlasAiReady(token);
  const { loadingKey, error, results, run } = useAiRunner(token);
  const [tone, setTone] = useState<ReplyTone>("comercial");
  const [polishMode, setPolishMode] = useState<PolishMode>("profissional");
  const [polishDraft, setPolishDraft] = useState(composerDraft);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPolishDraft(composerDraft);
  }, [composerDraft]);

  if (!conversationId) {
    return (
      <AtlasAiShell subtitle="Selecione uma conversa">
        <p className="px-3 pb-3 text-xs text-slate-500">Abra uma conversa para usar o assistente.</p>
      </AtlasAiShell>
    );
  }

  if (configured === false) return <AtlasAiShell><AtlasAiConfigureEmpty /></AtlasAiShell>;
  if (configured === null) {
    return (
      <AtlasAiShell>
        <p className="px-3 pb-3 text-xs text-slate-500">Verificando Atlas AI…</p>
      </AtlasAiShell>
    );
  }

  const summary = results.summary?.data;
  const reply = results.reply?.data;
  const action = results.action?.data;
  const transfer = results.transfer?.data;
  const polish = results.polish?.data;

  const replyText = typeof reply?.reply === "string" ? reply.reply : "";
  const handoffText =
    typeof transfer?.textoHandoff === "string"
      ? transfer.textoHandoff
      : typeof transfer?.contexto === "string"
        ? transfer.contexto
        : "";

  return (
    <AtlasAiShell subtitle="Atendimento mais rápido e assertivo">
      <div className="space-y-0 pb-2">
        <AtlasAiSection
          title="Resumo da conversa"
          description="Entenda o contexto em segundos"
          loading={loadingKey === "summary"}
          loadingLabel="Analisando conversa…"
          error={loadingKey === "summary" ? undefined : error}
          runLabel="Gerar resumo"
          disabled={!!loadingKey}
          onRun={() => void run("summary", () => aiConversationSummary(token, conversationId))}
        >
          {summary ? (
            <AtlasAiResultCard>
              <AtlasAiField label="Resumo" value={String(summary.resumo ?? summary.summary ?? "")} />
              <AtlasAiField label="Intenção do cliente" value={String(summary.intencaoCliente ?? "")} />
              <AtlasAiList label="Pontos importantes" items={(summary.pontosImportantes as string[]) ?? (summary.bullets as string[])} />
              <AtlasAiList label="Riscos" items={summary.riscos as string[]} />
              <AtlasAiField label="Próxima ação" value={String(summary.proximaAcaoRecomendada ?? "")} />
            </AtlasAiResultCard>
          ) : null}
        </AtlasAiSection>

        <AtlasAiSection
          title="Resposta sugerida"
          description="Tom ajustado ao seu estilo"
          loading={loadingKey === "reply"}
          loadingLabel="Gerando sugestão…"
          runLabel="Gerar resposta"
          disabled={!!loadingKey}
          onRun={() => void run("reply", () => aiSuggestedReply(token, conversationId, tone))}
        >
          <AtlasAiPills options={TONES} labels={REPLY_TONE_LABELS} value={tone} onChange={setTone} />
          {reply ? (
            <AtlasAiResultCard>
              <AtlasAiField label="Sugestão" value={replyText} />
              {typeof reply.dicaUso === "string" ? <p className="text-[11px] text-slate-500">{reply.dicaUso}</p> : null}
              <AtlasAiActionBar
                primaryLabel="Usar resposta"
                onPrimary={onApplyReply && replyText ? () => onApplyReply(replyText) : undefined}
                onCopy={() =>
                  void copyAtlasAiText(replyText).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  })
                }
                onRegenerate={() => void run("reply", () => aiSuggestedReply(token, conversationId, tone))}
                copied={copied}
              />
            </AtlasAiResultCard>
          ) : null}
        </AtlasAiSection>

        <AtlasAiSection
          title="Próxima melhor ação"
          loading={loadingKey === "action"}
          loadingLabel="Priorizando ação…"
          runLabel="Sugerir ação"
          disabled={!!loadingKey}
          onRun={() => void run("action", () => aiNextBestAction(token, conversationId))}
        >
          {action ? (
            <AtlasAiResultCard>
              <AtlasAiPriority value={String(action.prioridade ?? action.priority ?? "")} />
              <AtlasAiField label="Motivo" value={String(action.motivo ?? action.rationale ?? "")} />
              <AtlasAiField label="Ação recomendada" value={String(action.acaoRecomendada ?? action.action ?? "")} />
              <AtlasAiField label="Prazo sugerido" value={String(action.prazoSugerido ?? "")} />
              <AtlasAiField label="Responsável sugerido" value={String(action.responsavelSugerido ?? "")} />
            </AtlasAiResultCard>
          ) : null}
        </AtlasAiSection>

        <AtlasAiSection
          title="Resumo de transferência"
          description="Handoff claro para o time"
          loading={loadingKey === "transfer"}
          loadingLabel="Montando handoff…"
          runLabel="Gerar handoff"
          disabled={!!loadingKey}
          onRun={() =>
            void run("transfer", () =>
              aiTransferSummary(token, conversationId, { targetAgentName, transferNote })
            )
          }
        >
          {transfer ? (
            <AtlasAiResultCard>
              <AtlasAiField label="Contexto" value={String(transfer.contexto ?? transfer.summary ?? "")} />
              <AtlasAiList label="Já tratado" items={transfer.tratado as string[]} />
              <AtlasAiList label="Pendências" items={(transfer.pendencias as string[]) ?? (transfer.openItems as string[])} />
              <AtlasAiList label="Cuidados" items={transfer.cuidados as string[]} />
              <AtlasAiField label="Próxima ação" value={String(transfer.proximaAcao ?? "")} />
              <AtlasAiActionBar
                primaryLabel="Colar na nota"
                onPrimary={
                  onApplyTransferSummary && handoffText ? () => onApplyTransferSummary(handoffText) : undefined
                }
                onCopy={() => void copyAtlasAiText(handoffText)}
              />
            </AtlasAiResultCard>
          ) : null}
        </AtlasAiSection>

        <AtlasAiSection
          title="Refinar mensagem"
          description="Melhore o rascunho antes de enviar"
          loading={loadingKey === "polish"}
          loadingLabel="Refinando texto…"
          runLabel="Refinar"
          disabled={!!loadingKey || !polishDraft.trim()}
          onRun={() =>
            void run("polish", () =>
              aiMessagePolish(token, conversationId, { draft: polishDraft, mode: polishMode })
            )
          }
        >
          <AtlasAiPills options={POLISH} labels={POLISH_MODE_LABELS} value={polishMode} onChange={setPolishMode} />
          <textarea
            className="atlas-field mt-2 min-h-[72px] w-full rounded-lg px-3 py-2 text-xs outline-none"
            value={polishDraft}
            onChange={(e) => setPolishDraft(e.target.value)}
            placeholder="Cole ou edite a mensagem do composer"
          />
          {polish ? (
            <AtlasAiResultCard>
              <AtlasAiField label="Mensagem refinada" value={String(polish.mensagem ?? "")} />
              <AtlasAiField label="O que mudou" value={String(polish.oQueMudou ?? "")} />
              <AtlasAiActionBar
                primaryLabel="Usar no composer"
                onPrimary={
                  onApplyPolish && typeof polish.mensagem === "string"
                    ? () => onApplyPolish(String(polish.mensagem))
                    : undefined
                }
                onCopy={() => void copyAtlasAiText(String(polish.mensagem ?? ""))}
              />
            </AtlasAiResultCard>
          ) : null}
        </AtlasAiSection>
      </div>
    </AtlasAiShell>
  );
}
