import type { WhatsAppProvider } from "@atlas-one/lib";

export const WHATSAPP_PROVIDER_KINDS = ["evolution", "meta_cloud"] as const;

export type WhatsAppProviderKind = (typeof WHATSAPP_PROVIDER_KINDS)[number];

export type WhatsAppProviderCatalogItem = {
  id: WhatsAppProviderKind;
  label: string;
  description: string;
  status: "available" | "configured" | "needs_setup";
  supportsQrConnect: boolean;
  supportsWebhookPerInstance: boolean;
};

export type ResolvedWhatsAppProvider = {
  kind: WhatsAppProviderKind;
  provider: WhatsAppProvider;
};
