import type { FastifyInstance } from "fastify";
import { createEvolutionProvider } from "../services/whatsapp/providers/evolution.provider";
import { requireAuth, requireUser } from "../plugins/auth";
import { requireRole } from "../plugins/roles";
import { requirePermission } from "../plugins/permissions";
import { requirePlatformAdmin } from "../plugins/platform-admin";
import {
  approveAccessRequest,
  createTeam,
  createUser,
  deleteShortcut,
  deleteTeam,
  deleteUser,
  listAccessRequests,
  listShortcuts,
  listTeams,
  listUsers,
  rejectAccessRequest,
  runOperationalReset,
  upsertShortcut,
  updateUser
} from "../services/admin.service";
import { getCompanySettings, getWhatsAppChannelSettings, updateCompanySettings } from "../services/company-settings.service";
import { getMenuBotSettings, updateMenuBotSettings } from "../services/menu-bot.service";
import { getMonthlyTargetOverview, upsertMonthlyTargets } from "../services/monthly-target.service";
import { saveUserAvatar } from "../services/user-avatar.service";
import { getTenantSsoSettings, updateTenantSsoSettings } from "../services/sso/sso.service";
import { createUserInvite } from "../services/invite.service";
import { auditLog, AUDIT_ACTIONS, listAuditLogsDetailed, exportAuditLogsCsv } from "../services/audit.service";
import { listTenants, onboardTenant, ownerTenantOverview, updateTenantBilling, updateTenantControls, createBootstrapOnboardingLink } from "../services/tenant-onboarding.service";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { sendError } from "../utils/http";

