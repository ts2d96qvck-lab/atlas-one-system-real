import type { FastifyInstance } from "fastify";
import { requireAuth, requireUser } from "../plugins/auth";
import { requirePermission } from "../plugins/permissions";
import { createLead, deleteLead, getPipeline, listLeads, updateLead } from "../services/crm.service";
import { auditLog } from "../services/audit.service";
import { sendError } from "../utils/http";

export async function crmRoutes(app: FastifyInstance) {
  app.get("/pipeline", { preHandler: [requireAuth, requirePermission("crm:read")] }, async (request, reply) => {
    const user = requireUser(request);
    return reply.send(await getPipeline(user.tenantId));
  });

  app.get("/leads", { preHandler: [requireAuth, requirePermission("crm:read")] }, async (request, reply) => {
    const user = requireUser(request);
    return reply.send(await listLeads(user.tenantId));
  });

  app.post("/leads", { preHandler: [requireAuth, requirePermission("lead:create")] }, async (request, reply) => {
    const user = requireUser(request);
    try {
      const lead = await createLead(user.tenantId, request.body);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "Lead",
        entityId: lead.id,
        action: "created"
      });
      return reply.status(201).send(lead);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel criar lead", error instanceof Error ? error.message : error);
    }
  });

  app.patch("/leads/:id", { preHandler: [requireAuth, requirePermission("lead:update")] }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    try {
      const lead = await updateLead(user.tenantId, id, request.body);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "Lead",
        entityId: id,
        action: "updated"
      });
      return reply.send(lead);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel atualizar lead", error instanceof Error ? error.message : error);
    }
  });

  app.delete("/leads/:id", { preHandler: [requireAuth, requirePermission("lead:update")] }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    try {
      const removed = await deleteLead(user.tenantId, id);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "Lead",
        entityId: id,
        action: "deleted"
      });
      return reply.send(removed);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel excluir lead", error instanceof Error ? error.message : error);
    }
  });
}

