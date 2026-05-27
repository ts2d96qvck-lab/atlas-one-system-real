import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { createEvolutionProvider } from "./whatsapp/providers/evolution.provider";

export const automationSchema = z.object({
  name: z.string().min(2),
  trigger: z.string().min(2),
  enabled: z.boolean().default(true),
  config: z.record(z.unknown()).default({})
});

const automationConfigSchema = z.object({
  whenStage: z.string().optional(),
  message: z.string().optional(),
  sendType: z.enum(["text", "audit"]).default("text"),
  minLeadValue: z.coerce.number().min(0).optional(),
  onlyBusinessHours: z.boolean().optional(),
  scheduleAt: z.string().optional().nullable(),
  scheduleTime: z.string().optional().nullable()
});

type AutomationEvent =
  | "lead.stage.changed"
  | "lead.created"
  | "lead.closed"
  | "lead.lost"
  | "conversation.created"
  | "conversation.unassigned";

function normalizeWhatsAppNumber(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

function businessHoursNow() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const isWeekDay = day >= 1 && day <= 5;
  return isWeekDay && hour >= 8 && hour <= 18;
}

function hhmmNow() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function parseAutomationConfig(config: unknown) {
  const parsed = automationConfigSchema.safeParse(config ?? {});
  return parsed.success ? parsed.data : automationConfigSchema.parse({});
}

function applyTemplate(message: string, context: Record<string, string | number | null | undefined>) {
  return message.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = context[key];
    return value == null ? "" : String(value);
  });
}

function shouldRunBySchedule(config: z.infer<typeof automationConfigSchema>) {
  if (config.onlyBusinessHours && !businessHoursNow()) return false;
  if (config.scheduleAt) {
    const at = new Date(config.scheduleAt);
    if (!Number.isNaN(at.getTime()) && Date.now() < at.getTime()) return false;
  }
  if (config.scheduleTime && config.scheduleTime.length >= 5) {
    if (hhmmNow() !== config.scheduleTime.slice(0, 5)) return false;
  }
  return true;
}

async function sendAutomationText(instanceName: string, phone: string, text: string, instancePhone?: string | null) {
  const provider = createEvolutionProvider();
  const sendName = await provider.resolveInstanceName(instanceName, instancePhone ?? undefined);
  return provider.sendText({
    instanceName: sendName,
    instancePhone: instancePhone ?? undefined,
    number: normalizeWhatsAppNumber(phone),
    text
  });
}

export async function listAutomations(tenantId: string) {
  return prisma.automation.findMany({
    where: { tenantId },
    orderBy: { updatedAt: "desc" }
  });
}

export async function upsertAutomation(tenantId: string, id: string | null, input: unknown) {
  if (id) {
    const existing = await prisma.automation.findFirst({ where: { tenantId, id } });
    if (!existing) throw new Error("Automacao nao encontrada");
    const patch = automationSchema.partial().parse(input);
    return prisma.automation.update({
      where: { id },
      data: {
        name: patch.name,
        trigger: patch.trigger,
        enabled: patch.enabled,
        config: patch.config as Prisma.InputJsonValue | undefined
      }
    });
  }
  const data = automationSchema.parse(input);
  return prisma.automation.create({
    data: {
      tenantId,
      name: data.name,
      trigger: data.trigger,
      enabled: data.enabled,
      config: data.config as Prisma.InputJsonObject
    }
  });
}

export async function deleteAutomation(tenantId: string, id: string) {
  const existing = await prisma.automation.findFirst({ where: { tenantId, id } });
  if (!existing) throw new Error("Automacao nao encontrada");
  await prisma.automation.deleteMany({ where: { id, tenantId } });
  return { id };
}

export async function runLeadStageAutomations(tenantId: string, leadId: string, newStatus: string) {
  return runAutomationsByEvent(tenantId, leadId, "lead.stage.changed", { newStatus });
}

export async function runLeadEventAutomations(
  tenantId: string,
  leadId: string,
  event: "lead.created" | "lead.closed" | "lead.lost",
  context: { newStatus?: string } = {}
) {
  return runAutomationsByEvent(tenantId, leadId, event, context);
}

