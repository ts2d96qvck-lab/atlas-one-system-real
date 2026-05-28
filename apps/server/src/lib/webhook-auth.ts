import type { FastifyRequest } from "fastify";
import { env } from "../config/env";

function headerValue(request: FastifyRequest, name: string) {
  const value = request.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function verifyEvolutionWebhook(request: FastifyRequest) {
  const apiKey = headerValue(request, "apikey") || headerValue(request, "x-api-key");
  if (env.evolutionApiKey && apiKey === env.evolutionApiKey) return true;

  const secret = headerValue(request, "x-atlas-webhook-secret");
  if (env.webhookSecret && secret === env.webhookSecret) return true;

  if (!env.enterpriseMode) return true;

  // Allow same-network callbacks when no secret headers are configured yet (legacy instances).
  if (!env.webhookSecret && !env.evolutionApiKey) return true;

  return false;
}

export function verifyPaymentsWebhook(request: FastifyRequest) {
  const secret = headerValue(request, "x-atlas-webhook-secret") || headerValue(request, "x-webhook-secret");
  if (env.paymentsWebhookSecret && secret === env.paymentsWebhookSecret) return true;
  if (!env.enterpriseMode) return true;
  return false;
}

export function verifyAsaasWebhook(request: FastifyRequest) {
  const token =
    headerValue(request, "asaas-access-token") ||
    headerValue(request, "x-asaas-access-token") ||
    headerValue(request, "x-atlas-webhook-secret");
  if (env.asaasWebhookToken && token === env.asaasWebhookToken) return true;
  if (env.paymentsWebhookSecret && token === env.paymentsWebhookSecret) return true;
  if (!env.isProduction && !env.enterpriseMode) return true;
  return false;
}
