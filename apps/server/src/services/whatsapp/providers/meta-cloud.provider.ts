import type {
  SendMediaInput,
  SendTemplateInput,
  SendTextInput,
  WhatsAppInstanceState,
  WhatsAppProvider
} from "@atlas-one/lib";
import { env } from "../../../config/env";

export type MetaCloudConfig = {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
  businessAccountId?: string;
};

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function metaNotConfigured(action: string): never {
  throw new Error(
    `Meta WhatsApp Cloud API nao configurada para ${action}. Defina META_WHATSAPP_ACCESS_TOKEN e META_WHATSAPP_PHONE_NUMBER_ID. Veja WHATSAPP_PROVIDERS.md.`
  );
}

/**
 * Official Meta WhatsApp Cloud API adapter.
 * Connect/QR flows are managed in Meta Business Manager — Atlas sends via Graph API.
 */
export class MetaCloudWhatsAppProvider implements WhatsAppProvider {
  constructor(private readonly config: MetaCloudConfig) {}

  private get configured() {
    return Boolean(this.config.accessToken && this.config.phoneNumberId);
  }

  private graphUrl(path: string) {
    const version = this.config.apiVersion.replace(/^\/|\/$/g, "");
    return `https://graph.facebook.com/${version}/${path.replace(/^\//, "")}`;
  }

  private async graphRequest(path: string, init?: RequestInit) {
    if (!this.config.accessToken) metaNotConfigured("requisicoes Graph API");
    const response = await fetch(this.graphUrl(path), {
      ...init,
      headers: {
        authorization: `Bearer ${this.config.accessToken}`,
        "content-type": "application/json",
        ...(init?.headers ?? {})
      }
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const message =
        typeof data?.error?.message === "string"
          ? data.error.message
          : `Meta Graph API error ${response.status}`;
      throw new Error(message);
    }
    return data;
  }

  async createInstance() {
    throw new Error(
      "Numeros Meta Cloud sao criados no Meta Business Manager. Cadastre a instancia no Atlas com provider meta_cloud."
    );
  }

  async connect(_instanceName: string) {
    if (!this.configured) metaNotConfigured("conexao");
    const state = await this.getState(_instanceName);
    return { state, raw: { provider: "meta_cloud", phoneNumberId: this.config.phoneNumberId } };
  }

  async getState(_instanceName: string): Promise<WhatsAppInstanceState> {
    if (!this.configured) return "error";
    try {
      await this.graphRequest(this.config.phoneNumberId);
      return "open";
    } catch {
      return "error";
    }
  }

  async fetchInstances() {
    if (!this.configured) return [];
    return [
      {
        name: this.config.phoneNumberId,
        connectionStatus: "open",
        number: this.config.phoneNumberId
      }
    ];
  }

  async resolveInstanceName(preferredName: string) {
    if (!this.configured) return preferredName;
    if (preferredName === this.config.phoneNumberId) return preferredName;
    return this.config.phoneNumberId;
  }

  async getProfilePictureUrl(_instanceName: string, _number: string) {
    return null;
  }

  async sendText(input: SendTextInput) {
    if (!this.configured) metaNotConfigured("envio de texto");
    const to = digitsOnly(input.number);
    return this.graphRequest(`${this.config.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: input.text }
      })
    });
  }

  async sendTemplate(input: SendTemplateInput) {
    if (!this.configured) metaNotConfigured("envio de template");
    const to = digitsOnly(input.number);
    const template: Record<string, unknown> = {
      name: input.templateName,
      language: { code: input.languageCode }
    };
    if (input.components?.length) {
      template.components = input.components;
    }
    return this.graphRequest(`${this.config.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template
      })
    });
  }

  async sendMedia(input: SendMediaInput) {
    if (!this.configured) metaNotConfigured("envio de midia");
    const to = digitsOnly(input.number);
    const mediaType = input.mediatype === "document" ? "document" : input.mediatype;
    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: mediaType,
      [mediaType]: {
        link: input.media.startsWith("http") ? input.media : undefined,
        caption: input.caption,
        filename: input.fileName
      }
    };

    if (!input.media.startsWith("http")) {
      throw new Error(
        "Meta Cloud API exige URL publica para midia nesta versao. Use Evolution para base64 ou configure CDN."
      );
    }

    return this.graphRequest(`${this.config.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async setWebhook(_instanceName: string, _url: string) {
    if (!this.configured) metaNotConfigured("webhook");
    return {
      ok: true,
      provider: "meta_cloud",
      message:
        "Webhook Meta e configurado no app do Meta Developers (nao por instancia). Use GET/POST /webhook/meta para verificacao."
    };
  }

  async logout(_instanceName: string) {
    return { ok: true, provider: "meta_cloud" };
  }
}

export function createMetaCloudProviderFromEnv(): MetaCloudWhatsAppProvider {
  return new MetaCloudWhatsAppProvider({
    accessToken: env.metaWhatsAppAccessToken,
    phoneNumberId: env.metaWhatsAppPhoneNumberId,
    apiVersion: env.metaWhatsAppApiVersion,
    businessAccountId: env.metaWhatsAppBusinessAccountId || undefined
  });
}

export function metaCloudConfigured() {
  return Boolean(env.metaWhatsAppAccessToken && env.metaWhatsAppPhoneNumberId);
}
