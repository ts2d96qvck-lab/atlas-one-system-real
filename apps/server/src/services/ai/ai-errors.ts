export type AiErrorCategory =
  | "not_configured"
  | "validation"
  | "not_found"
  | "context_limit"
  | "provider_error"
  | "parse_error"
  | "unknown";

export function categorizeAiError(error: unknown): AiErrorCategory {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (message.includes("indisponivel") || message.includes("nao configurada") || message.includes("api_key")) {
    return "not_configured";
  }
  if (message.includes("nao encontrad") || message.includes("not found")) return "not_found";
  if (message.includes("informe") || message.includes("invalido") || message.includes("payload")) return "validation";
  if (message.includes("context") || message.includes("too long") || message.includes("token")) return "context_limit";
  if (message.includes("json") || message.includes("parse")) return "parse_error";
  if (message.includes("http") || message.includes("openai") || message.includes("openrouter")) return "provider_error";
  return "unknown";
}

/** User-safe message — never exposes provider secrets or raw stack traces. */
export function friendlyAiError(error: unknown): string {
  const category = categorizeAiError(error);
  switch (category) {
    case "not_configured":
      return "O Atlas AI ainda não está ativo neste ambiente. Peça ao administrador para configurar a integração.";
    case "not_found":
      return "Não encontramos os dados necessários para esta análise.";
    case "validation":
      return error instanceof Error ? error.message : "Revise os dados informados e tente novamente.";
    case "context_limit":
      return "O contexto é muito grande. Tente com uma conversa mais recente ou menos texto.";
    case "provider_error":
    case "parse_error":
    case "unknown":
    default:
      return "Não consegui gerar agora. Tente novamente em instantes.";
  }
}
