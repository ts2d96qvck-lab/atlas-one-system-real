import { env } from "../../config/env";
import { isBootstrapTicketValid } from "./bootstrap-ticket";

const WEAK_SECRETS = new Set(["atlas-one-dev-secret", "CHANGE_ME", "change-me", ""]);

function isWeakSecret(value: string) {
  return WEAK_SECRETS.has(value) || value.length < 32;
}

export function validateProductionEnv() {
  const strict = env.isProduction || env.enterpriseMode;
  if (!strict) return;

  const errors: string[] = [];

  if (isWeakSecret(env.jwtSecret)) {
    errors.push("JWT_SECRET deve ter pelo menos 32 caracteres aleatorios");
  }
  if (!env.databaseUrl) {
    errors.push("DATABASE_URL obrigatorio");
  }
  if (!env.corsOrigins.length) {
    errors.push("CORS_ORIGINS obrigatorio (ex: https://app.atlasone.app.br)");
  }
  if (
    env.webhookUseHttps &&
    env.webhookPublicUrl.startsWith("http://") &&
    !env.webhookPublicUrl.includes("localhost") &&
    !env.evolutionWebhookBaseUrl.trim()
  ) {
    errors.push("WEBHOOK_PUBLIC_URL deve usar HTTPS em producao quando WEBHOOK_USE_HTTPS=true");
  }
  if (env.appPublicUrl.startsWith("http://") && !env.appPublicUrl.includes("localhost") && env.webhookUseHttps) {
    errors.push("APP_PUBLIC_URL deve usar HTTPS em producao quando WEBHOOK_USE_HTTPS=true");
  }
  if (env.smsProvider === "console" && !env.allowLocalSms) {
    errors.push("SMS_PROVIDER=console nao e permitido (use twilio, webhook ou ATLAS_ALLOW_LOCAL_SMS=true apenas em ambiente controlado)");
  }
  if (!env.evolutionApiKey) {
    errors.push("EVOLUTION_API_KEY obrigatorio");
  }
  if (!env.webhookSecret && !env.evolutionApiKey) {
    errors.push("WEBHOOK_SECRET ou EVOLUTION_API_KEY obrigatorio para webhooks");
  }
  if (isWeakSecret(env.webhookSecret) && env.webhookSecret) {
    errors.push("WEBHOOK_SECRET deve ter pelo menos 32 caracteres");
  }
  if (isWeakSecret(env.paymentsWebhookSecret)) {
    errors.push("PAYMENTS_WEBHOOK_SECRET deve ter pelo menos 32 caracteres");
  }
  if (!env.platformAdminEmails.length) {
    errors.push("PLATFORM_ADMIN_EMAILS obrigatorio (emails dos administradores da plataforma)");
  }
  if (env.allowPublicBootstrap) {
    errors.push("ALLOW_PUBLIC_BOOTSTRAP=true nao e permitido");
  }
  if (!env.setupToken && !env.allowPublicBootstrap) {
    errors.push("SETUP_TOKEN obrigatorio quando bootstrap publico esta desabilitado");
  }
  if (env.databaseUrl.includes("://atlas:atlas@") || env.databaseUrl.includes("postgres:postgres@")) {
    errors.push("DATABASE_URL usa credencial padrao — altere POSTGRES_PASSWORD em producao");
  }
  if (env.redisUrl && env.redisUrl === "redis://redis:6379") {
    errors.push("REDIS_URL deve incluir senha em producao (ex: redis://:senha@redis:6379)");
  }

  if (errors.length) {
    throw new Error(`Configuracao insegura:\n- ${errors.join("\n- ")}`);
  }
}

export function isSetupAuthorized(credential: string | undefined) {
  if (!env.isProduction && !env.enterpriseMode) return true;
  if (env.allowPublicBootstrap) return true;
  if (!env.setupToken && !credential) return false;
  return isBootstrapTicketValid(credential);
}

export function assertSetupToken(headerValue: string | undefined) {
  return isSetupAuthorized(headerValue);
}
