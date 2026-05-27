import type { WhatsAppProviderKind } from "./types";

export function normalizeProviderKind(value?: string | null): WhatsAppProviderKind {
  const normalized = (value ?? "evolution").trim().toLowerCase().replace(/-/g, "_");
  if (normalized === "meta" || normalized === "meta_cloud" || normalized === "whatsapp_cloud") {
    return "meta_cloud";
  }
  return "evolution";
}

export function providerKindLabel(kind: WhatsAppProviderKind) {
  return kind === "meta_cloud" ? "Meta Cloud API" : "Evolution API";
}
