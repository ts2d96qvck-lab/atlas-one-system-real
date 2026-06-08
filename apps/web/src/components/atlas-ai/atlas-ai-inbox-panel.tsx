"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRightLeft,
  FileText,
  Loader2,
  MessageSquare,
  Sparkles,
  Target,
  Wand2,
  type LucideIcon
} from "lucide-react";
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
  AtlasAiPermissionEmpty,
  AtlasAiExecutiveField,
  AtlasAiExecutiveList,
  AtlasAiExecutiveQuote,
  AtlasAiHero,
  AtlasAiHubActionCard,
  AtlasAiHubLoading,
  AtlasAiHubWorkspace,
  AtlasAiPills,
  AtlasAiPriorityBadge,
  useAiRunner,
  useAtlasAiAccess,
  type AtlasAiAccessState
} from "./atlas-ai-shared";
import type { SessionUser } from "../../lib/api";

const TONES = ["formal", "comercial", "executivo", "suporte", "amigavel", "cobranca"] as const;
const POLISH = ["corrigir", "profissional", "encurtar", "consultivo", "humano", "cobranca_educada"] as const;

type InboxFeature = "summary" | "reply" | "action" | "transfer" | "polish";

type ActionDef = {
  id: InboxFeature;
  title: string;
  benefit: string;
  cta: string;
  loadingLabel: string;
  icon: LucideIcon;
};

const INBOX_ACTIONS: ActionDef[] = [
  {
    id: "summary",
    title: "Resumir conversa",
    benefit: "Contexto, intenção e riscos em segundos",
    cta: "Resumir",
    loadingLabel: "Analisando conversa…",
    icon: FileText
  },
  {
    id: "reply",
    title: "Sugerir resposta",
    benefit: "Resposta pronta no tom certo para o cliente",
    cta: "Sugerir",
    loadingLabel: "Gerando sugestão…",
    icon: MessageSquare
  },
  {
    id: "action",
    title: "Próxima ação",
    benefit: "Prioridade clara do que fazer agora",
    cta: "Priorizar",
    loadingLabel: "Priorizando ação…",
    icon: Target
  },
  {
    id: "transfer",
    title: "Transferência inteligente",
    benefit: "Handoff completo para o próximo atendente",
    cta: "Preparar",
    loadingLabel: "Montando handoff…",
    icon: ArrowRightLeft
  },
  {
    id: "polish",
    title: "Melhorar mensagem",
    benefit: "Refine o rascunho antes de enviar",
    cta: "Refinar",
    loadingLabel: "Refinando texto…",
    icon: Wand2
  }
];

type Props = {
  token: string;
  user?: SessionUser;
  conversationId?: string;
  composerDraft?: string;
  transferNote?: string;
  targetAgentName?: string;
  onApplyReply?: (text: string) => void;
  onApplyPolish?: (text: string) => void;
  onApplyTransferSummary?: (text: string) => void;
};

function renderAccessGate(access: AtlasAiAccessState, children: ReactNode) {
  if (access === "loading") {
    return (
      <div className="atlas-ai-inbox-root">
        <AtlasAiHero />
        <AtlasAiHubLoading label="Verificando Atlas AI…" />
      </div>
    );
  }
  if (access === "denied") {
    return (
      <div className="atlas-ai-inbox-root">
        <AtlasAiHero />
        <AtlasAiPermissionEmpty />
      </div>
    );
  }
  if (access === "unconfigured") {
    return (
      <div className="atlas-ai-inbox-root">
        <AtlasAiHero />
        <AtlasAiConfigureEmpty />
      </div>
    );
  }
  if (access === "error") {
    return (
      <div className="atlas-ai-inbox-root">
        <AtlasAiHero />
        <div className="atlas-ai-empty atlas-ai-empty-premium">
          <p className="text-sm font-semibold text-slate-800">Não foi possível verificar agora</p>
          <p className="mt-1.5 text-xs text-slate-500">Tente novamente em instantes ou recarregue a página.</p>
        </div>
      </div>
    );
  }
  return children;
}