export async function adminRoutes(app: FastifyInstance) {
  const guard = [requireAuth, requireRole("admin", "owner", "supervisor"), requirePermission("admin:read")];

  app.get("/users", { preHandler: guard }, async (request, reply) => {
    const user = requireUser(request);
    return reply.send(await listUsers(user.tenantId));
  });

  app.get(
    "/teams",
    { preHandler: [requireAuth, requireRole("admin", "owner", "supervisor"), requirePermission("admin:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      return reply.send(await listTeams(user.tenantId));
    }
  );

  app.get(
    "/shortcuts",
    { preHandler: [requireAuth, requireRole("admin", "owner", "supervisor"), requirePermission("admin:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      return reply.send(await listShortcuts(user.tenantId));
    }
  );

  app.post(
    "/shortcuts",
    { preHandler: [requireAuth, requireRole("admin", "owner"), requirePermission("admin:user:update")] },
    async (request, reply) => {
      const user = requireUser(request);
      try {
        const saved = await upsertShortcut(user.tenantId, request.body);
        await auditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          entity: "Shortcut",
          entityId: saved.tag,
          action: "updated",
          metadata: { tag: saved.tag }
        });
        return reply.status(201).send(saved);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel salvar atalho", error instanceof Error ? error.message : error);
      }
    }
  );

  app.delete(
    "/shortcuts/:tag",
    { preHandler: [requireAuth, requireRole("admin", "owner"), requirePermission("admin:user:update")] },
    async (request, reply) => {
      const user = requireUser(request);
      const { tag } = request.params as { tag: string };
      try {
        const removed = await deleteShortcut(user.tenantId, tag);
        await auditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          entity: "Shortcut",
          entityId: removed.tag,
          action: "deleted"
        });
        return reply.send(removed);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel excluir atalho", error instanceof Error ? error.message : error);
      }
    }
  );

  app.post(
    "/teams",
    { preHandler: [requireAuth, requireRole("admin", "owner"), requirePermission("admin:user:update")] },
    async (request, reply) => {
      const user = requireUser(request);
      try {
        const created = await createTeam(user.tenantId, request.body);
        await auditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          entity: "Team",
          entityId: created.id,
          action: "created"
        });
        return reply.status(201).send(created);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel criar departamento", error instanceof Error ? error.message : error);
      }
    }
  );

  app.delete(
    "/teams/:id",
    { preHandler: [requireAuth, requireRole("admin", "owner"), requirePermission("admin:user:update")] },
    async (request, reply) => {
      const user = requireUser(request);
      const { id } = request.params as { id: string };
      try {
        const removed = await deleteTeam(user.tenantId, id);
        await auditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          entity: "Team",
          entityId: removed.id,
          action: "deleted"
        });
        return reply.send(removed);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel excluir departamento", error instanceof Error ? error.message : error);
      }
    }
  );

  app.post(
    "/users",
    { preHandler: [requireAuth, requireRole("admin", "owner"), requirePermission("admin:user:create")] },
    async (request, reply) => {
    const user = requireUser(request);
    try {
      const created = await createUser(user.tenantId, request.body);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "User",
        entityId: created.id,
        action: "created"
      });
      return reply.status(201).send(created);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel criar usuario", error instanceof Error ? error.message : error);
    }
    }
  );

  app.patch(
    "/users/:id",
    { preHandler: [requireAuth, requireRole("admin", "owner"), requirePermission("admin:user:update")] },
    async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    const body = request.body as {
      role?: string;
      permissions?: string[];
      password?: string;
      name?: string;
      email?: string;
      status?: string;
    };
    try {
      const updated = await updateUser(user.tenantId, id, request.body);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "User",
        entityId: id,
        action: AUDIT_ACTIONS.USER_UPDATED
      });
      if (body.role || body.permissions) {
        await auditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          entity: "User",
          entityId: id,
          action: AUDIT_ACTIONS.PERMISSIONS_UPDATED,
          metadata: { role: body.role ?? null, permissions: body.permissions ?? null }
        });
      }
      if (body.password) {
        await auditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          entity: "User",
          entityId: id,
          action: AUDIT_ACTIONS.PASSWORD_CHANGED,
          metadata: { targetUserId: id }
        });
      }
      return reply.send(updated);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel atualizar usuario", error instanceof Error ? error.message : error);
    }
    }
  );

  app.delete(
    "/users/:id",
    { preHandler: [requireAuth, requireRole("owner", "admin"), requirePermission("admin:user:update")] },
    async (request, reply) => {
      const user = requireUser(request);
      const { id } = request.params as { id: string };
      if (id === user.id) return sendError(reply, 400, "Nao e permitido excluir o proprio usuario");
      try {
        const removed = await deleteUser(user.tenantId, id);
        await auditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          entity: "User",
          entityId: id,
          action: "deleted"
        });
        return reply.send(removed);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel excluir usuario", error instanceof Error ? error.message : error);
      }
    }
  );

  app.post(
    "/onboarding/bootstrap-link",
    { preHandler: [requireAuth, requirePlatformAdmin()] },
    async (request, reply) => {
      const user = requireUser(request);
      const body = request.body as { tenantSlug?: string };
      try {
        const link = createBootstrapOnboardingLink({ tenantSlug: body.tenantSlug });
        await auditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          entity: "Auth",
          entityId: user.id,
          action: "bootstrap_link_created",
          metadata: { tenantSlug: body.tenantSlug?.trim().toLowerCase() ?? null }
        });
        return reply.send(link);
      } catch (error) {
        return sendError(
          reply,
          400,
          "Nao foi possivel gerar link de onboarding",
          error instanceof Error ? error.message : error
        );
      }
    }
  );

  app.post(
    "/tenants/onboard",
    { preHandler: [requireAuth, requirePlatformAdmin()] },
    async (request, reply) => {
    const user = requireUser(request);
    try {
      const created = await onboardTenant(request.body);
      await auditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        entity: "Tenant",
        entityId: created.tenant.id,
        action: "onboarded_external_tenant",
        metadata: { slug: created.tenant.slug }
      });
      return reply.status(201).send(created);
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel criar tenant", error instanceof Error ? error.message : error);
    }
    }
  );

  app.get(
    "/tenants",
    { preHandler: [requireAuth, requirePlatformAdmin()] },
    async (_request, reply) => {
    return reply.send(await listTenants());
    }
  );

  app.get(
    "/owner/tenants-overview",
    { preHandler: [requireAuth, requirePlatformAdmin()] },
    async (_request, reply) => {
      return reply.send(await ownerTenantOverview());
    }
  );

  app.patch(
    "/tenants/:id/billing",
    { preHandler: [requireAuth, requirePlatformAdmin()] },
    async (request, reply) => {
      const user = requireUser(request);
      const { id } = request.params as { id: string };
      try {
        const updated = await updateTenantBilling(id, request.body);
        await auditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          entity: "Tenant",
          entityId: id,
          action: "billing_status_updated",
          metadata: {
            billingStatus: updated.billingStatus,
            blockedAt: updated.blockedAt ?? null
          }
        });
        return reply.send(updated);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel atualizar o faturamento do tenant", error instanceof Error ? error.message : error);
      }
    }
  );

  app.patch(
    "/tenants/:id/controls",
    { preHandler: [requireAuth, requirePlatformAdmin()] },
    async (request, reply) => {
      const user = requireUser(request);
      const { id } = request.params as { id: string };
      try {
        const updated = await updateTenantControls(id, request.body);
        await auditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          entity: "Tenant",
          entityId: id,
          action: "tenant_controls_updated",
          metadata: {
            plan: updated.plan,
            maxUsers: updated.maxUsers,
            maxInstances: updated.maxInstances,
            trialEndsAt: updated.trialEndsAt
          }
        });
        return reply.send(updated);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel atualizar controles do tenant", error instanceof Error ? error.message : error);
      }
    }
  );

  app.get("/audit-logs/export.csv", { preHandler: guard }, async (request, reply) => {
    const user = requireUser(request);
    const query = request.query as { limit?: string; action?: string; entity?: string; from?: string; to?: string };
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const csv = await exportAuditLogsCsv(user.tenantId, {
      limit: Number(query.limit ?? 1000) || 1000,
      action: query.action,
      entity: query.entity,
      from: from && !Number.isNaN(from.getTime()) ? from : undefined,
      to: to && !Number.isNaN(to.getTime()) ? to : undefined
    });
    await auditLog({
      tenantId: user.tenantId,
      actorId: user.id,
      entity: "AuditLog",
      action: AUDIT_ACTIONS.DATA_EXPORT,
      metadata: { format: "csv" }
    });
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", 'attachment; filename="audit-logs.csv"');
    return reply.send(csv);
  });

  app.get("/audit-logs", { preHandler: guard }, async (request, reply) => {
    const user = requireUser(request);
    const query = request.query as { limit?: string; action?: string; entity?: string; from?: string; to?: string };
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    return reply.send(
      await listAuditLogsDetailed(user.tenantId, {
        limit: Number(query.limit ?? 50) || 50,
        action: query.action,
        entity: query.entity,
        from: from && !Number.isNaN(from.getTime()) ? from : undefined,
        to: to && !Number.isNaN(to.getTime()) ? to : undefined
      })
    );
  });

  app.get(
    "/company-settings",
    { preHandler: [requireAuth, requireRole("owner", "admin"), requirePermission("admin:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      return reply.send(await getCompanySettings(user.tenantId));
    }
  );

  app.patch(
    "/company-settings",
    { preHandler: [requireAuth, requireRole("owner", "admin"), requirePermission("admin:user:update")] },
    async (request, reply) => {
      const user = requireUser(request);
      try {
        const updated = await updateCompanySettings(user.tenantId, request.body);
        await auditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          entity: "Tenant",
          entityId: user.tenantId,
          action: AUDIT_ACTIONS.SETTINGS_UPDATED
        });
        return reply.send(updated);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel salvar configuracoes", error instanceof Error ? error.message : error);
      }
    }
  );

  app.get(
    "/menu-bot",
    { preHandler: [requireAuth, requireRole("owner", "admin"), requirePermission("admin:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      return reply.send(await getMenuBotSettings(user.tenantId));
    }
  );

  app.patch(
    "/menu-bot",
    { preHandler: [requireAuth, requireRole("owner", "admin"), requirePermission("admin:user:update")] },
    async (request, reply) => {
      const user = requireUser(request);
      try {
        const updated = await updateMenuBotSettings(user.tenantId, request.body);
        await auditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          entity: "Tenant",
          entityId: user.tenantId,
          action: AUDIT_ACTIONS.SETTINGS_UPDATED,
          metadata: { area: "menu-bot" }
        });
        return reply.send(updated);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel salvar robo de atendimento", error instanceof Error ? error.message : error);
      }
    }
  );

  app.post(
    "/users/me/avatar",
    { preHandler: [requireAuth, requirePermission("admin:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      const body = request.body as { image?: string; mimeType?: string };
      if (!body.image?.trim()) return sendError(reply, 400, "Imagem obrigatoria");
      try {
        const avatarUrl = await saveUserAvatar(user.tenantId, user.id, body.image, body.mimeType);
        return reply.send({ avatarUrl });
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel salvar foto", error instanceof Error ? error.message : error);
      }
    }
  );

  app.get(
    "/monthly-targets",
    { preHandler: [requireAuth, requireRole("owner", "admin", "supervisor"), requirePermission("admin:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      return reply.send(await getMonthlyTargetOverview(user.tenantId));
    }
  );

  app.put(
    "/monthly-targets",
    { preHandler: [requireAuth, requireRole("owner", "admin"), requirePermission("admin:user:update")] },
    async (request, reply) => {
      const user = requireUser(request);
      try {
        const updated = await upsertMonthlyTargets(user.tenantId, request.body as Parameters<typeof upsertMonthlyTargets>[1]);
        await auditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          entity: "MonthlyTarget",
          action: AUDIT_ACTIONS.SETTINGS_UPDATED,
          metadata: { area: "monthly-targets" }
        });
        return reply.send(updated);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel salvar meta", error instanceof Error ? error.message : error);
      }
    }
  );

  app.get(
    "/sso/settings",
    { preHandler: [requireAuth, requireRole("owner", "admin"), requirePermission("admin:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      return reply.send(await getTenantSsoSettings(user.tenantId));
    }
  );

  app.patch(
    "/sso/settings",
    { preHandler: [requireAuth, requireRole("owner", "admin"), requirePermission("admin:user:update")] },
    async (request, reply) => {
      const user = requireUser(request);
      try {
        const updated = await updateTenantSsoSettings(user.tenantId, request.body);
        await auditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          entity: "Tenant",
          entityId: user.tenantId,
          action: AUDIT_ACTIONS.SETTINGS_UPDATED,
          metadata: { area: "sso" }
        });
        return reply.send(updated);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel salvar SSO", error instanceof Error ? error.message : error);
      }
    }
  );

  app.get(
    "/channel-settings",
    { preHandler: [requireAuth, requireRole("owner", "admin", "supervisor"), requirePermission("admin:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      return reply.send(await getWhatsAppChannelSettings(user.tenantId));
    }
  );

  app.post(
    "/users/invite",
    { preHandler: [requireAuth, requireRole("admin", "owner"), requirePermission("admin:user:create")] },
    async (request, reply) => {
      const user = requireUser(request);
      try {
        const result = await createUserInvite(user.tenantId, user.id, request.body);
        return reply.status(201).send(result);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel convidar usuario", error instanceof Error ? error.message : error);
      }
    }
  );

  app.get(
    "/access-requests",
    { preHandler: [requireAuth, requireRole("owner", "admin"), requirePermission("admin:read")] },
    async (request, reply) => {
      const user = requireUser(request);
      return reply.send(await listAccessRequests(user.tenantId));
    }
  );

  app.post(
    "/access-requests/:id/approve",
    { preHandler: [requireAuth, requireRole("owner", "admin"), requirePermission("admin:user:update")] },
    async (request, reply) => {
      const user = requireUser(request);
      const { id } = request.params as { id: string };
      try {
        const approved = await approveAccessRequest(user.tenantId, id);
        await auditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          entity: "User",
          entityId: id,
          action: "access_request_approved"
        });
        return reply.send(approved);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel aprovar solicitacao", error instanceof Error ? error.message : error);
      }
    }
  );

  app.delete(
    "/access-requests/:id/reject",
    { preHandler: [requireAuth, requireRole("owner", "admin"), requirePermission("admin:user:update")] },
    async (request, reply) => {
      const user = requireUser(request);
      const { id } = request.params as { id: string };
      try {
        const rejected = await rejectAccessRequest(user.tenantId, id);
        await auditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          entity: "User",
          entityId: id,
          action: "access_request_rejected"
        });
        return reply.send(rejected);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel recusar solicitacao", error instanceof Error ? error.message : error);
      }
    }
  );

  app.post(
    "/owner/operational-reset",
    { preHandler: [requireAuth, requirePlatformAdmin()] },
    async (request, reply) => {
      const user = requireUser(request);
      try {
        const instances = await prisma.whatsAppInstance.findMany({
          where: { tenantId: user.tenantId },
          select: { name: true }
        });
        if (instances.length) {
          const p = createEvolutionProvider();
          for (const instance of instances) {
            try {
              await p.logout(instance.name);
            } catch {
              // Continue reset even if provider logout fails.
            }
          }
        }

        const owner = await runOperationalReset(user.tenantId, request.body);
        return reply.send({
          ok: true,
          message: "Reset operacional concluido. Entre novamente com o novo owner e 2FA.",
          owner
        });
      } catch (error) {
        return sendError(
          reply,
          400,
          "Nao foi possivel concluir o reset operacional",
          error instanceof Error ? error.message : error
        );
      }
    }
  );
}
