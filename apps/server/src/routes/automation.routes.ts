import type { FastifyInstance } from "fastify";
import { requireAuth, requireUser } from "../plugins/auth";
import { requirePermission } from "../plugins/permissions";
import { listAutomations, upsertAutomation, deleteAutomation } from "../services/automation.service";
import { assertPlanFeature } from "../services/billing/billing.service";
import { auditLog } from "../services/audit.service";import { sendError } from "../utils/http";

export async function automationRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [requireAuth, requirePermission("automation:read")] }, async (request, reply) => {
    const user = requireUser(request);
    return reply.send(await listAutomations(user.tenantId));
  });

  app.post("/", { preHandler: [requireAuth, requirePermission("automation:update")] }, async (request, reply) => {
    const user = requireUser(request);
    try {
      await assertPlanFeature(user.tenantId, "automations");
      const automation = await upsertAutomation(user.tenantId, null, request.body);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "Automation",
        entityId: automation.id,
        action: "created"
      });
      return reply.status(201).send(automation);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel salvar automacao", error instanceof Error ? error.message : error);
    }
  });

  app.patch("/:id", { preHandler: [requireAuth, requirePermission("automation:update")] }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    try {
      const automation = await upsertAutomation(user.tenantId, id, request.body);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "Automation",
        entityId: id,
        action: "updated"
      });
      return reply.send(automation);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel atualizar automacao", error instanceof Error ? error.message : error);
    }
  });

  app.delete("/:id", { preHandler: [requireAuth, requirePermission("automation:update")] }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    try {
      const removed = await deleteAutomation(user.tenantId, id);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "Automation",
        entityId: id,
        action: "deleted"
      });
      return reply.send(removed);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel excluir automacao", error instanceof Error ? error.message : error);
    }
  });
}
