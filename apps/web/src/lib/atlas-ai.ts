import { apiUrl } from "./config";

export type AtlasAiFeature =
  | "conversation_summary"
  | "suggested_reply"
  | "next_best_action"
  | "transfer_summary"
  | "message_polish"
  | "lead_summary"
  | "lead_close_probability"
  | "lead_next_task"
  | "lead_win_loss_insight"
  | "campaign_improve"
  | "campaign_variations"
  | "campaign_compliance"
  | "ask_atlas";

export type ReplyTone = "formal" | "comercial" | "executivo" | "suporte" | "amigavel" | "cobranca";
export type PolishMode = "corrigir" | "profissional" | "encurtar" | "consultivo" | "humano" | "cobranca_educada";
export type CampaignVariationMode =
  | "formal"
  | "comercial"
  | "executivo"
  | "cobranca"
  | "curta"
  | "whatsapp_natural";

export type AtlasAiResponse = {
  feature: AtlasAiFeature;
  data: Record<string, unknown>;
  usageLogId?: string;
};

export type AtlasAiStatus = {
  configured: boolean;
  ready?: boolean;
  version?: string;
  canUse?: boolean;
};

const FRIENDLY_FALLBACK = "Não consegui gerar agora. Tente novamente em instantes.";

async function aiRequest<T>(token: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${apiUrl()}/ai${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (payload as { message?: string; error?: string })?.message ??
      (payload as { error?: string })?.error ??
      FRIENDLY_FALLBACK;
    throw new Error(typeof message === "string" ? message : FRIENDLY_FALLBACK);
  }
  return payload as T;
}

export async function getAtlasAiStatus(token: string): Promise<AtlasAiStatus> {
  const response = await fetch(`${apiUrl()}/ai/status`, {
    headers: { authorization: `Bearer ${token}` }
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  if (!response.ok) {
    const message =
      (payload as { message?: string; error?: string })?.message ??
      (payload as { error?: string })?.error ??
      "Não foi possível verificar o Atlas AI agora.";
    throw new Error(typeof message === "string" ? message : "Não foi possível verificar o Atlas AI agora.");
  }
  return payload as AtlasAiStatus;
}

export function aiConversationSummary(token: string, conversationId: string) {
  return aiRequest<AtlasAiResponse>(token, `/conversations/${conversationId}/summary`);
}

export function aiSuggestedReply(token: string, conversationId: string, tone: ReplyTone = "amigavel") {
  return aiRequest<AtlasAiResponse>(token, `/conversations/${conversationId}/suggested-reply`, { tone });
}

export function aiNextBestAction(token: string, conversationId: string) {
  return aiRequest<AtlasAiResponse>(token, `/conversations/${conversationId}/next-action`);
}

export function aiTransferSummary(
  token: string,
  conversationId: string,
  body?: { targetAgentName?: string; transferNote?: string }
) {
  return aiRequest<AtlasAiResponse>(token, `/conversations/${conversationId}/transfer-summary`, body ?? {});
}

export function aiMessagePolish(token: string, conversationId: string, body: { draft: string; mode: PolishMode }) {
  return aiRequest<AtlasAiResponse>(token, `/conversations/${conversationId}/message-polish`, body);
}

export function aiLeadSummary(token: string, leadId: string) {
  return aiRequest<AtlasAiResponse>(token, `/leads/${leadId}/summary`);
}

export function aiLeadCloseProbability(token: string, leadId: string) {
  return aiRequest<AtlasAiResponse>(token, `/leads/${leadId}/close-probability`);
}

export function aiLeadNextTask(token: string, leadId: string) {
  return aiRequest<AtlasAiResponse>(token, `/leads/${leadId}/next-task`);
}

export function aiLeadWinLossInsight(token: string, leadId: string) {
  return aiRequest<AtlasAiResponse>(token, `/leads/${leadId}/win-loss-insight`);
}

export function aiCampaignImproveMessage(
  token: string,
  body: { message: string; messageKind?: string; templateName?: string; campaignName?: string }
) {
  return aiRequest<AtlasAiResponse>(token, "/campaigns/improve-message", body);
}

export function aiCampaignVariations(token: string, body: { message: string; mode: CampaignVariationMode }) {
  return aiRequest<AtlasAiResponse>(token, "/campaigns/variations", body);
}

export function aiCampaignCompliance(token: string, body: { message: string }) {
  return aiRequest<AtlasAiResponse>(token, "/campaigns/compliance-check", body);
}

export function aiAskAtlas(token: string, question: string) {
  return aiRequest<AtlasAiResponse>(token, "/ask", { question });
}

export const REPLY_TONE_LABELS: Record<ReplyTone, string> = {
  formal: "Formal",
  comercial: "Comercial",
  executivo: "Executivo",
  suporte: "Suporte",
  amigavel: "Amigável",
  cobranca: "Cobrança"
};

export const POLISH_MODE_LABELS: Record<PolishMode, string> = {
  corrigir: "Corrigir português",
  profissional: "Mais profissional",
  encurtar: "Encurtar",
  consultivo: "Mais consultivo",
  humano: "Mais humano",
  cobranca_educada: "Cobrança educada"
};

export const CAMPAIGN_MODE_LABELS: Record<CampaignVariationMode, string> = {
  formal: "Formal",
  comercial: "Comercial",
  executivo: "Executivo",
  cobranca: "Cobrança",
  curta: "Curta",
  whatsapp_natural: "WhatsApp natural"
};

export const ASK_ATLAS_PROMPTS = [
  "Por que meu SLA piorou hoje?",
  "Quais conversas precisam de atenção agora?",
  "Qual agente está com maior volume?",
  "Quais leads estão em risco?",
  "O que eu deveria priorizar hoje?"
] as const;

export async function copyAtlasAiText(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error("Não foi possível copiar neste navegador.");
}
