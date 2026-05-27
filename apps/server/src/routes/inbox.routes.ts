import type { FastifyInstance } from "fastify";
import { requireAuth, requireUser } from "../plugins/auth";
import { requirePermission } from "../plugins/permissions";
import { prisma } from "../lib/prisma";
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  sendMediaMessage,
  sendMessage
} from "../services/inbox.service";
import { editMessageInternal, softDeleteMessage } from "../services/messaging/message-actions.service";
import { transcribeInboundAudio } from "../services/transcription/transcription.service";
import { runConversationAutomations } from "../services/automation.service";
import { auditLog } from "../services/audit.service";
import { assertTeamInTenant, assertUserInTenant } from "../lib/tenant-guard";
import { sendError } from "../utils/http";
import {
  emitIntegrationEvent,
  publicConversationPayload
} from "../services/integrations/integration-events.service";

function normalizeWhatsAppNumber(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

export async function inboxRoutes(app: FastifyInstance) {
  function canViewAll(user: { role: string; permissions: string[] }) {
    return (
      user.role === "owner" ||
      user.role === "admin" ||
      user.permissions.includes("*") ||
      user.permissions.includes("conversation:takeover")
    );
  }

  app.get("/conversations", { preHandler: [requireAuth, requirePermission("conversation:read")] }, async (request, reply) => {
    const user = requireUser(request);
    try {
      const scope = canViewAll(user) ? undefined : { assignedToId: user.id };
      return reply.send(await listConversations(user.tenantId, scope));
    } catch {
      return reply.send([]);
    }
  });

  app.post("/conversations", { preHandler: [requireAuth, requirePermission("conversation:create")] }, async (request, reply) => {
    const user = requireUser(request);
    try {
      const actorDb = await prisma.user.findFirst({
        where: { tenantId: user.tenantId, id: user.id },
        select: { teamId: true }
      });
      const created = await createConversation(user.tenantId, request.body, {
        id: user.id,
        role: user.role,
        teamId: actorDb?.teamId ?? null
      });
      await runConversationAutomations(user.tenantId, created.id, "conversation.created");
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "Conversation",
        entityId: created.id,
        action: "created"
      });
      return reply.status(201).send(created);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel criar conversa", error instanceof Error ? error.message : error);
    }
  });

  app.get("/conversations/:id", { preHandler: [requireAuth, requirePermission("conversation:read")] }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    try {
      const scope = canViewAll(user) ? undefined : { assignedToId: user.id };
      const conversation = await getConversation(user.tenantId, id, scope);
      if (!conversation) return sendError(reply, 404, "Conversa nao encontrada");
      return reply.send(conversation);
    } catch {
      return sendError(reply, 503, "Inbox temporariamente indisponivel");
    }
  });

  app.patch("/conversations/:id", { preHandler: [requireAuth, requirePermission("conversation:update")] }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    const body = request.body as {
      assignedToId?: string | null;
      teamId?: string | null;
      status?: string;
      priority?: string;
      tags?: string[];
      customerName?: string;
      customerPhone?: string;
    };

    const conversation = await prisma.conversation.findFirst({
      where: { tenantId: user.tenantId, id }
    });
    if (!conversation) return sendError(reply, 404, "Conversa nao encontrada");
    if (!canViewAll(user) && conversation.assignedToId !== user.id) {
      return sendError(reply, 403, "Voce nao tem acesso a este atendimento");
    }

    try {
      await assertUserInTenant(user.tenantId, body.assignedToId ?? undefined);
      await assertTeamInTenant(user.tenantId, body.teamId ?? undefined);
    } catch (error) {
      return sendError(reply, 400, error instanceof Error ? error.message : "Referencia invalida");
    }

    const updated = await prisma.conversation.updateMany({
      where: { id, tenantId: user.tenantId },
      data: {
        assignedToId: body.assignedToId,
        teamId: body.teamId,
        status: body.status,
        priority: body.priority,
        tags: body.tags,
        customerName: body.customerName?.trim() || undefined,
        customerPhone: body.customerPhone ? normalizeWhatsAppNumber(body.customerPhone) : undefined
      }
    });
    if (!updated.count) return sendError(reply, 404, "Conversa nao encontrada");

    const refreshed = await prisma.conversation.findFirst({
      where: { tenantId: user.tenantId, id },
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        team: { select: { id: true, name: true } },
        instance: { select: { id: true, name: true, label: true, status: true } },
        lead: { select: { id: true, company: true, status: true, value: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });
    if (!refreshed) return sendError(reply, 404, "Conversa nao encontrada");
    await auditLog({
      tenantId: user.tenantId,
      actorId: user.id,
      entity: "Conversation",
      entityId: refreshed.id,
      action: "updated",
      metadata: {
        assignedToId: body.assignedToId ?? null,
        teamId: body.teamId ?? null,
        status: body.status ?? null,
        priority: body.priority ?? null,
        customerName: body.customerName ?? null,
        customerPhone: body.customerPhone ?? null
      }
    });

    if (conversation.assignedToId && body.assignedToId === null) {
      await runConversationAutomations(user.tenantId, refreshed.id, "conversation.unassigned");
    }

    const closedStatuses = new Set(["closed", "resolved"]);
    if (body.status && closedStatuses.has(body.status) && !closedStatuses.has(conversation.status)) {
      emitIntegrationEvent(user.tenantId, "conversation.closed", publicConversationPayload(refreshed));
    }

    return reply.send(refreshed);
  });

  app.delete("/conversations/:id", { preHandler: [requireAuth, requirePermission("conversation:update")] }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    try {
      const removed = await deleteConversation(user.tenantId, id);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "Conversation",
        entityId: id,
        action: "deleted"
      });
      return reply.send(removed);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel excluir contato", error instanceof Error ? error.message : error);
    }
  });

  app.post("/conversations/:id/messages", { preHandler: [requireAuth, requirePermission("conversation:reply")] }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    try {
      const message = await sendMessage(user.tenantId, id, request.body as { text: string; replyToMessageId?: string }, {
        id: user.id,
        name: user.name,
        role: user.role
      });
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "Message",
        entityId: message.id,
        action: "sent_text"
      });
      return reply.status(201).send(message);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel enviar mensagem", error instanceof Error ? error.message : error);
    }
  });

  app.post("/conversations/:id/messages/media", { preHandler: [requireAuth, requirePermission("conversation:reply")] }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    const file = await request.file();
    if (!file) return sendError(reply, 400, "Arquivo obrigatorio");
    const buffer = await file.toBuffer();
    const captionField = file.fields?.caption;
    const caption =
      captionField && typeof captionField === "object" && "value" in captionField
        ? String(captionField.value)
        : undefined;
    try {
      const message = await sendMediaMessage(
        user.tenantId,
        id,
        { buffer, mimetype: file.mimetype, filename: file.filename },
        caption,
        {
          id: user.id,
          name: user.name,
          role: user.role
        }
      );
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "Message",
        entityId: message.id,
        action: "sent_media",
        metadata: { filename: file.filename, mimetype: file.mimetype }
      });
      return reply.status(201).send(message);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel enviar midia", error instanceof Error ? error.message : error);
    }
  });

  app.patch(
    "/conversations/:conversationId/messages/:messageId",
    { preHandler: [requireAuth, requirePermission("conversation:reply")] },
    async (request, reply) => {
      const user = requireUser(request);
      const { conversationId, messageId } = request.params as { conversationId: string; messageId: string };
      const body = request.body as { text?: string };
      if (!body.text) return sendError(reply, 400, "Texto obrigatorio");
      try {
        const updated = await editMessageInternal(user.tenantId, conversationId, messageId, body.text, {
          id: user.id,
          name: user.name,
          role: user.role
        });
        await auditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          entity: "Message",
          entityId: messageId,
          action: "updated",
          metadata: { mode: "whatsapp_sync" }
        });
        return reply.send(updated);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel editar mensagem", error instanceof Error ? error.message : error);
      }
    }
  );

  app.delete(
    "/conversations/:conversationId/messages/:messageId",
    { preHandler: [requireAuth, requirePermission("conversation:reply")] },
    async (request, reply) => {
      const user = requireUser(request);
      const { conversationId, messageId } = request.params as { conversationId: string; messageId: string };
      try {
        const updated = await softDeleteMessage(user.tenantId, conversationId, messageId, {
          id: user.id,
          name: user.name,
          role: user.role
        });
        await auditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          entity: "Message",
          entityId: messageId,
          action: "deleted",
          metadata: { mode: "whatsapp_sync" }
        });
        return reply.send(updated);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel apagar mensagem", error instanceof Error ? error.message : error);
      }
    }
  );

  app.post(
    "/conversations/:conversationId/messages/:messageId/transcribe",
    { preHandler: [requireAuth, requirePermission("conversation:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      const { messageId } = request.params as { messageId: string };
      try {
        const updated = await transcribeInboundAudio(user.tenantId, messageId);
        return reply.send(updated);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel transcrever audio", error instanceof Error ? error.message : error);
      }
    }
  );
}

