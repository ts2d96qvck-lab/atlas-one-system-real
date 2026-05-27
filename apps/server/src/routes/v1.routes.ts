import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import { requireApiKey, requireApiScope, requireApiTenant } from "../plugins/api-key-auth";
import { assertPlanFeature } from "../services/billing/billing.service";
import { listLeads, createLead, updateLead } from "../services/crm.service";
import { listConversations, getConversation } from "../services/inbox.service";
import { exportLeadsCsv, exportConversationsCsv, exportMessagesCsv } from "../services/ops/export.service";
import { auditLog, auditDataExport, AUDIT_ACTIONS } from "../services/audit.service";
import { emitIntegrationEvent, publicLeadPayload } from "../services/integrations/integration-events.service";
import { openApiV1Spec } from "../openapi/v1-spec";
import { prisma } from "../lib/prisma";
import { sendError } from "../utils/http";

const eventSchema = z.object({
  event: z.string().min(2).max(80),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  data: z.record(z.unknown()).default({})
});

export async function v1Routes(app: FastifyInstance) {
  await app.register(async (v1) => {
    await v1.register(rateLimit, { max: 120, timeWindow: "1 minute" });

    v1.get("/openapi.json", async (_request, reply) => {
      return reply.send(openApiV1Spec());
    });

    async function assertPublicApiPlan(request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) {
      const ctx = request.apiKey;
      if (!ctx) return;
      try {
        await assertPlanFeature(ctx.tenantId, "publicApi");
      } catch (error) {
        return sendError(reply, 403, "Plano insuficiente", error instanceof Error ? error.message : error);
      }
    }

    const readGuard = [requireApiKey, requireApiScope("read"), assertPublicApiPlan];
    const writeGuard = [requireApiKey, requireApiScope("write"), assertPublicApiPlan];

    v1.get("/leads", { preHandler: readGuard }, async (request, reply) => {
      const ctx = requireApiTenant(request);
      const leads = await listLeads(ctx.tenantId);
      return reply.send({ data: leads.map(publicLeadPayload) });
    });

    v1.post("/leads", { preHandler: writeGuard }, async (request, reply) => {
      const ctx = requireApiTenant(request);
      try {
        const lead = await createLead(ctx.tenantId, request.body);
        return reply.status(201).send({ data: publicLeadPayload(lead) });
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel criar lead", error instanceof Error ? error.message : error);
      }
    });

    v1.patch("/leads/:id", { preHandler: writeGuard }, async (request, reply) => {
      const ctx = requireApiTenant(request);
      const { id } = request.params as { id: string };
      try {
        const lead = await updateLead(ctx.tenantId, id, request.body);
        return reply.send({ data: publicLeadPayload(lead) });
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel atualizar lead", error instanceof Error ? error.message : error);
      }
    });

    v1.get("/conversations", { preHandler: readGuard }, async (request, reply) => {
      const ctx = requireApiTenant(request);
      const query = request.query as { status?: string; limit?: string };
      const limit = Math.min(100, Math.max(1, Number(query.limit ?? 50) || 50));
      const rows = await listConversations(ctx.tenantId);
      const filtered = query.status ? rows.filter((row) => row.status === query.status) : rows;
      return reply.send({ data: filtered.slice(0, limit) });
    });

    v1.get("/conversations/:id", { preHandler: readGuard }, async (request, reply) => {
      const ctx = requireApiTenant(request);
      const { id } = request.params as { id: string };
      const conversation = await getConversation(ctx.tenantId, id);
      if (!conversation) return sendError(reply, 404, "Conversa nao encontrada");
      return reply.send({ data: conversation });
    });

    v1.get("/conversations/:id/messages", { preHandler: readGuard }, async (request, reply) => {
      const ctx = requireApiTenant(request);
      const { id } = request.params as { id: string };
      const query = request.query as { limit?: string; cursor?: string };
      const limit = Math.min(200, Math.max(1, Number(query.limit ?? 50) || 50));

      const conversation = await prisma.conversation.findFirst({
        where: { tenantId: ctx.tenantId, id }
      });
      if (!conversation) return sendError(reply, 404, "Conversa nao encontrada");

      const messages = await prisma.message.findMany({
        where: {
          conversationId: id,
          ...(query.cursor ? { id: { lt: query.cursor } } : {})
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1
      });

      const hasMore = messages.length > limit;
      const page = hasMore ? messages.slice(0, limit) : messages;
      return reply.send({
        data: page.reverse(),
        nextCursor: hasMore ? page[0]?.id ?? null : null
      });
    });

    v1.post("/events", { preHandler: writeGuard }, async (request, reply) => {
      const ctx = requireApiTenant(request);
      try {
        const body = eventSchema.parse(request.body);
        const eventName = body.event.startsWith("commercial.") ? body.event : `commercial.${body.event}`;

        await auditLog({
          tenantId: ctx.tenantId,
          actorId: null,
          entity: body.entityType ?? "IntegrationEvent",
          entityId: body.entityId ?? null,
          action: AUDIT_ACTIONS.COMMERCIAL_EVENT,
          metadata: { event: eventName, source: "public_api", ...body.data }
        });

        emitIntegrationEvent(ctx.tenantId, "commercial.event", {
          event: eventName,
          entityType: body.entityType ?? null,
          entityId: body.entityId ?? null,
          data: body.data,
          source: "public_api"
        });

        return reply.status(201).send({ ok: true, event: eventName });
      } catch (error) {
        return sendError(reply, 400, "Evento invalido", error instanceof Error ? error.message : error);
      }
    });

    v1.get("/export/leads.csv", { preHandler: readGuard }, async (request, reply) => {
      const ctx = requireApiTenant(request);
      const csv = await exportLeadsCsv(ctx.tenantId, { userId: ctx.id, role: "api_key" });
      await auditDataExport(ctx.tenantId, null, "leads.csv", { source: "public_api", apiKeyId: ctx.id, apiKeyName: ctx.name });
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", 'attachment; filename="atlas-leads.csv"');
      return reply.send(csv);
    });

    v1.get("/export/conversations.csv", { preHandler: readGuard }, async (request, reply) => {
      const ctx = requireApiTenant(request);
      const csv = await exportConversationsCsv(ctx.tenantId, { userId: ctx.id, role: "api_key" });
      await auditDataExport(ctx.tenantId, null, "conversations.csv", { source: "public_api", apiKeyId: ctx.id, apiKeyName: ctx.name });
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", 'attachment; filename="atlas-conversas.csv"');
      return reply.send(csv);
    });

    v1.get("/export/messages.csv", { preHandler: readGuard }, async (request, reply) => {
      const ctx = requireApiTenant(request);
      const query = request.query as { from?: string; to?: string };
      const from = query.from ? new Date(query.from) : undefined;
      const to = query.to ? new Date(query.to) : undefined;
      const csv = await exportMessagesCsv(
        ctx.tenantId,
        { userId: ctx.id, role: "api_key" },
        {
          from: from && !Number.isNaN(from.getTime()) ? from : undefined,
          to: to && !Number.isNaN(to.getTime()) ? to : undefined
        }
      );
      await auditDataExport(ctx.tenantId, null, "messages.csv", {
        source: "public_api",
        apiKeyId: ctx.id,
        apiKeyName: ctx.name,
        from: query.from,
        to: query.to
      });
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", 'attachment; filename="atlas-mensagens.csv"');
      return reply.send(csv);
    });

    v1.get("/events/catalog", { preHandler: readGuard }, async (_request, reply) => {
      return reply.send({
        events: [
          "conversation.created",
          "conversation.closed",
          "message.created",
          "lead.created",
          "lead.updated",
          "deal.won",
          "deal.lost",
          "commercial.event"
        ]
      });
    });
  });
}
