import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { INTEGRATION_EVENTS, isIntegrationEvent } from "./events";

const upsertSchema = z.object({
  name: z.string().min(2).max(80).default("Webhook"),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  status: z.enum(["active", "paused"]).optional()
});

function normalizeEvents(events: string[]) {
  const unique = [...new Set(events.map((e) => e.trim()))];
  for (const event of unique) {
    if (!isIntegrationEvent(event)) {
      throw new Error(`Evento invalido: ${event}`);
    }
  }
  return unique;
}

function generateWebhookSecret() {
  return randomBytes(32).toString("hex");
}

export async function listWebhookEndpoints(tenantId: string) {
  return prisma.webhookEndpoint.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      url: true,
      events: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function createWebhookEndpoint(tenantId: string, input: unknown) {
  const data = upsertSchema.parse(input);
  const events = normalizeEvents(data.events);
  const secret = generateWebhookSecret();
  const row = await prisma.webhookEndpoint.create({
    data: {
      tenantId,
      name: data.name,
      url: data.url,
      secret,
      events,
      status: data.status ?? "active"
    }
  });
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    events: row.events,
    status: row.status,
    secret,
    createdAt: row.createdAt
  };
}

export async function updateWebhookEndpoint(tenantId: string, id: string, input: unknown) {
  const data = upsertSchema.partial().parse(input);
  const existing = await prisma.webhookEndpoint.findFirst({ where: { tenantId, id } });
  if (!existing) throw new Error("Webhook nao encontrado");

  const row = await prisma.webhookEndpoint.update({
    where: { id },
    data: {
      name: data.name,
      url: data.url,
      events: data.events ? normalizeEvents(data.events) : undefined,
      status: data.status
    }
  });
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    events: row.events,
    status: row.status,
    updatedAt: row.updatedAt
  };
}

export async function deleteWebhookEndpoint(tenantId: string, id: string) {
  const removed = await prisma.webhookEndpoint.deleteMany({ where: { tenantId, id } });
  if (!removed.count) throw new Error("Webhook nao encontrado");
  return { id };
}

export async function listWebhookDeliveries(tenantId: string, limit = 50) {
  return prisma.webhookDelivery.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
    include: {
      endpoint: { select: { id: true, name: true, url: true } }
    }
  });
}

export function listAvailableEvents() {
  return [...INTEGRATION_EVENTS];
}
