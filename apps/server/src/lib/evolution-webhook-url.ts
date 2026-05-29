import { buildWebhookPublicUrl } from "@atlas-one/lib";
import { env } from "../config/env";

const INTERNAL_DOCKER_HOSTS = /^(nginx|atlas-server|atlas-server:\d+|host\.docker\.internal(:\d+)?)$/i;

/**
 * Base URL Evolution uses to POST inbound webhooks.
 * Priority: EVOLUTION_WEBHOOK_BASE_URL → WEBHOOK_PUBLIC_URL (HTTP until WEBHOOK_USE_HTTPS=true).
 */
export function resolveEvolutionWebhookBase(): string {
  const explicit = env.evolutionWebhookBaseUrl.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  let base = env.webhookPublicUrl.replace(/\/$/, "");
  if (!env.webhookUseHttps && /^https:\/\//i.test(base)) {
    base = base.replace(/^https:\/\//i, "http://");
  }
  return base;
}

export function buildEvolutionWebhookUrl(tenantSlug: string): string {
  const base = resolveEvolutionWebhookBase();
  let url = buildWebhookPublicUrl(base, tenantSlug);
  if (env.webhookSecret) {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}token=${encodeURIComponent(env.webhookSecret)}`;
  }
  return url;
}

export function redactWebhookToken(url: string): string {
  return url.replace(/([?&]token=)[^&]+/gi, "$1***");
}

function parseProtocol(url: string): "http" | "https" | "unknown" {
  try {
    return new URL(url).protocol === "https:" ? "https" : "http";
  } catch {
    return "unknown";
  }
}

function webhookBaseSource(): "EVOLUTION_WEBHOOK_BASE_URL" | "WEBHOOK_PUBLIC_URL" {
  return env.evolutionWebhookBaseUrl.trim() ? "EVOLUTION_WEBHOOK_BASE_URL" : "WEBHOOK_PUBLIC_URL";
}

export function evolutionWebhookWarnings(configuredUrl: string): string[] {
  const warnings: string[] = [];
  const protocol = parseProtocol(configuredUrl);
  const publicProtocol = parseProtocol(env.webhookPublicUrl);

  if (protocol === "https") {
    warnings.push(
      "Webhook URL uses HTTPS. Evolution inbound delivery fails until TLS/443 is active on the VPS."
    );
  }

  if (!env.evolutionWebhookBaseUrl.trim() && publicProtocol === "https" && !env.webhookUseHttps) {
    warnings.push(
      "WEBHOOK_PUBLIC_URL is HTTPS but Evolution webhooks are forced to HTTP (WEBHOOK_USE_HTTPS=false). Set EVOLUTION_WEBHOOK_BASE_URL=http://nginx for Docker."
    );
  }

  if (!env.evolutionWebhookBaseUrl.trim() && protocol === "https") {
    warnings.push(
      "Set EVOLUTION_WEBHOOK_BASE_URL=http://nginx (Docker internal) or http://app.atlasone.app.br until SSL is enabled."
    );
  }

  if (env.webhookSecret && !configuredUrl.includes("token=")) {
    warnings.push("WEBHOOK_SECRET is set but the configured URL has no token query param.");
  }

  return warnings;
}

export async function probeHttpsAvailability(url: string): Promise<{ ok: boolean; error?: string } | null> {
  if (parseProtocol(url) !== "https") return null;
  let host: string;
  try {
    host = new URL(url).origin;
  } catch {
    return { ok: false, error: "invalid_url" };
  }
  try {
    const response = await fetch(`${host}/api/health`, { signal: AbortSignal.timeout(3500) });
    return { ok: response.ok, error: response.ok ? undefined : `HTTP ${response.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ECONNREFUSED|fetch failed|ENOTFOUND|ETIMEDOUT/i.test(message)) {
      return { ok: false, error: message };
    }
    return { ok: false, error: message };
  }
}

export function describeEvolutionWebhookConfig(tenantSlug: string) {
  const configuredUrl = buildEvolutionWebhookUrl(tenantSlug);
  const protocol = parseProtocol(configuredUrl);
  const warnings = evolutionWebhookWarnings(configuredUrl);
  return {
    configuredUrl: redactWebhookToken(configuredUrl),
    protocol,
    baseSource: webhookBaseSource(),
    baseResolved: redactWebhookToken(buildWebhookPublicUrl(resolveEvolutionWebhookBase(), tenantSlug)),
    tokenIncluded: Boolean(env.webhookSecret),
    webhookUseHttps: env.webhookUseHttps,
    webhookPublicUrl: redactWebhookToken(env.webhookPublicUrl),
    evolutionWebhookBaseUrl: env.evolutionWebhookBaseUrl.trim() || null,
    internalDockerBase: INTERNAL_DOCKER_HOSTS.test(resolveEvolutionWebhookBase().replace(/^https?:\/\//, "")),
    warnings
  };
}
