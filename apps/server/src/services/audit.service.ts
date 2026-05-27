import { prisma } from "../lib/prisma";
import type { Prisma } from "@prisma/client";

/** Standard audit action names for security/compliance reporting. */
export const AUDIT_ACTIONS = {
  // Auth
  AUTH_LOGIN_SUCCESS: "auth_login_success",
  AUTH_LOGIN_FAILED: "auth_login_failed",
  AUTH_LOGIN_CHALLENGE: "auth_login_challenge",
  AUTH_LOGOUT: "auth_logout",
  PASSWORD_RESET_REQUESTED: "password_reset_requested",
  PASSWORD_RESET_CONFIRMED: "password_reset_confirmed",
  PASSWORD_CHANGED: "password_changed",
  // Users & permissions
  USER_CREATED: "created",
  USER_UPDATED: "updated",
  USER_DELETED: "deleted",
  PERMISSIONS_UPDATED: "permissions_updated",
  // Data
  DATA_EXPORT: "data_export",
  DATA_DELETED: "deleted",
  // Integrations
  API_KEY_CREATED: "api_key_created",
  API_KEY_REVOKED: "api_key_revoked",
  WEBHOOK_CREATED: "webhook_created",
  WEBHOOK_UPDATED: "webhook_updated",
  WEBHOOK_DELETED: "webhook_deleted",
  COMMERCIAL_EVENT: "commercial_event",
  SETTINGS_UPDATED: "settings_updated"
} as const;

type AuditInput = {
  tenantId: string;
  actorId?: string | null;
  entity: string;
  entityId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
};

export async function auditLog(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      actorId: input.actorId ?? null,
      entity: input.entity,
      entityId: input.entityId ?? null,
      action: input.action,
      metadata: input.metadata as Prisma.InputJsonValue | undefined
    }
  });
}

export type AuditLogFilters = {
  limit?: number;
  action?: string;
  entity?: string;
  from?: Date;
  to?: Date;
};

export async function listAuditLogsDetailed(tenantId: string, filters: AuditLogFilters = {}) {
  const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
  const where: Prisma.AuditLogWhereInput = { tenantId };

  if (filters.action) where.action = filters.action;
  if (filters.entity) where.entity = filters.entity;
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = filters.from;
    if (filters.to) where.createdAt.lte = filters.to;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit
  });

  const actorIds = [...new Set(logs.map((log) => log.actorId).filter(Boolean))] as string[];
  const actors =
    actorIds.length > 0
      ? await prisma.user.findMany({
          where: { tenantId, id: { in: actorIds } },
          select: { id: true, name: true, email: true, role: true }
        })
      : [];
  const actorMap = new Map(actors.map((actor) => [actor.id, actor]));

  return logs.map((log) => ({
    ...log,
    actor: log.actorId ? (actorMap.get(log.actorId) ?? null) : null
  }));
}

export async function exportAuditLogsCsv(tenantId: string, filters: AuditLogFilters = {}) {
  const limit = Math.min(5000, Math.max(1, filters.limit ?? 1000));
  const rows = await listAuditLogsDetailed(tenantId, { ...filters, limit });
  const header = ["id", "createdAt", "action", "entity", "entityId", "actorId", "actorEmail", "actorName"];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.createdAt.toISOString(),
        row.action,
        row.entity,
        row.entityId ?? "",
        row.actorId ?? "",
        row.actor?.email ?? "",
        row.actor?.name ?? ""
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    );
  }
  return lines.join("\n");
}

export async function auditDataExport(
  tenantId: string,
  actorId: string | null,
  resource: string,
  metadata?: Record<string, unknown>
) {
  return auditLog({
    tenantId,
    actorId,
    entity: "Export",
    entityId: resource,
    action: AUDIT_ACTIONS.DATA_EXPORT,
    metadata: { resource, ...metadata }
  });
}
