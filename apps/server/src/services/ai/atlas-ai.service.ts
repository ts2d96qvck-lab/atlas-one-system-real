import { prisma } from "../../lib/prisma";
import { getDashboard } from "../dashboard.service";
import { getConversation } from "../inbox.service";
import { canViewHiddenMessages } from "../messaging/message-actions.service";
import { categorizeAiError, friendlyAiError } from "./ai-errors";
import { createAiProvider } from "./create-ai-provider";
import { logAiUsage } from "./ai-usage-log.service";
import {
  AI_FEATURES,
  type AtlasAiFeature,
  type CampaignVariationMode,
  type PolishMode,
  type ReplyTone,
  promptAskAtlas,
  promptCampaignCompliance,
  promptCampaignImprove,
  promptCampaignVariations,
  promptConversationSummary,
  promptLeadCloseProbability,
  promptLeadNextTask,
  promptLeadSummary,
  promptLeadWinLossInsight,
  promptMessagePolish,
  promptNextBestAction,
  promptSuggestedReply,
  promptTransferSummary
} from "./prompts";
import type { AiChatMessage } from "./ai.provider";

const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 500;
const MAX_CONTEXT_CHARS = 28_000;

export type AiActor = { id: string; name: string; role: string; tenantId: string };

export type AiRunResult = {
  feature: AtlasAiFeature;
  data: Record<string, unknown>;
  usageLogId: string;
};

function rawObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

export function parseJsonContent(content: string): Record<string, unknown> {
  const trimmed = content.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
      } catch {
        /* fall through */
      }
    }
  }
  return { resposta: trimmed, text: trimmed };
}

function clipContext(text: string) {
  if (text.length <= MAX_CONTEXT_CHARS) return text;
  return `${text.slice(0, MAX_CONTEXT_CHARS)}\n\n[contexto truncado por limite de seguranca]`;
}

function formatMessagesForPrompt(
  messages: { direction: string; type: string; text: string | null; createdAt: Date; raw: unknown }[],
  actor: AiActor
) {
  const showHidden = canViewHiddenMessages(actor);
  const lines: string[] = [];

  for (const msg of messages.slice(-MAX_MESSAGES)) {
    const raw = rawObject(msg.raw);
    if (!showHidden && raw.hiddenAt) continue;
    const label = msg.direction === "inbound" ? "Cliente" : "Atendente";
    const body =
      msg.type === "text"
        ? (msg.text ?? "").trim()
        : msg.type === "audio"
          ? "[audio]"
          : `[${msg.type}]`;
    if (!body) continue;
    const clipped = body.length > MAX_MESSAGE_CHARS ? `${body.slice(0, MAX_MESSAGE_CHARS)}…` : body;
    lines.push(`${label}: ${clipped}`);
  }

  return lines.join("\n");
}

async function runCompletion(
  actor: AiActor,
  feature: AtlasAiFeature,
  prompts: { system: string; user: string },
  entityType?: string | null,
  entityId?: string | null
): Promise<AiRunResult> {
  const provider = createAiProvider();
  const started = Date.now();
  const userContent = clipContext(prompts.user);

  const messages: AiChatMessage[] = [
    { role: "system", content: prompts.system },
    { role: "user", content: userContent }
  ];

  try {
    if (provider.name === "noop") {
      throw new Error("Atlas AI indisponivel. Integracao nao configurada.");
    }
    const result = await provider.complete({ messages, jsonMode: true, temperature: 0.35, maxTokens: 1600 });
    const data = parseJsonContent(result.content);
    const log = await logAiUsage({
      tenantId: actor.tenantId,
      userId: actor.id,
      feature,
      provider: result.provider,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens: result.totalTokens,
      latencyMs: Date.now() - started,
      status: "success",
      entityType,
      entityId
    });

    return { feature, data, usageLogId: log.id };
  } catch (error) {
    const category = categorizeAiError(error);
    await logAiUsage({
      tenantId: actor.tenantId,
      userId: actor.id,
      feature,
      provider: provider.name,
      model: null,
      latencyMs: Date.now() - started,
      status: "error",
      errorCode: category,
      entityType,
      entityId
    });
    throw new Error(friendlyAiError(error));
  }
}

