import { existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";

const candidates = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
  resolve(process.cwd(), "../../../.env")
];

for (const path of candidates) {
  if (existsSync(path)) {
    dotenv.config({ path, override: false });
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  enterpriseMode: process.env.ATLAS_ENTERPRISE_MODE === "true" || process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? "0.0.0.0",
  jwtSecret: process.env.JWT_SECRET ?? "atlas-one-dev-secret",
  webhookSecret: process.env.WEBHOOK_SECRET ?? "",
  paymentsWebhookSecret: process.env.PAYMENTS_WEBHOOK_SECRET ?? "",
  setupToken: process.env.SETUP_TOKEN ?? "",
  allowPublicBootstrap: process.env.ALLOW_PUBLIC_BOOTSTRAP === "true",
  allowLocalSms: process.env.ATLAS_ALLOW_LOCAL_SMS === "true",
  platformAdminEmails: (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  corsOrigins: (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  evolutionUrl: process.env.EVOLUTION_URL ?? "http://localhost:8080",
  evolutionApiKey: process.env.EVOLUTION_API_KEY ?? "",
  defaultInstance: process.env.EVOLUTION_DEFAULT_INSTANCE ?? "Atlas one",
  defaultWhatsAppProvider: process.env.WHATSAPP_DEFAULT_PROVIDER ?? "evolution",
  metaWhatsAppAccessToken: process.env.META_WHATSAPP_ACCESS_TOKEN ?? "",
  metaWhatsAppPhoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? "",
  metaWhatsAppBusinessAccountId: process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID ?? "",
  metaWhatsAppApiVersion: process.env.META_WHATSAPP_API_VERSION ?? "v22.0",
  metaWhatsAppWebhookVerifyToken: process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "",
  metaWhatsAppAppSecret: process.env.META_WHATSAPP_APP_SECRET ?? "",
  webhookPublicUrl: process.env.WEBHOOK_PUBLIC_URL ?? "http://app.atlasone.local.gd",
  /** Internal base URL Evolution uses to POST webhooks (same Docker network). Falls back to webhookPublicUrl. */
  evolutionWebhookBaseUrl: process.env.EVOLUTION_WEBHOOK_BASE_URL ?? "",
  /** When false (default), Evolution webhook registration uses HTTP even if WEBHOOK_PUBLIC_URL is HTTPS. */
  webhookUseHttps: process.env.WEBHOOK_USE_HTTPS === "true",
  appPublicUrl: process.env.APP_PUBLIC_URL ?? process.env.WEBHOOK_PUBLIC_URL ?? "http://127.0.0.1",
  databaseUrl: process.env.DATABASE_URL ?? "",
  smsProvider: process.env.SMS_PROVIDER ?? "console",
  smsWebhookUrl: process.env.SMS_WEBHOOK_URL ?? "",
  smsApiToken: process.env.SMS_API_TOKEN ?? "",
  smsFrom: process.env.SMS_FROM ?? "AtlasOne",
  smsTwilioSid: process.env.SMS_TWILIO_SID ?? "",
  smsTwilioToken: process.env.SMS_TWILIO_TOKEN ?? "",
  smsTwilioFrom: process.env.SMS_TWILIO_FROM ?? "",
  oidcIssuer: process.env.OIDC_ISSUER ?? "",
  oidcClientId: process.env.OIDC_CLIENT_ID ?? "",
  oidcClientSecret: process.env.OIDC_CLIENT_SECRET ?? "",
  oidcRedirectUri: process.env.OIDC_REDIRECT_URI ?? "",
  googleOidcClientId: process.env.GOOGLE_OIDC_CLIENT_ID ?? "",
  googleOidcClientSecret: process.env.GOOGLE_OIDC_CLIENT_SECRET ?? "",
  microsoftOidcClientId: process.env.MICROSOFT_OIDC_CLIENT_ID ?? "",
  microsoftOidcClientSecret: process.env.MICROSOFT_OIDC_CLIENT_SECRET ?? "",
  microsoftOidcTenant: process.env.MICROSOFT_OIDC_TENANT ?? "common",
  paymentProvider: (process.env.PAYMENT_PROVIDER ?? "manual") as "asaas" | "stripe" | "manual",
  asaasApiKey: process.env.ASAAS_API_KEY ?? "",
  asaasEnv: process.env.ASAAS_ENV ?? "sandbox",
  asaasWebhookToken: process.env.ASAAS_WEBHOOK_TOKEN ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  atlasAiProvider: (process.env.ATLAS_AI_PROVIDER ?? "").trim().toLowerCase(),
  atlasAiModel: process.env.ATLAS_AI_MODEL ?? "",
  atlasAiAppName: process.env.ATLAS_AI_APP_NAME ?? "Atlas One",
  atlasAiAppUrl: process.env.ATLAS_AI_APP_URL ?? process.env.APP_PUBLIC_URL ?? "",
  transcriptionProvider: process.env.TRANSCRIPTION_PROVIDER ?? "",
  transcriptionModel: process.env.TRANSCRIPTION_MODEL ?? "whisper-1",
  redisUrl: process.env.REDIS_URL ?? "",
  qaBypassRateLimit: process.env.QA_BYPASS_RATE_LIMIT === "true",
  qaBypass2fa: process.env.QA_BYPASS_2FA === "true" && process.env.NODE_ENV !== "production",
  /** When true (default), suspicious IP/UA changes never force login 2FA. Set false to re-enable. */
  disableSuspicious2fa: process.env.DISABLE_SUSPICIOUS_2FA !== "false"
};

