import { env } from "../../config/env";
import type { AiCompletionInput, AiCompletionResult, AiProvider } from "./ai.provider";

type OpenRouterChatResponse = {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string };
};

export class OpenRouterChatProvider implements AiProvider {
  readonly name = "openrouter";

  async complete(input: AiCompletionInput): Promise<AiCompletionResult> {
    const apiKey = env.openRouterApiKey.trim();
    if (!apiKey) throw new Error("OPENROUTER_API_KEY nao configurada.");

    const model = env.atlasAiModel.trim() || "openai/gpt-4o-mini";
    const body: Record<string, unknown> = {
      model,
      messages: input.messages,
      temperature: input.temperature ?? 0.4,
      max_tokens: input.maxTokens ?? 1200
    };
    if (input.jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const headers: Record<string, string> = {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    };
    if (env.atlasAiAppUrl.trim()) headers["HTTP-Referer"] = env.atlasAiAppUrl.trim();
    if (env.atlasAiAppName.trim()) headers["X-Title"] = env.atlasAiAppName.trim();

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    const payload = (await response.json().catch(() => ({}))) as OpenRouterChatResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? `OpenRouter HTTP ${response.status}`);
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Resposta vazia do provedor OpenRouter.");

    return {
      content,
      provider: this.name,
      model,
      promptTokens: payload.usage?.prompt_tokens,
      completionTokens: payload.usage?.completion_tokens,
      totalTokens: payload.usage?.total_tokens
    };
  }
}
