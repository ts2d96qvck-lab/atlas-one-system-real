import { prisma } from "../../lib/prisma";

export type SignaturePlacement = "before" | "after" | "disabled";

export type MessagingSettings = {
  showAgentNameToCustomer: boolean;
  showBotNameToCustomer: boolean;
  agentSignatureFormat: string;
  botSignatureFormat: string;
  signaturePlacement: SignaturePlacement;
};

function settingsObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

export function parseMessagingSettings(raw: unknown): MessagingSettings {
  const settings = settingsObject(raw);
  const messaging = settingsObject(settings.messaging);
  const placement = messaging.signaturePlacement;
  return {
    showAgentNameToCustomer: messaging.showAgentNameToCustomer !== false,
    showBotNameToCustomer: messaging.showBotNameToCustomer === true,
    agentSignatureFormat:
      typeof messaging.agentSignatureFormat === "string" && messaging.agentSignatureFormat.trim()
        ? messaging.agentSignatureFormat.trim()
        : "Atendente {{agentName}}:",
    botSignatureFormat:
      typeof messaging.botSignatureFormat === "string" && messaging.botSignatureFormat.trim()
        ? messaging.botSignatureFormat.trim()
        : "{{botName}}:",
    signaturePlacement:
      placement === "before" || placement === "after" || placement === "disabled" ? placement : "before"
  };
}

export async function getMessagingSettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  return parseMessagingSettings(tenant?.settings);
}

export function isBotActor(actor?: { id?: string; role?: string }) {
  return actor?.id === "menu-bot" || actor?.role === "system";
}

export function buildSignatureLine(format: string, name: string) {
  return format.replace(/\{\{agentName\}\}/g, name).replace(/\{\{botName\}\}/g, name).trim();
}

export function applyOutgoingSignature(
  contentRaw: string,
  actor: { id: string; name: string; role: string },
  settings: MessagingSettings
) {
  if (settings.signaturePlacement === "disabled" || !contentRaw) {
    return { providerText: contentRaw, signatureApplied: false };
  }

  const bot = isBotActor(actor);
  if (bot && !settings.showBotNameToCustomer) return { providerText: contentRaw, signatureApplied: false };
  if (!bot && !settings.showAgentNameToCustomer) return { providerText: contentRaw, signatureApplied: false };

  const format = bot ? settings.botSignatureFormat : settings.agentSignatureFormat;
  const signature = buildSignatureLine(format, actor.name);
  if (!signature) return { providerText: contentRaw, signatureApplied: false };

  const providerText =
    settings.signaturePlacement === "before" ? `${signature}\n${contentRaw}` : `${contentRaw}\n${signature}`;

  return { providerText, signatureApplied: true, signatureLine: signature };
}
