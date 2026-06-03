import { env } from "../../config/env";
import type { AiCompletionInput, AiCompletionResult, AiProvider } from "./ai.provider";

type OpenAiChatResponse = {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string };
};

export class OpenAiChatProvider implements AiProvider {
  readonly name = "openai";

  async complete(input: AiCompletionInput): Promise<AiCompletionResult> {
    const apiKey = env.openaiApiKey.trim();
    if (!apiKey) throw new Error("OPENAI_API_KEY nao configurada.");

    const model = env.atlasAiModel.trim() || "gpt-4o-mini";
    const body: Record<string, unknown> = {
      model,
      messages: input.messages,
      temperature: input.temperature ?? 0.4,
      max_tokens: input.maxTokens ?? 1200
    };
    if (input.jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const payload = (await response.json().catch(() => ({}))) as OpenAiChatResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? `OpenAI HTTP ${response.status}`);
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Resposta vazia do provedor OpenAI.");

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
