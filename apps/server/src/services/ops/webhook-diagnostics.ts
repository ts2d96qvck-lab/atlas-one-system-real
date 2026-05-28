let lastEvolutionWebhook: {
  at: string | null;
  event: string | null;
  ok: boolean | null;
} = { at: null, event: null, ok: null };

export function recordEvolutionWebhook(event: string, ok: boolean) {
  lastEvolutionWebhook = { at: new Date().toISOString(), event, ok };
}

export function getLastEvolutionWebhook() {
  return lastEvolutionWebhook;
}
