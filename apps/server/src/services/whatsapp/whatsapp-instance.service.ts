import type { WhatsAppInstance } from "@prisma/client";
import type { WhatsAppProvider } from "@atlas-one/lib";
import { prisma } from "../../lib/prisma";
import { createWhatsAppProvider, normalizeProviderKind, providerForInstance } from "./providers/factory";
import type { WhatsAppProviderKind } from "./providers/types";

export type PreparedOutboundInstance = {
  provider: WhatsAppProvider;
  kind: WhatsAppProviderKind;
  instance: WhatsAppInstance;
  sendName: string;
};

export async function alignDbInstanceForSend(
  tenantId: string,
  conversationId: string,
  dbInstance: WhatsAppInstance,
  provider: WhatsAppProvider
): Promise<{ instance: WhatsAppInstance; sendName: string }> {
  const kind = normalizeProviderKind(dbInstance.provider);
  if (kind !== "evolution") {
    const sendName = await provider.resolveInstanceName(dbInstance.name, dbInstance.phone ?? undefined);
    return { instance: dbInstance, sendName };
  }

  const sendName = await provider.resolveInstanceName(dbInstance.name, dbInstance.phone ?? undefined);

  if (sendName === dbInstance.name) {
    return { instance: dbInstance, sendName };
  }

  const canonical = await prisma.whatsAppInstance.findFirst({
    where: { tenantId, name: sendName }
  });

  if (canonical && canonical.id !== dbInstance.id) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { instanceId: canonical.id }
    });

    const remaining = await prisma.conversation.count({
      where: { instanceId: dbInstance.id }
    });
    if (remaining === 0) {
      await prisma.whatsAppInstance.delete({ where: { id: dbInstance.id } }).catch(() => undefined);
    }

    return { instance: canonical, sendName };
  }

  const updated = await prisma.whatsAppInstance.update({
    where: { id: dbInstance.id },
    data: { name: sendName }
  });

  return { instance: updated, sendName };
}

export async function prepareOutboundInstance(
  tenantId: string,
  conversationId: string,
  dbInstance: WhatsAppInstance
): Promise<PreparedOutboundInstance> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const { kind, provider } = providerForInstance(dbInstance, tenant?.settings);
  const aligned = await alignDbInstanceForSend(tenantId, conversationId, dbInstance, provider);
  return {
    provider,
    kind,
    instance: aligned.instance,
    sendName: aligned.sendName
  };
}

export async function prepareInstanceForCampaign(
  tenantId: string,
  instanceId: string
): Promise<PreparedOutboundInstance> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const instance = await prisma.whatsAppInstance.findFirst({ where: { tenantId, id: instanceId } });
  if (!instance) throw new Error("Instancia WhatsApp nao encontrada.");
  const { kind, provider } = providerForInstance(instance, tenant?.settings);
  const sendName = await provider.resolveInstanceName(instance.name, instance.phone ?? undefined);
  return { provider, kind, instance, sendName };
}

export function providerForInstanceName(instance: Pick<WhatsAppInstance, "provider">) {
  return providerForInstance(instance);
}

export {
  createWhatsAppProvider,
  listWhatsAppProviderCatalog,
  normalizeProviderKind,
  providerForInstance
} from "./providers/factory";
