import { EvolutionWhatsAppProvider } from "@atlas-one/lib";
import { env } from "../../../config/env";

export function createEvolutionProvider() {
  return new EvolutionWhatsAppProvider({
    baseUrl: env.evolutionUrl,
    apiKey: env.evolutionApiKey,
    webhookSecret: env.webhookSecret || undefined
  });
}

export function evolutionConfigured() {
  return Boolean(env.evolutionUrl && env.evolutionApiKey);
}
