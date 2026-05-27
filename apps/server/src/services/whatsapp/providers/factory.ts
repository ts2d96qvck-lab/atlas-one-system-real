import type { WhatsAppProvider } from "@atlas-one/lib";
import type { WhatsAppInstance } from "@prisma/client";
import { env } from "../../../config/env";
import { resolveMetaCloudConfig, isMetaCloudConfigured } from "../meta-config";
import { createEvolutionProvider, evolutionConfigured } from "./evolution.provider";
import { MetaCloudWhatsAppProvider } from "./meta-cloud.provider";
import { normalizeProviderKind } from "./normalize";
import type {
  ResolvedWhatsAppProvider,
  WhatsAppProviderCatalogItem,
  WhatsAppProviderKind
} from "./types";

export function createWhatsAppProvider(
  kind: WhatsAppProviderKind,
  instance?: Pick<WhatsAppInstance, "name" | "phone" | "provider">,
  tenantSettings?: unknown
): WhatsAppProvider {
  if (kind === "meta_cloud") {
    return new MetaCloudWhatsAppProvider(
      resolveMetaCloudConfig(instance ?? { name: "", phone: null, provider: "meta_cloud" }, tenantSettings)
    );
  }
  return createEvolutionProvider();
}

export function providerForInstance(
  instance: Pick<WhatsAppInstance, "provider"> & Partial<Pick<WhatsAppInstance, "name" | "phone">>,
  tenantSettings?: unknown
): ResolvedWhatsAppProvider {
  const kind = normalizeProviderKind(instance.provider);
  return {
    kind,
    provider: createWhatsAppProvider(
      kind,
      {
        name: instance.name ?? "",
        phone: instance.phone ?? null,
        provider: instance.provider
      },
      tenantSettings
    )
  };
}

export function listWhatsAppProviderCatalog(): WhatsAppProviderCatalogItem[] {
  return [
    {
      id: "evolution",
      label: "Evolution API",
      description: "WhatsApp via Baileys (QR code). Ideal para operacao atual e PME.",
      status: evolutionConfigured() ? "configured" : "needs_setup",
      supportsQrConnect: true,
      supportsWebhookPerInstance: true
    },
    {
      id: "meta_cloud",
      label: "Meta WhatsApp Cloud API",
      description: "API oficial Meta. Requer app verificado e token permanente.",
      status: isMetaCloudConfigured() ? "configured" : "needs_setup",
      supportsQrConnect: false,
      supportsWebhookPerInstance: false
    }
  ];
}

export function defaultProviderKind(): WhatsAppProviderKind {
  const requested = normalizeProviderKind(env.defaultWhatsAppProvider);
  if (requested === "meta_cloud" && isMetaCloudConfigured()) return "meta_cloud";
  return "evolution";
}

export { normalizeProviderKind, providerKindLabel } from "./normalize";
