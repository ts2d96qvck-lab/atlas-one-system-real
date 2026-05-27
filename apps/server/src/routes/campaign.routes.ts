import type { FastifyInstance } from "fastify";
import { requireAuth, requireUser } from "../plugins/auth";
import { requirePermission } from "../plugins/permissions";
import { auditLog } from "../services/audit.service";
import {
  cancelCampaign,
  createCampaign,
  deleteCampaign,
  getCampaign,
  listCampaigns,
  pauseCampaign,
  startCampaign,
  updateCampaign
} from "../services/campaign.service";
import { sendError } from "../utils/http";

export async function campaignRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [requireAuth, requirePermission("campaign:read")] }, async (request, reply) => {
    const user = requireUser(request);
    return reply.send(await listCampaigns(user.tenantId));
  });

  app.get("/:id", { preHandler: [requireAuth, requirePermission("campaign:read")] }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    try {
      return reply.send(await getCampaign(user.tenantId, id));
    } catch (error) {
      return sendError(reply, 404, "Campanha nao encontrada", error instanceof Error ? error.message : error);
    }
  });

  app.post("/", { preHandler: [requireAuth, requirePermission("campaign:update")] }, async (request, reply) => {
    const user = requireUser(request);
    try {
      const campaign = await createCampaign(user.tenantId, user.id, request.body);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "Campaign",
        entityId: campaign.id,
        action: "created"
      });
      return reply.status(201).send(campaign);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel criar campanha", error instanceof Error ? error.message : error);
    }
  });

  app.patch("/:id", { preHandler: [requireAuth, requirePermission("campaign:update")] }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    try {
      const campaign = await updateCampaign(user.tenantId, id, request.body);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "Campaign",
        entityId: id,
        action: "updated"
      });
      return reply.send(campaign);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel atualizar campanha", error instanceof Error ? error.message : error);
    }
  });

  app.post("/:id/start", { preHandler: [requireAuth, requirePermission("campaign:update")] }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    try {
      const campaign = await startCampaign(user.tenantId, id);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "Campaign",
        entityId: id,
        action: "started"
      });
      return reply.send(campaign);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel iniciar campanha", error instanceof Error ? error.message : error);
    }
  });

  app.post("/:id/pause", { preHandler: [requireAuth, requirePermission("campaign:update")] }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    try {
      const campaign = await pauseCampaign(user.tenantId, id);
      return reply.send(campaign);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel pausar campanha", error instanceof Error ? error.message : error);
    }
  });

  app.post("/:id/cancel", { preHandler: [requireAuth, requirePermission("campaign:update")] }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    try {
      const campaign = await cancelCampaign(user.tenantId, id);
      return reply.send(campaign);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel cancelar campanha", error instanceof Error ? error.message : error);
    }
  });

  app.delete("/:id", { preHandler: [requireAuth, requirePermission("campaign:update")] }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    try {
      const removed = await deleteCampaign(user.tenantId, id);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "Campaign",
        entityId: id,
        action: "deleted"
      });
      return reply.send(removed);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel excluir campanha", error instanceof Error ? error.message : error);
    }
  });
}
