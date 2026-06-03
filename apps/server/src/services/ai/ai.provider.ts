export type AiChatRole = "system" | "user" | "assistant";

export type AiChatMessage = {
  role: AiChatRole;
  content: string;
};

export type AiCompletionInput = {
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
};

export type AiCompletionResult = {
  content: string;
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export interface AiProvider {
  readonly name: string;
  complete(input: AiCompletionInput): Promise<AiCompletionResult>;
}

export class NoopAiProvider implements AiProvider {
  readonly name = "noop";

  async complete(): Promise<AiCompletionResult> {
    throw new Error(
      "Atlas AI indisponivel. Configure OPENAI_API_KEY ou OPENROUTER_API_KEY (e opcionalmente ATLAS_AI_PROVIDER=openai|openrouter)."
    );
  }
}
