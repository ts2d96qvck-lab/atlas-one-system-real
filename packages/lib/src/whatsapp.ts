export type WhatsAppInstanceState = "created" | "connecting" | "open" | "closed" | "error";

export type WhatsAppMessage = {
  id?: string;
  instanceName: string;
  from: string;
  to: string;
  text?: string;
  mediaUrl?: string;
  type: "text" | "image" | "video" | "audio" | "document" | "location";
  timestamp?: string;
  raw?: unknown;
};

export type SendTextInput = {
  instanceName: string;
  /** Used to match the correct Evolution instance when DB name differs from provider. */
  instancePhone?: string;
  number: string;
  text: string;
  quoted?: {
    providerId: string;
    remoteJid: string;
    fromMe: boolean;
  };
};

export type SendMediaInput = {
  instanceName: string;
  instancePhone?: string;
  number: string;
  mediatype: "image" | "video" | "audio" | "document";
  mimetype: string;
  media: string;
  caption?: string;
  fileName?: string;
};

export type TemplateComponentParameter = {
  type: "text" | "currency" | "date_time" | "image" | "document" | "video";
  text?: string;
  currency?: { fallback_value: string; code: string; amount_1000: number };
  date_time?: { fallback_value: string };
  image?: { link: string };
  document?: { link: string };
  video?: { link: string };
};

export type TemplateComponent = {
  type: "header" | "body" | "button";
  sub_type?: "url" | "quick_reply";
  index?: string;
  parameters?: TemplateComponentParameter[];
};

export type SendTemplateInput = {
  instanceName: string;
  instancePhone?: string;
  number: string;
  templateName: string;
  languageCode: string;
  components?: TemplateComponent[];
};

export type ProviderMessageKeyInput = {
  instanceName: string;
  instancePhone?: string;
  number: string;
  providerId: string;
  fromMe?: boolean;
};

export type UpdateProviderMessageInput = ProviderMessageKeyInput & {
  text: string;
};

export type EvolutionInstanceRow = {
  name: string;
  connectionStatus: string;
  number: string;
};

export type WhatsAppProvider = {
  createInstance(instanceName: string, phone?: string): Promise<unknown>;
  connect(instanceName: string): Promise<{ qrCode?: string; state?: WhatsAppInstanceState; raw?: unknown }>;
  getState(instanceName: string): Promise<WhatsAppInstanceState>;
  fetchInstances(): Promise<EvolutionInstanceRow[]>;
  resolveInstanceName(preferredName: string, phone?: string): Promise<string>;
  getProfilePictureUrl(instanceName: string, number: string): Promise<string | null>;
  sendText(input: SendTextInput): Promise<unknown>;
  sendMedia(input: SendMediaInput): Promise<unknown>;
  sendTemplate?(input: SendTemplateInput): Promise<unknown>;
  updateMessage?(input: UpdateProviderMessageInput): Promise<unknown>;
  deleteMessageForEveryone?(input: ProviderMessageKeyInput): Promise<unknown>;
  setWebhook(instanceName: string, url: string): Promise<unknown>;
  logout(instanceName: string): Promise<unknown>;
};

export type EvolutionConfig = {
  baseUrl: string;
  apiKey: string;
};

export class EvolutionWhatsAppProvider implements WhatsAppProvider {
  constructor(private readonly config: EvolutionConfig) {}

  private url(path: string) {
    const parts = path.split("/");
    const instanceParentSegments = new Set([
      "connect",
      "connectionState",
      "logout",
      "delete",
      "sendText",
      "sendMedia",
      "sendWhatsAppAudio",
      "set",
      "fetchProfilePictureUrl",
      "profilePictureUrl",
      "findContacts",
      "getBase64FromMediaMessage",
      "sendMessage",
      "deleteMessageForEveryone",
      "updateMessage"
    ]);

    for (let index = 0; index < parts.length; index += 1) {
      const segment = parts[index];
      const previous = parts[index - 1];
      if (!segment || !previous) continue;
      if (!instanceParentSegments.has(previous)) continue;
      parts[index] = encodeURIComponent(decodeURIComponent(segment));
    }

    return `${this.config.baseUrl.replace(/\/$/, "")}${parts.join("/")}`;
  }

