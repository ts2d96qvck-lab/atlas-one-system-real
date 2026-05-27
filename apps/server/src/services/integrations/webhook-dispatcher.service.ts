import { createHmac } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { enqueueWebhookDelivery } from "../../lib/webhook-queue";
import type { IntegrationEventType } from "./events";

const MAX_ATTEMPTS = 5;
const RETRY_MINUTES = [1, 5, 15, 60, 240];

function signPayload(secret: string, body: string, timestamp: number) {
  const signed = `${timestamp}.${body}`;
  return createHmac("sha256", secret).update(signed).digest("hex");
}

function nextRetryAt(attempts: number) {
  const minutes = RETRY_MINUTES[Math.min(attempts, RETRY_MINUTES.length - 1)] ?? 240;
  return new Date(Date.now() + minutes * 60 * 1000);
}

async function deliverOnce(
  deliveryId: string,
  endpoint: { id: string; url: string; secret: string },
  event: string,
  payload: Record<string, unknown>
) {
  const body = JSON.stringify({
    id: deliveryId,
    event,
    createdAt: new Date().toISOString(),
    data: payload
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signPayload(endpoint.secret, body, timestamp);

  const response = await fetch(endpoint.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "Atlas-One-Webhooks/1.0",
      "x-atlas-event": event,
      "x-atlas-delivery-id": deliveryId,
      "x-atlas-timestamp": String(timestamp),
      "x-atlas-signature": `sha256=${signature}`
    },
    body,
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }

  return response.status;
}

export async function dispatchTenantWebhooks(
  tenantId: string,
  event: IntegrationEventType,
  payload: Record<string, unknown>
) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { tenantId, status: "active" }
  });

  const matching = endpoints.filter((endpoint) => {
    const events = Array.isArray(endpoint.events) ? endpoint.events.map(String) : [];
    return events.includes(event) || events.includes("*");
  });

  for (const endpoint of matching) {
    const delivery = await prisma.webhookDelivery.create({
      data: {
        tenantId,
        endpointId: endpoint.id,
        event,
        payload: payload as Prisma.InputJsonObject,
        status: "pending"
      }
    });

    void (async () => {
      const queued = await enqueueWebhookDelivery(delivery.id);
      if (!queued) await attemptDelivery(delivery.id);
    })();
  }
}

export async function attemptDelivery(deliveryId: string) {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true }
  });
  if (!delivery || delivery.status === "success") return;
  if (delivery.endpoint.status !== "active") {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: "failed", lastError: "Endpoint pausado" }
    });
    return;
  }

  const payload = delivery.payload as Record<string, unknown>;

  try {
    const responseStatus = await deliverOnce(deliveryId, delivery.endpoint, delivery.event, payload);
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "success",
        attempts: { increment: 1 },
        responseStatus,
        deliveredAt: new Date(),
        lastError: null,
        nextRetryAt: null
      }
    });
  } catch (error) {
    const attempts = delivery.attempts + 1;
    const message = error instanceof Error ? error.message : String(error);
    const failed = attempts >= MAX_ATTEMPTS;
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: failed ? "failed" : "pending",
        attempts,
        lastError: message,
        nextRetryAt: failed ? null : nextRetryAt(attempts)
      }
    });
  }
}

export async function processWebhookRetries(limit = 20) {
  const due = await prisma.webhookDelivery.findMany({
    where: {
      status: "pending",
      attempts: { gt: 0 },
      nextRetryAt: { lte: new Date() }
    },
    orderBy: { nextRetryAt: "asc" },
    take: limit,
    select: { id: true }
  });

  for (const row of due) {
    await attemptDelivery(row.id);
  }
}