async function loadConversationContext(tenantId: string, conversationId: string, actor: AiActor) {
  const conversation = await getConversation(tenantId, conversationId);
  if (!conversation) throw new Error("Conversa nao encontrada.");

  const transcript = formatMessagesForPrompt(conversation.messages, actor);
  const lead = conversation.lead as { company?: string; status?: string } | null;
  const header = [
    `Cliente: ${conversation.customerName}`,
    `Telefone: ${conversation.customerPhone}`,
    `Status: ${conversation.status}`,
    `Prioridade: ${conversation.priority}`,
    `Atendente: ${conversation.assignedTo?.name ?? "sem atendente"}`,
    lead ? `Lead: ${lead.company ?? ""} · etapa ${lead.status ?? ""}` : null,
    `Tags: ${Array.isArray(conversation.tags) ? (conversation.tags as string[]).join(", ") : ""}`,
    "",
    "Mensagens recentes:",
    transcript || "(sem mensagens visiveis)"
  ]
    .filter(Boolean)
    .join("\n");

  return { conversation, context: header };
}

async function loadLeadContext(tenantId: string, leadId: string, actor: AiActor) {
  const lead = await prisma.lead.findFirst({
    where: { tenantId, id: leadId },
    include: {
      assignedTo: { select: { name: true } },
      conversation: {
        include: {
          messages: { orderBy: { createdAt: "asc" }, take: MAX_MESSAGES }
        }
      }
    }
  });
  if (!lead) throw new Error("Lead nao encontrado.");

  const transcript = lead.conversation ? formatMessagesForPrompt(lead.conversation.messages, actor) : "";

  const context = [
    `Empresa: ${lead.company}`,
    `Contato: ${lead.contact}`,
    `Telefone: ${lead.phone}`,
    `E-mail: ${lead.email ?? ""}`,
    `Etapa: ${lead.status}`,
    `Valor: R$ ${Number(lead.value).toLocaleString("pt-BR")}`,
    `Origem: ${lead.origin}`,
    `Responsavel: ${lead.assignedTo?.name ?? "sem responsavel"}`,
    lead.expectedCloseDate ? `Previsao fechamento: ${lead.expectedCloseDate.toISOString()}` : null,
    lead.closedAt ? `Fechado em: ${lead.closedAt.toISOString()}` : null,
    lead.lostAt ? `Perdido em: ${lead.lostAt.toISOString()}` : null,
    transcript ? `\nConversa vinculada:\n${transcript}` : null
  ]
    .filter(Boolean)
    .join("\n");

  return { lead, context };
}

export async function aiConversationSummary(actor: AiActor, conversationId: string) {
  const { context } = await loadConversationContext(actor.tenantId, conversationId, actor);
  return runCompletion(actor, AI_FEATURES.conversation_summary, promptConversationSummary(context), "conversation", conversationId);
}

export async function aiSuggestedReply(actor: AiActor, conversationId: string, tone: ReplyTone = "amigavel") {
  const { context } = await loadConversationContext(actor.tenantId, conversationId, actor);
  return runCompletion(
    actor,
    AI_FEATURES.suggested_reply,
    promptSuggestedReply(context, tone),
    "conversation",
    conversationId
  );
}

export async function aiNextBestAction(actor: AiActor, conversationId: string) {
  const { context } = await loadConversationContext(actor.tenantId, conversationId, actor);
  return runCompletion(actor, AI_FEATURES.next_best_action, promptNextBestAction(context), "conversation", conversationId);
}

export async function aiTransferSummary(
  actor: AiActor,
  conversationId: string,
  input?: { targetAgentName?: string; transferNote?: string }
) {
  const { context } = await loadConversationContext(actor.tenantId, conversationId, actor);
  const extra = [
    input?.targetAgentName ? `Transferir para: ${input.targetAgentName}` : null,
    input?.transferNote?.trim() ? `Nota do atendente: ${input.transferNote.trim()}` : null
  ]
    .filter(Boolean)
    .join("\n");
  return runCompletion(
    actor,
    AI_FEATURES.transfer_summary,
    promptTransferSummary(extra ? `${context}\n\n${extra}` : context),
    "conversation",
    conversationId
  );
}

export async function aiMessagePolish(
  actor: AiActor,
  conversationId: string,
  input: { draft: string; mode: PolishMode }
) {
  const draft = input.draft?.trim();
  if (!draft) throw new Error("Informe o texto para refinar.");
  const { context } = await loadConversationContext(actor.tenantId, conversationId, actor);
  return runCompletion(
    actor,
    AI_FEATURES.message_polish,
    promptMessagePolish(draft, input.mode, context),
    "conversation",
    conversationId
  );
}

export async function aiLeadSummary(actor: AiActor, leadId: string) {
  const { context } = await loadLeadContext(actor.tenantId, leadId, actor);
  return runCompletion(actor, AI_FEATURES.lead_summary, promptLeadSummary(context), "lead", leadId);
}

export async function aiLeadCloseProbability(actor: AiActor, leadId: string) {
  const { context } = await loadLeadContext(actor.tenantId, leadId, actor);
  return runCompletion(actor, AI_FEATURES.lead_close_probability, promptLeadCloseProbability(context), "lead", leadId);
}

