import { createEvolutionProvider } from "./whatsapp/providers/evolution.provider";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function normalizeWhatsAppNumber(raw: string) {
  const digits = normalizePhone(raw);
  if (!digits) return "";
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

function phoneCandidates(raw: string) {
  const normalized = normalizeWhatsAppNumber(raw);
  const set = new Set<string>();
  if (!normalized) return [];
  set.add(normalized);

  const withNoCountry = normalized.startsWith("55") ? normalized.slice(2) : normalized;
  if (withNoCountry) {
    set.add(withNoCountry);
    set.add(`55${withNoCountry}`);
  }

  if (withNoCountry.length === 10) {
    const withNine = `${withNoCountry.slice(0, 2)}9${withNoCountry.slice(2)}`;
    set.add(withNine);
    set.add(`55${withNine}`);
  }
  if (withNoCountry.length === 11 && withNoCountry[2] === "9") {
    const withoutNine = `${withNoCountry.slice(0, 2)}${withNoCountry.slice(3)}`;
    set.add(withoutNine);
    set.add(`55${withoutNine}`);
  }

  return Array.from(set).filter(Boolean);
}

function normalizeE164(phone: string) {
  const digits = normalizePhone(phone);
  if (!digits) return "";
  if (digits.startsWith("55")) return `+${digits}`;
  return `+55${digits}`;
}

export function maskPhone(phone: string) {
  const digits = normalizePhone(phone);
  if (digits.length < 6) return "***";
  return `${digits.slice(0, 2)}*****${digits.slice(-2)}`;
}

export function otpDeliversForReal() {
  return (
    env.smsProvider === "twilio" ||
    (env.smsProvider === "webhook" && Boolean(env.smsWebhookUrl)) ||
    env.smsProvider === "whatsapp" ||
    env.smsProvider === "console"
  );
}

export function otpDeliveryLabel() {
  if (env.smsProvider === "twilio" || env.smsProvider === "webhook") return "SMS";
  return "WhatsApp";
}

async function fetchEvolutionOpenInstanceName() {
  const cached = (globalThis as { __atlasEvolutionInstance?: { name: string; expiresAt: number } }).__atlasEvolutionInstance;
  if (cached && cached.expiresAt > Date.now()) return cached.name;

  try {
    const response = await fetch(`${env.evolutionUrl}/instance/fetchInstances`, {
      headers: { apikey: env.evolutionApiKey }
    });
    if (!response.ok) return null;
    const instances = (await response.json()) as Array<{ name?: string; connectionStatus?: string }>;
    const open = instances.find((item) => String(item.connectionStatus ?? "").toLowerCase() === "open");
    const name = open?.name ?? instances[0]?.name ?? null;
    if (name) {
      (globalThis as { __atlasEvolutionInstance?: { name: string; expiresAt: number } }).__atlasEvolutionInstance = {
        name,
        expiresAt: Date.now() + 60_000
      };
    }
    return name;
  } catch {
    return null;
  }
}

async function resolveOtpInstance(tenantId?: string) {
  const evolutionName = await fetchEvolutionOpenInstanceName();
  if (evolutionName) {
    return { name: evolutionName };
  }

  if (tenantId) {
    const connected = await prisma.whatsAppInstance.findFirst({
      where: {
        tenantId,
        status: { in: ["open", "connected", "OPEN", "CONNECTED"] }
      },
      orderBy: { updatedAt: "desc" }
    });
    if (connected) return connected;

    const tenantInstance = await prisma.whatsAppInstance.findFirst({
      where: { tenantId },
      orderBy: { updatedAt: "desc" }
    });
    if (tenantInstance) return tenantInstance;
  }

  const defaultInstance = await prisma.whatsAppInstance.findFirst({
    where: { name: env.defaultInstance }
  });
  if (defaultInstance) return defaultInstance;

  return prisma.whatsAppInstance.findFirst({
    where: { status: { in: ["open", "connected", "OPEN", "CONNECTED"] } },
    orderBy: { updatedAt: "desc" }
  });
}

async function sendViaWhatsApp(phone: string, text: string, tenantId?: string) {
  const instance = await resolveOtpInstance(tenantId);
  if (!instance) {
    throw new Error("WhatsApp nao conectado. Conecte a instancia comercial antes de usar verificacao por codigo.");
  }

  const provider = createEvolutionProvider();
  const instancePhone = "phone" in instance ? instance.phone ?? undefined : undefined;
  const evolutionName = await provider.resolveInstanceName(instance.name, instancePhone);

  const primary = normalizeWhatsAppNumber(phone);
  const candidates = primary ? [primary, ...phoneCandidates(phone).filter((item) => item !== primary)] : phoneCandidates(phone);

  let lastError: unknown = null;
  for (const number of candidates) {
    try {
      await provider.sendText({
        instanceName: evolutionName,
        instancePhone,
        number,
        text
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError ?? "erro desconhecido");
  throw new Error(`Nao foi possivel enviar codigo pelo WhatsApp: ${message}`);
}

export async function sendSms(phone: string, text: string, options?: { tenantId?: string }) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error("Telefone invalido para envio de SMS");

  if (env.smsProvider === "twilio") {
    if (!env.smsTwilioSid || !env.smsTwilioToken || !env.smsTwilioFrom) {
      throw new Error("Twilio nao configurado. Defina SMS_TWILIO_SID, SMS_TWILIO_TOKEN e SMS_TWILIO_FROM.");
    }
    const body = new URLSearchParams({
      To: normalizeE164(normalized),
      From: env.smsTwilioFrom,
      Body: text
    });
    const basic = Buffer.from(`${env.smsTwilioSid}:${env.smsTwilioToken}`).toString("base64");
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.smsTwilioSid}/Messages.json`, {
      method: "POST",
      headers: {
        authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body
    });
    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(`Falha ao enviar SMS no Twilio${details ? `: ${details}` : ""}`);
    }
    return;
  }

  if (env.smsProvider === "webhook" && env.smsWebhookUrl) {
    const response = await fetch(env.smsWebhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: env.smsApiToken ? `Bearer ${env.smsApiToken}` : ""
      },
      body: JSON.stringify({
        to: normalized,
        from: env.smsFrom,
        message: text
      })
    });
    if (!response.ok) throw new Error("Falha ao enviar SMS no provedor configurado");
    return;
  }

  if (env.smsProvider === "whatsapp" || env.smsProvider === "console") {
    await sendViaWhatsApp(phone, text, options?.tenantId);
    return;
  }

  if (env.enterpriseMode && !env.allowLocalSms) {
    throw new Error("Provedor de SMS nao configurado para producao.");
  }

  console.log(`[SMS:${env.smsProvider}] -> ${normalized}: ${text}`);
}
