import type { FastifyInstance } from "fastify";
import { requireAuth, requireUser } from "../plugins/auth";
import { requirePermission } from "../plugins/permissions";
import { createLead, deleteLead, getPipeline, listLeads, updateLead } from "../services/crm.service";
import { createLeadAttachment, deleteLeadAttachment, listLeadAttachments } from "../services/lead-attachments.service";
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

  app.get("/leads/:id/attachments", { preHandler: [requireAuth, requirePermission("crm:read")] }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    try {
      return reply.send(await listLeadAttachments(user.tenantId, id));
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel listar anexos", error instanceof Error ? error.message : error);
    }
  });

  app.post("/leads/:id/attachments", { preHandler: [requireAuth, requirePermission("lead:update")] }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    const file = await request.file();
    if (!file) return sendError(reply, 400, "Arquivo obrigatorio");
    const buffer = await file.toBuffer();
    const categoryField = file.fields?.category;
    const category =
      categoryField && typeof categoryField === "object" && "value" in categoryField
        ? String(categoryField.value)
        : undefined;
    try {
      const created = await createLeadAttachment(user.tenantId, id, user.id, {
        buffer,
        mimetype: file.mimetype,
        filename: file.filename,
        category
      });
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "LeadAttachment",
        entityId: created.id,
        action: "created",
        metadata: { leadId: id, fileName: created.fileName, category: created.category }
      });
      return reply.status(201).send(created);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel anexar arquivo", error instanceof Error ? error.message : error);
    }
  });

  app.delete("/leads/:id/attachments/:attachmentId", { preHandler: [requireAuth, requirePermission("lead:update")] }, async (request, reply) => {
    const user = requireUser(request);
    const { id, attachmentId } = request.params as { id: string; attachmentId: string };
    try {
      const removed = await deleteLeadAttachment(user.tenantId, id, attachmentId);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "LeadAttachment",
        entityId: attachmentId,
        action: "deleted",
        metadata: { leadId: id }
      });
      return reply.send(removed);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel remover anexo", error instanceof Error ? error.message : error);
    }
  });
}