export async function aiLeadNextTask(actor: AiActor, leadId: string) {
  const { context } = await loadLeadContext(actor.tenantId, leadId, actor);
  return runCompletion(actor, AI_FEATURES.lead_next_task, promptLeadNextTask(context), "lead", leadId);
}

export async function aiLeadWinLossInsight(actor: AiActor, leadId: string) {
  const { lead, context } = await loadLeadContext(actor.tenantId, leadId, actor);
  const status = lead.status.toLowerCase();
  const isFinal =
    status.includes("fechado") ||
    status.includes("perdido") ||
    status.includes("ganho") ||
    status.includes("lost") ||
    !!lead.closedAt ||
    !!lead.lostAt;
  if (!isFinal && !status.includes("negoci")) {
    return {
      feature: AI_FEATURES.lead_win_loss_insight,
      data: {
        aplicavel: false,
        insight: "Este lead ainda não está em etapa final.",
        dadosIndisponiveis: "Insight de ganho/perda disponível quando o lead estiver fechado, perdido ou em negociação avançada.",
        recomendacao: "Use probabilidade de fechamento ou resumo do lead por enquanto."
      },
      usageLogId: ""
    };
  }
  return runCompletion(actor, AI_FEATURES.lead_win_loss_insight, promptLeadWinLossInsight(context), "lead", leadId);
}

export async function aiCampaignImproveMessage(
  actor: AiActor,
  input: { message: string; messageKind?: string; templateName?: string; campaignName?: string }
) {
  const message = input.message?.trim();
  if (!message) throw new Error("Informe a mensagem da campanha.");

  const context = [
    input.campaignName ? `Campanha: ${input.campaignName}` : null,
    input.messageKind ? `Tipo: ${input.messageKind}` : null,
    input.templateName ? `Template: ${input.templateName}` : null,
    "",
    "Mensagem atual:",
    message
  ]
    .filter(Boolean)
    .join("\n");

  return runCompletion(actor, AI_FEATURES.campaign_improve, promptCampaignImprove(context), "campaign", null);
}

export async function aiCampaignVariations(actor: AiActor, input: { message: string; mode: CampaignVariationMode }) {
  const message = input.message?.trim();
  if (!message) throw new Error("Informe a mensagem da campanha.");
  return runCompletion(
    actor,
    AI_FEATURES.campaign_variations,
    promptCampaignVariations(message, input.mode),
    "campaign",
    null
  );
}

export async function aiCampaignCompliance(actor: AiActor, input: { message: string }) {
  const message = input.message?.trim();
  if (!message) throw new Error("Informe a mensagem da campanha.");
  return runCompletion(actor, AI_FEATURES.campaign_compliance, promptCampaignCompliance(message), "campaign", null);
}

export async function aiAskAtlas(actor: AiActor, question: string) {
  const q = question?.trim();
  if (!q) throw new Error("Informe sua pergunta.");

  let dashboardContext = "";
  try {
    const dash = await getDashboard(actor.tenantId, { userId: actor.id, role: actor.role });
    dashboardContext = JSON.stringify(
      {
        metrics: dash.metrics,
        pipeline: dash.pipeline,
        sla: {
          openOverSlaCount: dash.sla?.openOverSlaCount,
          firstResponseWithinSlaPercent: dash.sla?.firstResponseWithinSlaPercent,
          resolutionWithinSlaPercent: dash.sla?.resolutionWithinSlaPercent,
          avgFirstResponseMinutes: dash.sla?.avgFirstResponseMinutes
        },
        teamPerformance: (dash.teamPerformance ?? []).slice(0, 8),
        instances: (dash.instances ?? []).map((i: { label?: string; status?: string }) => ({
          label: i.label,
          status: i.status
        }))
      },
      null,
      0
    );
  } catch {
    dashboardContext = '{"aviso":"metricas do painel indisponiveis neste momento"}';
  }

  const openCount = await prisma.conversation.count({
    where: { tenantId: actor.tenantId, status: "open" }
  });

  const context = [
    `Conversas abertas agora: ${openCount}`,
    `Papel do usuario: ${actor.role}`,
    `Dados do painel (JSON):`,
    dashboardContext
  ].join("\n");

  return runCompletion(actor, AI_FEATURES.ask_atlas, promptAskAtlas(q, context), "tenant", actor.tenantId);
}

export function getAiProviderStatus() {
  const provider = createAiProvider();
  return {
    configured: provider.name !== "noop",
    version: "1.1",
    ready: provider.name !== "noop"
  };
}

export function toPublicAiResponse(result: AiRunResult) {
  return {
    feature: result.feature,
    data: result.data,
    usageLogId: result.usageLogId || undefined
  };
}
