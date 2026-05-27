import type { SendTextInput, WhatsAppProvider } from "@atlas-one/lib";
import type { WhatsAppInstance } from "@prisma/client";
import { createWhatsAppProvider, providerForInstance } from "./providers/factory";

export class WhatsAppService {
  constructor(private readonly provider: WhatsAppProvider) {}

  static forInstance(instance: Pick<WhatsAppInstance, "provider">) {
    return new WhatsAppService(providerForInstance(instance).provider);
  }

  static forKind(kind: Parameters<typeof createWhatsAppProvider>[0]) {
    return new WhatsAppService(createWhatsAppProvider(kind));
  }

  async sendText(input: SendTextInput) {
    return this.provider.sendText(input);
  }

  async ensureOpen(instanceName: string) {
    const state = await this.provider.getState(instanceName);
    if (state !== "open") {
      throw new Error(`Instancia WhatsApp ${instanceName} nao esta conectada (${state}).`);
    }
    return state;
  }
}
