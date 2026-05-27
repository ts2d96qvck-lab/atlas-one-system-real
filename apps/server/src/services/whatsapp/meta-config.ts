import type { WhatsAppInstance } from "@prisma/client";
import { env } from "../../config/env";
import type { MetaCloudConfig } from "./providers/meta-cloud.provider";

function settingsObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

export function readTenantMetaWhatsAppConfig(tenantSettings: unknown): Partial<MetaCloudConfig> {
  const root = settingsObject(tenantSettings);
  const whatsapp = settingsObject(root.whatsapp);
  const meta = settingsObject(whatsapp.meta);
  return {
    accessToken: typeof meta.accessToken === "string" ? meta.accessToken : undefined,
    phoneNumberId: typeof meta.phoneNumberId === "string" ? meta.phoneNumberId : undefined,
    apiVersion: typeof meta.apiVersion === "string" ? meta.apiVersion : undefined,
    businessAccountId: typeof meta.businessAccountId === "string" ? meta.businessAccountId : undefined
  };
}

export function resolveMetaCloudConfig(
  instance: Pick<WhatsAppInstance, "name" | "phone" | "provider">,
  tenantSettings?: unknown
): MetaCloudConfig {
  const tenantMeta = tenantSettings ? readTenantMetaWhatsAppConfig(tenantSettings) : {};
  const phoneNumberId = tenantMeta.phoneNumberId || instance.name || instance.phone || env.metaWhatsAppPhoneNumberId;

  return {
    accessToken: tenantMeta.accessToken || env.metaWhatsAppAccessToken,
    phoneNumberId,
    apiVersion: tenantMeta.apiVersion || env.metaWhatsAppApiVersion,
    businessAccountId: tenantMeta.businessAccountId || env.metaWhatsAppBusinessAccountId || undefined
  };
}

export function isMetaCloudConfigured(
  instance?: Pick<WhatsAppInstance, "name" | "phone" | "provider">,
  tenantSettings?: unknown
) {
  if (instance && normalizeProvider(instance.provider) === "meta_cloud") {
    const config = resolveMetaCloudConfig(instance, tenantSettings);
    return Boolean(config.accessToken && config.phoneNumberId);
  }
  return Boolean(env.metaWhatsAppAccessToken && env.metaWhatsAppPhoneNumberId);
}

function normalizeProvider(value: string) {
  return value === "meta" ? "meta_cloud" : value;
}