export function AtlasAiInboxPanel({
  token,
  user,
  conversationId,
  composerDraft = "",
  transferNote,
  targetAgentName,
  onApplyReply,
  onApplyPolish,
  onApplyTransferSummary
}: Props) {
  const access = useAtlasAiAccess(token, user);
  const { loadingKey, error, results, run } = useAiRunner(token);
  const [active, setActive] = useState<InboxFeature | null>(null);
  const [tone, setTone] = useState<ReplyTone>("comercial");
  const [polishMode, setPolishMode] = useState<PolishMode>("profissional");
  const [polishDraft, setPolishDraft] = useState(composerDraft);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPolishDraft(composerDraft);
  }, [composerDraft]);

  if (access !== "ready") {
    return renderAccessGate(access, null);
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

  function openFeature(id: InboxFeature) {
    setActive((prev) => (prev === id ? null : id));
  }

  async function runFeature(id: InboxFeature) {
    if (!conversationId) return;
    setActive(id);
    if (id === "summary") await run("summary", () => aiConversationSummary(token, conversationId));
    if (id === "reply") await run("reply", () => aiSuggestedReply(token, conversationId, tone));
    if (id === "action") await run("action", () => aiNextBestAction(token, conversationId));
    if (id === "transfer") {
      await run("transfer", () =>
        aiTransferSummary(token, conversationId, { targetAgentName, transferNote })
      );
    }
    if (id === "polish" && polishDraft.trim()) {
      await run("polish", () =>
        aiMessagePolish(token, conversationId, { draft: polishDraft, mode: polishMode })
      );
    }
  }

  const activeDef = INBOX_ACTIONS.find((item) => item.id === active);

  return (
    <div className="atlas-ai-inbox-root">
      <AtlasAiHero />

      {!conversationId ? (
        <div className="atlas-ai-inbox-idle mx-3 mb-2 rounded-xl border border-violet-200/50 bg-violet-50/40 px-3 py-2 text-center">
          <Sparkles size={16} className="mx-auto text-violet-500" />
          <p className="mt-1 text-xs font-medium text-slate-700">Selecione uma conversa para executar as ações</p>
        </div>
      ) : null}

      <div className="atlas-ai-action-hub">
        {INBOX_ACTIONS.map((item) => (
          <AtlasAiHubActionCard
            key={item.id}
            icon={item.icon}
            title={item.title}
            benefit={item.benefit}
            cta={item.cta}
            active={active === item.id}
            loading={loadingKey === item.id}
            ready={!!results[item.id]}
            disabled={
              !conversationId ||
              !!loadingKey ||
              (item.id === "polish" && !polishDraft.trim())
            }
            onSelect={() => openFeature(item.id)}
            onRun={() => void runFeature(item.id)}
          />
        ))}
      </div>

      {active && activeDef ? (
        <AtlasAiHubWorkspace
          title={activeDef.title}
          onClose={() => setActive(null)}
          error={loadingKey === active ? undefined : error}
        >
          {loadingKey === active ? (
            <AtlasAiHubLoading label={activeDef.loadingLabel} />
          ) : (
            <>
              {active === "reply" ? (
                <div className="atlas-ai-workspace-controls">
                  <p className="atlas-ai-workspace-label">Tom da resposta</p>
                  <AtlasAiPills options={TONES} labels={REPLY_TONE_LABELS} value={tone} onChange={setTone} />
                </div>
              ) : null}

              {active === "polish" ? (
                <div className="atlas-ai-workspace-controls">
                  <p className="atlas-ai-workspace-label">Modo de refinamento</p>
                  <AtlasAiPills options={POLISH} labels={POLISH_MODE_LABELS} value={polishMode} onChange={setPolishMode} />
                  <textarea
                    className="atlas-ai-polish-input"
                    value={polishDraft}
                    onChange={(e) => setPolishDraft(e.target.value)}
                    placeholder="Cole ou edite a mensagem do composer"
                  />
                </div>
              ) : null}

              {active === "summary" && summary ? (
                <div className="atlas-ai-executive-stack">
                  <AtlasAiExecutiveField label="Resumo" value={String(summary.resumo ?? summary.summary ?? "")} highlight />
                  <AtlasAiExecutiveField label="Intenção do cliente" value={String(summary.intencaoCliente ?? "")} />
                  <AtlasAiExecutiveList label="Pontos importantes" items={(summary.pontosImportantes as string[]) ?? (summary.bullets as string[])} />
                  <AtlasAiExecutiveList label="Riscos" items={summary.riscos as string[]} variant="risk" />
                  <AtlasAiExecutiveField label="Próxima ação recomendada" value={String(summary.proximaAcaoRecomendada ?? "")} />
                </div>
              ) : null}

              {active === "reply" && reply ? (
                <div className="atlas-ai-executive-stack">
                  <AtlasAiExecutiveQuote text={replyText} />
                  {typeof reply.dicaUso === "string" ? (
                    <p className="atlas-ai-tip">{reply.dicaUso}</p>
                  ) : null}
                  <div className="atlas-ai-action-row">
                    <AtlasAiActionBar
                      primaryLabel="Usar resposta"
                      onPrimary={onApplyReply && replyText ? () => onApplyReply(replyText) : undefined}
                      onCopy={() =>
                        void copyAtlasAiText(replyText).then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        })
                      }
                      onRegenerate={() => void runFeature("reply")}
                      regenerateLabel="Gerar novamente"
                      copied={copied}
                    />
                  </div>
                </div>
              ) : null}

              {active === "action" && action ? (
                <div className="atlas-ai-executive-stack">
                  <AtlasAiPriorityBadge value={String(action.prioridade ?? action.priority ?? "")} />
                  <AtlasAiExecutiveField label="Motivo" value={String(action.motivo ?? action.rationale ?? "")} />
                  <AtlasAiExecutiveField label="Ação recomendada" value={String(action.acaoRecomendada ?? action.action ?? "")} highlight />
                  <AtlasAiExecutiveField label="Prazo sugerido" value={String(action.prazoSugerido ?? "")} />
                  <AtlasAiExecutiveField label="Responsável sugerido" value={String(action.responsavelSugerido ?? "")} />
                </div>
              ) : null}

              {active === "transfer" && transfer ? (
                <div className="atlas-ai-executive-stack">
                  <AtlasAiExecutiveField label="Contexto para o próximo atendente" value={String(transfer.contexto ?? transfer.summary ?? "")} highlight />
                  <AtlasAiExecutiveList label="O que já foi tratado" items={transfer.tratado as string[]} />
                  <AtlasAiExecutiveList label="Pendências" items={(transfer.pendencias as string[]) ?? (transfer.openItems as string[])} />
                  <AtlasAiExecutiveList label="Cuidados" items={transfer.cuidados as string[]} variant="risk" />
                  <AtlasAiExecutiveField label="Próxima ação" value={String(transfer.proximaAcao ?? "")} />
                  <div className="atlas-ai-action-row">
                    <AtlasAiActionBar
                      primaryLabel="Colar na nota"
                      onPrimary={
                        onApplyTransferSummary && handoffText ? () => onApplyTransferSummary(handoffText) : undefined
                      }
                      onCopy={() => void copyAtlasAiText(handoffText)}
                      onRegenerate={() => void runFeature("transfer")}
                      regenerateLabel="Gerar novamente"
                    />
                  </div>
                </div>
              ) : null}

              {active === "polish" && polish ? (
                <div className="atlas-ai-executive-stack">
                  <AtlasAiExecutiveQuote text={String(polish.mensagem ?? "")} label="Mensagem refinada" />
                  <AtlasAiExecutiveField label="O que mudou" value={String(polish.oQueMudou ?? "")} />
                  <div className="atlas-ai-action-row">
                    <AtlasAiActionBar
                      primaryLabel="Usar resposta"
                      onPrimary={
                        onApplyPolish && typeof polish.mensagem === "string"
                          ? () => onApplyPolish(String(polish.mensagem))
                          : undefined
                      }
                      onCopy={() => void copyAtlasAiText(String(polish.mensagem ?? ""))}
                      onRegenerate={() => void runFeature("polish")}
                      regenerateLabel="Gerar novamente"
                    />
                  </div>
                </div>
              ) : null}

              {!results[active] && loadingKey !== active ? (
                <div className="atlas-ai-workspace-hint">
                  <p>Toque em <strong>{activeDef.cta}</strong> no card acima para gerar o resultado.</p>
                  {active === "polish" && !polishDraft.trim() ? (
                    <p className="text-amber-700">Escreva ou cole uma mensagem no composer para refinar.</p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </AtlasAiHubWorkspace>
      ) : null}

      {loadingKey && !active ? (
        <div className="atlas-ai-inbox-busy">
          <Loader2 size={14} className="animate-spin text-violet-600" />
          <span>Processando…</span>
        </div>
      ) : null}
    </div>
  );
}