export async function runAutomationsByEvent(
  tenantId: string,
  leadId: string,
  event: AutomationEvent,
  context: { newStatus?: string } = {}
) {
  const rules = await prisma.automation.findMany({
    where: { tenantId, enabled: true, trigger: event }
  });

  const lead = await prisma.lead.findFirst({
    where: { tenantId, id: leadId },
    include: { conversation: { include: { instance: true } } }
  });
  if (!lead?.conversation?.instance) return { triggered: 0 };

  let triggered = 0;
  let sent = 0;
  for (const rule of rules) {
    const config = parseAutomationConfig(rule.config);
    if (event === "lead.stage.changed" && config.whenStage && config.whenStage !== context.newStatus) continue;
    if (typeof config.minLeadValue === "number" && Number(lead.value ?? 0) < config.minLeadValue) continue;
    if (!shouldRunBySchedule(config)) continue;

    let deliveryError: string | null = null;
    if (
      config.sendType !== "audit" &&
      typeof config.message === "string" &&
      config.message.trim() &&
      lead.conversation?.instance?.name &&
      lead.conversation?.customerPhone
    ) {
      const text = applyTemplate(config.message, {
        customer_name: lead.conversation.customerName,
        lead_company: lead.company,
        lead_status: context.newStatus ?? lead.status,
        lead_value: Number(lead.value ?? 0)
      }).trim();
      if (text) {
        try {
          await sendAutomationText(
            lead.conversation.instance.name,
            lead.conversation.customerPhone,
            text,
            lead.conversation.instance.phone
          );
          sent += 1;
        } catch (error) {
          deliveryError = error instanceof Error ? error.message : "Falha ao enviar mensagem automatica";
        }
      }
    }

    triggered += 1;
    await prisma.auditLog.create({
      data: {
        tenantId,
        entity: "Automation",
        entityId: rule.id,
        action: "triggered",
        metadata: {
          leadId,
          event,
          stage: context.newStatus ?? null,
          sendType: config.sendType,
          minLeadValue: config.minLeadValue ?? null,
          onlyBusinessHours: Boolean(config.onlyBusinessHours),
          message: config.message ?? null,
          scheduleAt: config.scheduleAt ?? null,
          scheduleTime: config.scheduleTime ?? null,
          deliveryError
        }
      }
    });
  }

  return { triggered, sent };
}

export async function runConversationAutomations(
  tenantId: string,
  conversationId: string,
  event: "conversation.created" | "conversation.unassigned"
) {
  const rules = await prisma.automation.findMany({
    where: { tenantId, enabled: true, trigger: event }
  });
  const conversation = await prisma.conversation.findFirst({
    where: { tenantId, id: conversationId },
    include: { instance: true, lead: true }
  });
  if (!conversation?.instance) return { triggered: 0, sent: 0 };

  let triggered = 0;
  let sent = 0;

  for (const rule of rules) {
    const config = parseAutomationConfig(rule.config);
    if (typeof config.minLeadValue === "number") {
      const currentLeadValue = Number(conversation.lead?.value ?? 0);
      if (currentLeadValue < config.minLeadValue) continue;
    }
    if (!shouldRunBySchedule(config)) continue;

    let deliveryError: string | null = null;
    if (config.sendType !== "audit" && typeof config.message === "string" && config.message.trim()) {
      const text = applyTemplate(config.message, {
        customer_name: conversation.customerName,
        lead_company: conversation.lead?.company ?? "",
        lead_status: conversation.lead?.status ?? "",
        lead_value: Number(conversation.lead?.value ?? 0)
      }).trim();
      if (text) {
        try {
          await sendAutomationText(
            conversation.instance.name,
            conversation.customerPhone,
            text,
            conversation.instance.phone
          );
          sent += 1;
        } catch (error) {
          deliveryError = error instanceof Error ? error.message : "Falha ao enviar mensagem automatica";
        }
      }
    }

    triggered += 1;
    await prisma.auditLog.create({
      data: {
        tenantId,
        entity: "Automation",
        entityId: rule.id,
        action: "triggered",
        metadata: {
          conversationId,
          event,
          sendType: config.sendType,
          minLeadValue: config.minLeadValue ?? null,
          onlyBusinessHours: Boolean(config.onlyBusinessHours),
          message: config.message ?? null,
          scheduleAt: config.scheduleAt ?? null,
          scheduleTime: config.scheduleTime ?? null,
          deliveryError
        }
      }
    });
  }

  return { triggered, sent };
}
