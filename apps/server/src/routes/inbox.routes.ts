import type { FastifyInstance } from "fastify";
import { requireAuth, requireUser } from "../plugins/auth";
import { requirePermission } from "../plugins/permissions";
import { prisma } from "../lib/prisma";
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  bulkUpdateConversations,
  sendMediaMessage,
  sendMessage
} from "../services/inbox.service";
import { editMessageInternal, hideMessage, sanitizeMessageForActor } from "../services/messaging/message-actions.service";
import { transcribeInboundAudio } from "../services/transcription/transcription.service";
import { runConversationAutomations } from "../services/automation.service";
import { auditLog } from "../services/audit.service";
import { assertTeamInTenant, assertUserInTenant } from "../lib/tenant-guard";
import { sendError } from "../utils/http";
import { appLog } from "../lib/app-log";
import {
  emitIntegrationEvent,
  publicConversationPayload
} from "../services/integrations/integration-events.service";
import { listShortcuts } from "../services/admin.service";
import { listInboxTags, saveInboxTags } from "../services/inbox-tags.service";
import {
  createInternalNote,
  listConversationActivity,
  recordConversationTransfer
} from "../services/inbox-collaboration.service";
import { requireRole } from "../plugins/roles";

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

  app.get("/shortcuts", { preHandler: [requireAuth, requirePermission("conversation:read")] }, async (request, reply) => {
    const user = requireUser(request);
    return reply.send(await listShortcuts(user.tenantId));
  });

  app.get("/tags", { preHandler: [requireAuth, requirePermission("conversation:read")] }, async (request, reply) => {
    const user = requireUser(request);
    return reply.send(await listInboxTags(user.tenantId));
  });

  app.put(
    "/tags",
    {
      preHandler: [
        requireAuth,
        requirePermission("conversation:update"),
        requireRole("admin", "owner", "supervisor")
      ]
    },
    async (request, reply) => {
      const user = requireUser(request);
      try {
        const saved = await saveInboxTags(user.tenantId, request.body);
        await auditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          entity: "TenantSettings",
          entityId: user.tenantId,
          action: "tags_updated",
          metadata: { count: saved.length }
        });
        return reply.send(saved);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel salvar tags", error instanceof Error ? error.message : error);
      }
    }
  );

  app.get("/conversations", { preHandler: [requireAuth, requirePermission("conversation:read")] }, async (request, reply) => {
    const user = requireUser(request);
    try {
      const query = request.query as { bucket?: string };
      const bucket: "active" | "history" | "all" =
        query.bucket === "active" || query.bucket === "history" || query.bucket === "all" ? query.bucket : "all";
      const scope = canViewAll(user) ? { bucket } : { assignedToId: user.id, bucket };
      return reply.send(await listConversations(user.tenantId, scope));
    } catch {
      return reply.send([]);
    }
  });

  app.post(
    "/conversations/bulk",
    { preHandler: [requireAuth, requirePermission("conversation:update")] },
    async (request, reply) => {
      const user = requireUser(request);
      const body = request.body as {
        ids?: string[];
        assignedToId?: string | null;
        teamId?: string | null;
        status?: string;
        addTags?: string[];
        archive?: boolean;
        transferNote?: string;
      };
      try {
        const result = await bulkUpdateConversations(user.tenantId, user, {
          ids: Array.isArray(body.ids) ? body.ids : [],
          assignedToId: body.assignedToId,
          teamId: body.teamId,
          status: body.status,
          addTags: body.addTags,
          archive: body.archive,
          transferNote: body.transferNote
        });
        return reply.send(result);
      } catch (error) {
        return sendError(
          reply,
          400,
          "Nao foi possivel atualizar conversas em lote",
          error instanceof Error ? error.message : error
        );
      }
    }
  );

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
      const actor = { id: user.id, name: user.name, role: user.role };
      return reply.send({
        ...conversation,
        messages: conversation.messages.map((message) => sanitizeMessageForActor(message, actor))
      });
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
      transferNote?: string;
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

    const isTransfer =
      body.assignedToId !== undefined && body.assignedToId !== conversation.assignedToId;

    if (isTransfer) {
      await recordConversationTransfer({
        tenantId: user.tenantId,
        actorId: user.id,
        conversationId: refreshed.id,
        fromUserId: conversation.assignedToId,
        toUserId: body.assignedToId ?? null,
        teamId: body.teamId ?? refreshed.teamId ?? null,
        note: body.transferNote
      });
    }

    const onlyTransfer =
      isTransfer &&
      body.status === undefined &&
      body.priority === undefined &&
      body.tags === undefined &&
      body.customerName === undefined &&
      body.customerPhone === undefined;

    if (!onlyTransfer) {
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "Conversation",
        entityId: refreshed.id,
        action: "updated",
        metadata: {
          ...(isTransfer ? {} : { assignedToId: body.assignedToId ?? null }),
          teamId: body.teamId ?? null,
          status: body.status ?? null,
          priority: body.priority ?? null,
          tags: body.tags ?? null,
          customerName: body.customerName ?? null,
          customerPhone: body.customerPhone ?? null
        }
      });
    }

    if (conversation.assignedToId && body.assignedToId === null) {
      await runConversationAutomations(user.tenantId, refreshed.id, "conversation.unassigned");
    }

    const closedStatuses = new Set(["closed", "resolved"]);
    if (body.status && closedStatuses.has(body.status) && !closedStatuses.has(conversation.status)) {
      emitIntegrationEvent(user.tenantId, "conversation.closed", publicConversationPayload(refreshed));
    }

    return reply.send(refreshed);
  });

  app.get(
    "/conversations/:id/activity",
    { preHandler: [requireAuth, requirePermission("conversation:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      const { id } = request.params as { id: string };
      if (!canViewAll(user)) {
        const conversation = await prisma.conversation.findFirst({
          where: { tenantId: user.tenantId, id },
          select: { assignedToId: true }
        });
        if (!conversation) return sendError(reply, 404, "Conversa nao encontrada");
        if (conversation.assignedToId !== user.id) {
          return sendError(reply, 403, "Voce nao tem acesso a este atendimento");
        }
      }
      try {
        return reply.send(await listConversationActivity(user.tenantId, id));
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel carregar atividade", error instanceof Error ? error.message : error);
      }
    }
  );

  app.post(
    "/conversations/:id/notes",
    { preHandler: [requireAuth, requirePermission("conversation:update")] },
    async (request, reply) => {
      const user = requireUser(request);
      const { id } = request.params as { id: string };
      const body = request.body as { text?: string };
      const conversation = await prisma.conversation.findFirst({
        where: { tenantId: user.tenantId, id }
      });
      if (!conversation) return sendError(reply, 404, "Conversa nao encontrada");
      if (!canViewAll(user) && conversation.assignedToId !== user.id) {
        return sendError(reply, 403, "Voce nao tem acesso a este atendimento");
      }
      try {
        const note = await createInternalNote(user.tenantId, user.id, id, body.text ?? "");
        return reply.status(201).send(note);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel salvar nota", error instanceof Error ? error.message : error);
      }
    }
  );

  app.delete("/conversations/:id", { preHandler: [requireAuth, requirePermission("conversation:update")] }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    try {
      const archived = await deleteConversation(user.tenantId, id);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "Conversation",
        entityId: id,
        action: "archived"
      });
      return reply.send(archived);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel arquivar conversa", error instanceof Error ? error.message : error);
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
      appLog.error("inbox_media_route_failed", {
        tenantId: user.tenantId,
        conversationId: id,
        filename: file.filename,
        mimetype: file.mimetype,
        sizeBytes: buffer.length,
        error: error instanceof Error ? error.message : String(error)
      });
      return sendError(
        reply,
        400,
        "Nao foi possivel enviar midia",
        error instanceof Error ? error.message : error,
        { exposeMessage: true }
      );
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
    {
      preHandler: [
        requireAuth,
        requirePermission("conversation:update"),
        requireRole("owner", "admin", "supervisor")
      ]
    },
    async (request, reply) => {
      const user = requireUser(request);
      const { conversationId, messageId } = request.params as { conversationId: string; messageId: string };
      const body = (request.body ?? {}) as { reason?: string };
      try {
        const updated = await hideMessage(user.tenantId, conversationId, messageId, {
          id: user.id,
          name: user.name,
          role: user.role
        }, body.reason);
        await auditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          entity: "Message",
          entityId: messageId,
          action: "hidden",
          metadata: { reason: body.reason ?? null }
        });
        return reply.send(updated);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel ocultar mensagem", error instanceof Error ? error.message : error);
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

