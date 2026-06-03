/** Atlas AI — centralized prompts (PT-BR), structured JSON only. */

export const AI_SYSTEM_BASE = `Voce e o Atlas AI, assistente comercial nativo do Atlas One (WhatsApp, CRM e campanhas).
Responda em portugues do Brasil, tom profissional e humano — como um gestor experiente, nao como um chatbot generico.
Use apenas fatos do contexto. Se faltar dado, diga o que falta no campo adequado (ex.: dadosIndisponiveis).
Retorne SOMENTE JSON valido, sem markdown nem texto fora do JSON.
Seja conciso. Evite cliches ("espero que esteja bem"), juridiques e promessas irreais.`;

export const AI_FEATURES = {
  conversation_summary: "conversation_summary",
  suggested_reply: "suggested_reply",
  next_best_action: "next_best_action",
  transfer_summary: "transfer_summary",
  message_polish: "message_polish",
  lead_summary: "lead_summary",
  lead_close_probability: "lead_close_probability",
  lead_next_task: "lead_next_task",
  lead_win_loss_insight: "lead_win_loss_insight",
  campaign_improve: "campaign_improve",
  campaign_variations: "campaign_variations",
  campaign_compliance: "campaign_compliance",
  ask_atlas: "ask_atlas"
} as const;

export type AtlasAiFeature = (typeof AI_FEATURES)[keyof typeof AI_FEATURES];

export const REPLY_TONES = ["formal", "comercial", "executivo", "suporte", "amigavel", "cobranca"] as const;
export type ReplyTone = (typeof REPLY_TONES)[number];

export const POLISH_MODES = [
  "corrigir",
  "profissional",
  "encurtar",
  "consultivo",
  "humano",
  "cobranca_educada"
] as const;
export type PolishMode = (typeof POLISH_MODES)[number];

export const CAMPAIGN_VARIATION_MODES = [
  "formal",
  "comercial",
  "executivo",
  "cobranca",
  "curta",
  "whatsapp_natural"
] as const;
export type CampaignVariationMode = (typeof CAMPAIGN_VARIATION_MODES)[number];

export function promptConversationSummary(context: string) {
  return {
    system: `${AI_SYSTEM_BASE}\nTarefa: resumo executivo da conversa para o atendente.`,
    user: `${context}\n\nJSON: {"resumo":"string","intencaoCliente":"string","pontosImportantes":["string"],"riscos":["string"],"proximaAcaoRecomendada":"string"}`
  };
}

export function promptSuggestedReply(context: string, tone: string) {
  return {
    system: `${AI_SYSTEM_BASE}\nTarefa: sugerir resposta WhatsApp no tom "${tone}". Maximo 4 frases curtas.`,
    user: `${context}\n\nTom desejado: ${tone}\n\nJSON: {"reply":"string","tomAplicado":"string","dicaUso":"string"}`
  };
}

export function promptNextBestAction(context: string) {
  return {
    system: `${AI_SYSTEM_BASE}\nTarefa: proxima melhor acao operacional/comercial.`,
    user: `${context}\n\nJSON: {"prioridade":"baixa|media|alta","motivo":"string","acaoRecomendada":"string","prazoSugerido":"string","responsavelSugerido":"string ou vazio"}`
  };
}

export function promptTransferSummary(context: string) {
  return {
    system: `${AI_SYSTEM_BASE}\nTarefa: handoff para outro atendente.`,
    user: `${context}\n\nJSON: {"contexto":"string","tratado":["string"],"pendencias":["string"],"cuidados":["string"],"proximaAcao":"string","textoHandoff":"string (paragrafo unico pronto para colar)"}`
  };
}

export function promptMessagePolish(draft: string, mode: string, context?: string) {
  return {
    system: `${AI_SYSTEM_BASE}\nTarefa: refinar rascunho de mensagem. Modo: ${mode}.`,
    user: `Rascunho:\n${draft}\n\n${context ? `Contexto conversa:\n${context}\n\n` : ""}JSON: {"mensagem":"string","oQueMudou":"string"}`
  };
}

export function promptLeadSummary(context: string) {
  return {
    system: `${AI_SYSTEM_BASE}\nTarefa: resumo executivo do lead.`,
    user: `${context}\n\nJSON: {"resumoExecutivo":"string","perfilLead":"string","interesseIdentificado":"string","ultimaInteracao":"string","proximaAcao":"string"}`
  };
}

export function promptLeadCloseProbability(context: string) {
  return {
    system: `${AI_SYSTEM_BASE}\nTarefa: estimar probabilidade de fechamento com base em sinais do contexto (nao invente numeros externos).`,
    user: `${context}\n\nJSON: {"chancePercent":0,"justificativa":"string","sinaisPositivos":["string"],"sinaisRisco":["string"],"paraAumentarChance":["string"],"dadosIndisponiveis":"string ou vazio"}`
  };
}

export function promptLeadNextTask(context: string) {
  return {
    system: `${AI_SYSTEM_BASE}\nTarefa: sugerir proxima tarefa comercial.`,
    user: `${context}\n\nJSON: {"titulo":"string","prazoSugerido":"string","descricao":"string","canalRecomendado":"WhatsApp|ligacao|email|reuniao"}`
  };
}

export function promptLeadWinLossInsight(context: string) {
  return {
    system: `${AI_SYSTEM_BASE}\nTarefa: insight de ganho/perda ou etapa final. Se dados insuficientes, seja explicito.`,
    user: `${context}\n\nJSON: {"aplicavel":true,"insight":"string","licoes":["string"],"recomendacao":"string","dadosIndisponiveis":"string ou vazio"}`
  };
}

export function promptCampaignImprove(context: string) {
  return {
    system: `${AI_SYSTEM_BASE}\nTarefa: melhorar mensagem de campanha. Preserve {{variaveis}} intactas.`,
    user: `${context}\n\nJSON: {"mensagemMelhorada":"string","porQueMelhorou":"string","ctaSugerido":"string"}`
  };
}

export function promptCampaignVariations(message: string, mode: string) {
  return {
    system: `${AI_SYSTEM_BASE}\nTarefa: gerar variacao da mensagem no estilo "${mode}".`,
    user: `Mensagem base:\n${message}\n\nJSON: {"variacao":"string","modo":"${mode}","observacao":"string"}`
  };
}

export function promptCampaignCompliance(message: string) {
  return {
    system: `${AI_SYSTEM_BASE}\nTarefa: revisar riscos de campanha WhatsApp (tom agressivo, spam, tamanho, clareza, opt-out). Nao bloqueie envio; apenas oriente.`,
    user: `Mensagem:\n${message}\n\nJSON: {"nivelRisco":"baixo|medio|alto","alertas":["string"],"sugestoes":["string"],"aprovavel":true}`
  };
}

export function promptAskAtlas(question: string, context: string) {
  return {
    system: `${AI_SYSTEM_BASE}\nTarefa: responder pergunta do gestor usando APENAS os dados do contexto. Se metrica nao existir, diga em dadosFaltantes. Nunca invente numeros. Marque analiseInicial:true se contexto for limitado.`,
    user: `Pergunta: ${question}\n\nDados disponiveis:\n${context}\n\nJSON: {"titulo":"string","resposta":"string","destaques":["string"],"acoesSugeridas":["string"],"dadosFaltantes":"string ou vazio","analiseInicial":true}`
  };
}