  private headers() {
    return {
      apikey: this.config.apiKey,
      "content-type": "application/json"
    };
  }

  async createInstance(instanceName: string, phone?: string) {
    return this.request("/instance/create", {
      method: "POST",
      body: JSON.stringify({ instanceName, number: phone, qrcode: true, integration: "WHATSAPP-BAILEYS" })
    });
  }

  async createInstanceIfMissing(instanceName: string, phone?: string) {
    try {
      return await this.createInstance(instanceName, phone);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/already|exist/i.test(message)) return { alreadyExists: true };
      throw error;
    }
  }

  async connect(instanceName: string) {
    const raw = await this.request(`/instance/connect/${instanceName}`);
    const pairingCode = raw?.code ?? raw?.qrcode?.code ?? (typeof raw?.qrcode === "string" ? raw.qrcode : undefined);
    let qrImage =
      raw?.base64 ??
      raw?.qrcode?.base64 ??
      (typeof pairingCode === "string" && pairingCode.startsWith("data:image") ? pairingCode : undefined);

    if (!qrImage && typeof pairingCode === "string" && pairingCode.length > 20 && !pairingCode.startsWith("data:")) {
      qrImage = pairingCode;
    }

    const state = raw?.instance?.state ?? raw?.state ?? raw?.status;
    return { qrCode: pairingCode, qrImage, state, raw };
  }

  async getState(instanceName: string) {
    const raw = await this.request(`/instance/connectionState/${instanceName}`);
    const state = raw?.instance?.state ?? raw?.state ?? raw?.connectionStatus;
    return (state ?? "error") as WhatsAppInstanceState;
  }

  private slugInstance(name: string) {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async fetchInstances(): Promise<EvolutionInstanceRow[]> {
    try {
      const raw = await this.request("/instance/fetchInstances");
      if (!Array.isArray(raw)) return [];
      return raw
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const item = row as Record<string, unknown>;
          const name = typeof item.name === "string" ? item.name : "";
          if (!name) return null;
          const connectionStatus = String(
            item.connectionStatus ?? item.state ?? item.status ?? ""
          );
          const number = String(item.number ?? item.ownerJid ?? "").replace(/\D/g, "");
          return { name, connectionStatus, number };
        })
        .filter((row): row is EvolutionInstanceRow => row !== null);
    } catch {
      return [];
    }
  }

  async resolveInstanceName(preferredName: string, phone?: string): Promise<string> {
    const preferred = preferredName.trim();
    if (!preferred) throw new Error("Nome da instancia WhatsApp nao informado.");

    const instances = await this.fetchInstances();
    if (!instances.length) return preferred;

    const exact = instances.find((item) => item.name === preferred);
    if (exact) return exact.name;

    const insensitive = instances.find((item) => item.name.toLowerCase() === preferred.toLowerCase());
    if (insensitive) return insensitive.name;

    const preferredSlug = this.slugInstance(preferred);
    const slugMatch = instances.find((item) => this.slugInstance(item.name) === preferredSlug);
    if (slugMatch) return slugMatch.name;

    const normalizedPhone = phone?.replace(/\D/g, "") ?? "";
    if (normalizedPhone) {
      const phoneMatch = instances.find((item) => {
        const candidate = item.number.replace(/\D/g, "");
        if (!candidate) return false;
        return (
          candidate === normalizedPhone ||
          candidate.endsWith(normalizedPhone) ||
          normalizedPhone.endsWith(candidate)
        );
      });
      if (phoneMatch) return phoneMatch.name;
    }

    const open = instances.filter((item) => /open|connected/i.test(item.connectionStatus));
    if (open.length === 1) return open[0]!.name;

    return preferred;
  }

  async getBase64FromMediaMessage(instanceName: string, messageKey: Record<string, unknown>) {
    const raw = await this.request(`/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({ message: { key: messageKey }, convertToMp4: false })
    });
    return raw?.base64 ?? raw?.media?.base64 ?? raw?.data;
  }

  async getProfilePictureUrl(instanceName: string, number: string) {
    function extractUrl(value: unknown): string | null {
      if (!value) return null;
      if (typeof value === "string") return /^https?:\/\//i.test(value) ? value : null;
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = extractUrl(item);
          if (found) return found;
        }
        return null;
      }
      if (typeof value === "object") {
        const row = value as Record<string, unknown>;
        const directKeys = [
          "profilePicUrl",
          "profilePictureUrl",
          "picture",
          "avatar",
          "url",
          "eurl",
          "imgUrl",
          "imageUrl"
        ];
        for (const key of directKeys) {
          const maybe = row[key];
          if (typeof maybe === "string" && /^https?:\/\//i.test(maybe)) return maybe;
        }
        for (const nested of Object.values(row)) {
          const found = extractUrl(nested);
          if (found) return found;
        }
      }
      return null;
    }

    const normalized = number.replace(/\D/g, "");
    if (!normalized) return null;
    const candidates = new Set<string>([normalized]);
    if (normalized.startsWith("55")) candidates.add(normalized.slice(2));
    else candidates.add(`55${normalized}`);

    const attempts: Array<{ path: string; init?: RequestInit }> = [];
    for (const candidate of candidates) {
      const jid = `${candidate}@s.whatsapp.net`;
      attempts.push(
        {
          path: `/chat/fetchProfilePictureUrl/${instanceName}`,
          init: { method: "POST", body: JSON.stringify({ number: candidate }) }
        },
        {
          path: `/chat/fetchProfilePictureUrl/${instanceName}`,
          init: { method: "POST", body: JSON.stringify({ number: jid }) }
        },
        {
          path: `/chat/profilePictureUrl/${instanceName}`,
          init: { method: "POST", body: JSON.stringify({ number: candidate }) }
        },
        {
          path: `/chat/profilePictureUrl/${instanceName}`,
          init: { method: "POST", body: JSON.stringify({ number: jid }) }
        },
        {
          path: `/chat/findContacts/${instanceName}`,
          init: { method: "POST", body: JSON.stringify({ where: { id: jid } }) }
        },
        {
          path: `/chat/findContacts/${instanceName}`,
          init: { method: "POST", body: JSON.stringify({ where: { number: candidate } }) }
        }
      );
    }

    for (const attempt of attempts) {
      try {
        const raw = await this.request(attempt.path, attempt.init);
        const found = extractUrl(raw);
        if (found) return found;
      } catch {
        // Try the next known endpoint flavor.
      }
    }

    return null;
  }

  async logout(instanceName: string) {
    try {
      return await this.request(`/instance/logout/${instanceName}`, { method: "DELETE" });
    } catch {
      return await this.request(`/instance/delete/${instanceName}`, { method: "DELETE" });
    }
  }

  async sendText(input: SendTextInput) {
    const instanceName = await this.resolveInstanceName(input.instanceName, input.instancePhone);
    const number = input.number.replace(/\D/g, "");
    const quotedBlock = input.quoted?.providerId
      ? {
          quoted: {
            key: {
              remoteJid: input.quoted.remoteJid,
              fromMe: input.quoted.fromMe,
              id: input.quoted.providerId
            }
          }
        }
      : {};

    const legacyPayload = {
      number,
      text: input.text,
      linkPreview: false,
      ...quotedBlock
    };

    try {
      return await this.request(`/message/sendText/${instanceName}`, {
        method: "POST",
        body: JSON.stringify(legacyPayload)
      });
    } catch (legacyError) {
      if (!this.isBadRequestError(legacyError)) throw legacyError;
    }

    const fallbackAttempts = [
      {
        path: `/message/sendText/${instanceName}`,
        payload: {
          number,
          textMessage: { text: input.text },
          ...quotedBlock
        }
      },
      {
        path: `/message/sendText/${instanceName}`,
        payload: {
          number,
          options: { delay: 1200, presence: "composing", linkPreview: false },
          textMessage: { text: input.text },
          ...quotedBlock
        }
      },
      {
        path: `/message/sendText/${instanceName}`,
        payload: {
          number: `${number}@s.whatsapp.net`,
          text: input.text,
          linkPreview: false,
          ...quotedBlock
        }
      },
      {
        path: `/chat/sendMessage/${instanceName}`,
        payload: {
          number,
          textMessage: { text: input.text }
        }
      },
      {
        path: `/chat/sendMessage/${instanceName}`,
        payload: {
          number: `${number}@s.whatsapp.net`,
          textMessage: { text: input.text }
        }
      }
    ];

    let lastError: unknown = null;
    for (const attempt of fallbackAttempts) {
      try {
        return await this.request(attempt.path, {
          method: "POST",
          body: JSON.stringify(attempt.payload)
        });
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) throw lastError;
    throw new Error("Falha ao enviar mensagem de texto no provedor Evolution.");
  }

  private whatsappRemoteJid(number: string) {
    const digits = number.replace(/\D/g, "");
    return `${digits}@s.whatsapp.net`;
  }

  async deleteMessageForEveryone(input: ProviderMessageKeyInput) {
    const instanceName = await this.resolveInstanceName(input.instanceName, input.instancePhone);
    const remoteJid = this.whatsappRemoteJid(input.number);
    const payload = {
      id: input.providerId,
      remoteJid,
      fromMe: input.fromMe ?? true
    };

    try {
      return await this.request(`/chat/deleteMessageForEveryone/${instanceName}`, {
        method: "DELETE",
        body: JSON.stringify(payload)
      });
    } catch (error) {
      if (!this.isBadRequestError(error)) throw error;
      return this.request(`/chat/deleteMessageForEveryone/${instanceName}`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }
  }

  async updateMessage(input: UpdateProviderMessageInput) {
    const instanceName = await this.resolveInstanceName(input.instanceName, input.instancePhone);
    const number = input.number.replace(/\D/g, "");
    const remoteJid = this.whatsappRemoteJid(number);
    return this.request(`/chat/updateMessage/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({
        number,
        text: input.text,
        key: {
          remoteJid,
          fromMe: input.fromMe ?? true,
          id: input.providerId
        }
      })
    });
  }

  async sendMedia(input: SendMediaInput) {
    const instanceName = await this.resolveInstanceName(input.instanceName, input.instancePhone);
    if (input.mediatype === "audio") {
      return this.request(`/message/sendWhatsAppAudio/${instanceName}`, {
        method: "POST",
        body: JSON.stringify({
          number: input.number.replace(/\D/g, ""),
          audio: input.media,
          encoding: true
        })
      });
    }

    return this.request(`/message/sendMedia/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({
        number: input.number.replace(/\D/g, ""),
        mediatype: input.mediatype,
        mimetype: input.mimetype,
        media: input.media,
        caption: input.caption,
        fileName: input.fileName
      })
    });
  }

  async setWebhook(instanceName: string, url: string) {
    return this.request(`/webhook/set/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url,
          webhookByEvents: false,
          webhook_base64: true,
          webhookBase64: true,
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "MESSAGES_SET",
            "SEND_MESSAGE",
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED"
          ]
        }
      })
    });
  }

  async connectAndConfigureWebhook(instanceName: string, webhookUrl: string) {
    const connection = await this.connect(instanceName);
    await this.setWebhook(instanceName, webhookUrl);
    return connection;
  }

  private async request(path: string, init?: RequestInit) {
    const response = await fetch(this.url(path), {
      ...init,
      headers: {
        ...this.headers(),
        ...(init?.headers ?? {})
      }
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message = typeof data?.message === "string" ? data.message : `Evolution API error ${response.status}`;
      const detail =
        typeof data?.error === "string"
          ? data.error
          : typeof data?.response?.message === "string"
            ? data.response.message
            : text && text !== message
              ? text
              : "";
      throw new Error(detail ? `${message}: ${detail}` : message);
    }

    return data;
  }

  private isBadRequestError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return message.includes("400") || message.toLowerCase().includes("bad request");
  }
}

