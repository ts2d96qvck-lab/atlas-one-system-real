import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { runLeadEventAutomations, runLeadStageAutomations } from "./automation.service";
import { validateLeadRelations } from "../lib/tenant-guard";
import {
  emitIntegrationEvent,
  publicLeadPayload
} from "./integrations/integration-events.service";
import { leadStatusEvent } from "./integrations/events";

export const upsertLeadSchema = z.object({
  company: z.string().min(1),
  contact: z.string().min(1),
  phone: z.string().min(10),
  email: z.string().email().optional().or(z.literal("")),
  origin: z.string().default("WhatsApp"),
  status: z.string().default("Novos leads"),
  value: z.coerce.number().default(0),
  assignedToId: z.string().optional(),
  teamId: z.string().optional(),
  conversationId: z.string().optional(),
  expectedCloseDate: z.string().datetime().optional().or(z.literal("")),
  customFields: z.record(z.unknown()).default({})
});

export async function listLeads(tenantId: string) {
  return prisma.lead.findMany({
    where: { tenantId },
    include: {
      assignedTo: { select: { id: true, name: true, role: true } },
      conversation: { select: { id: true, customerName: true, customerPhone: true, status: true } }
    },
    orderBy: { updatedAt: "desc" }
  });
}

export async function createLead(tenantId: string, input: unknown) {
  const data = upsertLeadSchema.parse(input);
  await validateLeadRelations(tenantId, data);
  const lead = await prisma.lead.create({
    data: {
      tenantId,
      company: data.company,
      contact: data.contact,
      phone: data.phone.replace(/\D/g, ""),
      email: data.email || null,
      origin: data.origin,
      status: data.status,
      value: data.value,
      assignedToId: data.assignedToId,
      teamId: data.teamId,
      conversationId: data.conversationId,
      expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
      customFields: data.customFields as Prisma.InputJsonObject
    }
  });
  await runLeadEventAutomations(tenantId, lead.id, "lead.created", { newStatus: data.status });
  await runLeadStageAutomations(tenantId, lead.id, data.status);
  emitIntegrationEvent(tenantId, "lead.created", publicLeadPayload(lead));
  return lead;
}

export async function updateLead(tenantId: string, id: string, input: unknown) {
  const data = upsertLeadSchema.partial().parse(input);
  const existing = await prisma.lead.findFirst({ where: { tenantId, id } });
  if (!existing) throw new Error("Lead nao encontrado");

  const updateData: Prisma.LeadUncheckedUpdateInput = {};

  if (data.company !== undefined) updateData.company = data.company;
  if (data.contact !== undefined) updateData.contact = data.contact;
  if (data.phone !== undefined) updateData.phone = data.phone.replace(/\D/g, "");
  if (data.email !== undefined) updateData.email = data.email === "" ? null : data.email;
  if (data.origin !== undefined) updateData.origin = data.origin;
  if (data.status !== undefined) {
    updateData.status = data.status;
  }
  if (data.value !== undefined) updateData.value = data.value;
  if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId;
  if (data.teamId !== undefined) updateData.teamId = data.teamId;
  if (data.conversationId !== undefined) updateData.conversationId = data.conversationId;

  await validateLeadRelations(tenantId, {
    assignedToId: data.assignedToId,
    teamId: data.teamId,
    conversationId: data.conversationId
  });
  if (data.expectedCloseDate !== undefined) {
    updateData.expectedCloseDate = data.expectedCloseDate ? new Date(data.expectedCloseDate) : null;
  }
  if (data.customFields !== undefined) updateData.customFields = data.customFields as Prisma.InputJsonObject;

  if (data.status !== undefined) {
    const normalized = data.status.toLowerCase();
    if (normalized.includes("fechado")) {
      updateData.closedAt = new Date();
      updateData.lostAt = null;
    } else if (normalized.includes("perdido")) {
      updateData.lostAt = new Date();
      updateData.closedAt = null;
    } else {
      updateData.closedAt = null;
      updateData.lostAt = null;
    }
  }

  const lead = await prisma.lead.updateMany({
    where: { id, tenantId },
    data: updateData
  });
  if (!lead.count) throw new Error("Lead nao encontrado");

  const updated = await prisma.lead.findFirst({ where: { tenantId, id } });
  if (!updated) throw new Error("Lead nao encontrado");

  if (data.status) {
    await runLeadStageAutomations(tenantId, id, data.status);
    const normalized = data.status.toLowerCase();
    if (normalized.includes("fechado")) {
      await runLeadEventAutomations(tenantId, id, "lead.closed", { newStatus: data.status });
    } else if (normalized.includes("perdido")) {
      await runLeadEventAutomations(tenantId, id, "lead.lost", { newStatus: data.status });
    }
  }

  emitIntegrationEvent(tenantId, "lead.updated", publicLeadPayload(updated));
  const statusEvent = data.status ? leadStatusEvent(data.status) : null;
  if (statusEvent) {
    emitIntegrationEvent(tenantId, statusEvent, publicLeadPayload(updated));
  }

  return updated;
}

export async function deleteLead(tenantId: string, id: string) {
  const existing = await prisma.lead.findFirst({ where: { tenantId, id } });
  if (!existing) throw new Error("Lead nao encontrado");

  await prisma.lead.deleteMany({ where: { id, tenantId } });
  return { id };
}

export async function getPipeline(tenantId: string) {
  const pipeline = await prisma.pipeline.findFirst({
    where: { tenantId },
    include: { stages: { orderBy: { order: "asc" } } }
  });
  const leads = await listLeads(tenantId);
  return { pipeline, leads };
}
