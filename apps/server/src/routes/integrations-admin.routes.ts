import type { FastifyInstance } from "fastify";
import { requireAuth, requireUser } from "../plugins/auth";
import { requireRole } from "../plugins/roles";
import { requirePermission } from "../plugins/permissions";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey
} from "../services/integrations/api-key.service";
import { assertPlanFeature } from "../services/billing/billing.service";
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  listAvailableEvents,
  listWebhookDeliveries,
  listWebhookEndpoints,
  updateWebhookEndpoint
} from "../services/integrations/webhook-endpoint.service";
import { auditLog, AUDIT_ACTIONS } from "../services/audit.service";
import { sendError } from "../utils/http";

export async function integrationsAdminRoutes(app: FastifyInstance) {
  const readGuard = [requireAuth, requireRole("admin", "owner"), requirePermission("admin:read")];
  const writeGuard = [requireAuth, requireRole("admin", "owner"), requirePermission("admin:user:update")];

  app.get("/api-keys", { preHandler: readGuard }, async (request, reply) => {
    const user = requireUser(request);
    return reply.send(await listApiKeys(user.tenantId));
  });

  app.post("/api-keys", { preHandler: writeGuard }, async (request, reply) => {
    const user = requireUser(request);
    try {
      await assertPlanFeature(user.tenantId, "publicApi");
      const created = await createApiKey(user.tenantId, user.id, request.body);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "ApiKey",
        entityId: created.id,
        action: AUDIT_ACTIONS.API_KEY_CREATED,
        metadata: { name: created.name, keyPrefix: created.keyPrefix }
      });
      return reply.status(201).send(created);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel criar chave API", error instanceof Error ? error.message : error);
    }
  });

  app.delete("/api-keys/:id", { preHandler: writeGuard }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    try {
      const removed = await revokeApiKey(user.tenantId, id);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "ApiKey",
        entityId: id,
        action: AUDIT_ACTIONS.API_KEY_REVOKED
      });
      return reply.send(removed);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel revogar chave API", error instanceof Error ? error.message : error);
    }
  });

  app.get("/webhooks", { preHandler: readGuard }, async (request, reply) => {
    const user = requireUser(request);
    return reply.send(await listWebhookEndpoints(user.tenantId));
  });

  app.get("/webhooks/events", { preHandler: readGuard }, async (_request, reply) => {
    return reply.send({ events: listAvailableEvents() });
  });

  app.post("/webhooks", { preHandler: writeGuard }, async (request, reply) => {
    const user = requireUser(request);
    try {
      await assertPlanFeature(user.tenantId, "webhooks");
      const created = await createWebhookEndpoint(user.tenantId, request.body);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "WebhookEndpoint",
        entityId: created.id,
        action: AUDIT_ACTIONS.WEBHOOK_CREATED,
        metadata: { url: created.url, events: created.events }
      });
      return reply.status(201).send(created);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel criar webhook", error instanceof Error ? error.message : error);
    }
  });

  app.patch("/webhooks/:id", { preHandler: writeGuard }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    try {
      const updated = await updateWebhookEndpoint(user.tenantId, id, request.body);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "WebhookEndpoint",
        entityId: id,
        action: AUDIT_ACTIONS.WEBHOOK_UPDATED
      });
      return reply.send(updated);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel atualizar webhook", error instanceof Error ? error.message : error);
    }
  });

  app.delete("/webhooks/:id", { preHandler: writeGuard }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    try {
      const removed = await deleteWebhookEndpoint(user.tenantId, id);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "WebhookEndpoint",
        entityId: id,
        action: AUDIT_ACTIONS.WEBHOOK_DELETED
      });
      return reply.send(removed);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel excluir webhook", error instanceof Error ? error.message : error);
    }
  });

  app.get("/webhooks/deliveries", { preHandler: readGuard }, async (request, reply) => {
    const user = requireUser(request);
    const query = request.query as { limit?: string };
    const limit = Math.min(200, Number(query.limit ?? 50) || 50);
    return reply.send(await listWebhookDeliveries(user.tenantId, limit));
  });
}
