import { env } from "../../config/env";
import type { AiProvider } from "./ai.provider";
import { NoopAiProvider } from "./ai.provider";
import { OpenAiChatProvider } from "./openai-chat.provider";
import { OpenRouterChatProvider } from "./openrouter-chat.provider";

export function createAiProvider(): AiProvider {
  const configured = env.atlasAiProvider;

  if (configured === "openrouter" || env.openRouterApiKey.trim()) {
    if (env.openRouterApiKey.trim()) return new OpenRouterChatProvider();
  }

  if (configured === "openai" || env.openaiApiKey.trim()) {
    if (env.openaiApiKey.trim()) return new OpenAiChatProvider();
  }

  if (configured === "openrouter") return new OpenRouterChatProvider();
  if (configured === "openai") return new OpenAiChatProvider();

  return new NoopAiProvider();
}
