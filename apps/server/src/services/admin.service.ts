import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ensureInboundTeam } from "./teams.service";
import { listAuditLogsDetailed } from "./audit.service";
import { assertCanAddUser } from "./billing/billing.service";
import { assertPassword } from "../lib/security/password-policy";
import { BCRYPT_ROUNDS } from "../lib/security/bcrypt";
import { revokeUserSessions } from "../lib/session";
import { attachAvatarUrls } from "./user-avatar.service";

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(12),
  role: z.enum(["admin", "supervisor", "agent", "owner", "manager", "team_manager"]).default("agent"),
  teamId: z.string().optional(),
  phone: z.string().optional(),
  twoFactorEnabled: z.boolean().optional(),
  permissions: z.array(z.string()).default([])
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true }).extend({
  password: z.string().min(6).optional(),
  status: z.enum(["active", "inactive", "invited"]).optional()
});

export const operationalResetSchema = z.object({
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(6),
  ownerPhone: z.string().min(8),
  confirmation: z.literal("DESTRUIR DADOS")
});

export const createTeamSchema = z.object({
  name: z.string().min(2),
  managerId: z.string().optional()
});

const shortcutSchema = z.object({
  tag: z.string().min(2),
  text: z.string().min(2).max(2000)
});

type ShortcutItem = {
  tag: string;
  text: string;
  updatedAt: string;
};

export function defaultPermissionsForRole(role: string) {
  switch (role) {
    case "owner":
    case "admin":
      return ["*"];
    case "supervisor":
      return [
        "conversation:read",
        "conversation:create",
        "conversation:update",
        "conversation:reply",
        "conversation:takeover",
        "crm:read",
        "lead:create",
        "lead:update",
        "dashboard:read",
        "admin:read",
        "automation:read",
        "automation:update",
        "campaign:read",
        "campaign:update"
      ];
    case "manager":
    case "team_manager":
      return [
        "conversation:read",
        "conversation:update",
        "conversation:reply",
        "conversation:takeover",
        "crm:read",
        "lead:create",
        "lead:update",
        "dashboard:read"
      ];
    case "agent":
    default:
      return [
        "conversation:read",
        "conversation:create",
        "conversation:update",
        "conversation:reply",
        "crm:read",
        "lead:create",
        "lead:update"
      ];
  }
}

function normalizeTag(tag: string) {
  const clean = tag.trim().replace(/\s+/g, "");
  return clean.startsWith("#") ? clean.toLowerCase() : `#${clean.toLowerCase()}`;
}

function settingsObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function readShortcuts(settings: unknown): ShortcutItem[] {
  const base = settingsObject(settings);
  const list = Array.isArray(base.shortcuts) ? base.shortcuts : [];
  return list
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      tag: typeof item.tag === "string" ? normalizeTag(item.tag) : "",
      text: typeof item.text === "string" ? item.text : "",
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString()
    }))
    .filter((item) => item.tag.length > 1 && item.text.length > 1);
}

export async function listUsers(tenantId: string) {
  const rows = await prisma.user.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      teamId: true,
      team: { select: { id: true, name: true } },
      phone: true,
      twoFactorEnabled: true,
      status: true,
      permissions: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { name: "asc" }
  });
  return attachAvatarUrls(tenantId, rows);
}

export async function listShortcuts(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  if (!tenant) return [];
  return readShortcuts(tenant.settings).sort((a, b) => a.tag.localeCompare(b.tag));
}

export async function upsertShortcut(tenantId: string, input: unknown) {
  const data = shortcutSchema.parse(input);
  const normalizedTag = normalizeTag(data.tag);
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  if (!tenant) throw new Error("Tenant nao encontrado");
  const currentSettings = settingsObject(tenant.settings);
  const current = readShortcuts(currentSettings).filter((item) => item.tag !== normalizedTag);
  const nextItem: ShortcutItem = {
    tag: normalizedTag,
    text: data.text.trim(),
    updatedAt: new Date().toISOString()
  };
  const nextSettings = {
    ...currentSettings,
    shortcuts: [...current, nextItem]
  };
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: nextSettings }
  });
  return nextItem;
}

export async function deleteShortcut(tenantId: string, tag: string) {
  const normalizedTag = normalizeTag(tag);
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  if (!tenant) throw new Error("Tenant nao encontrado");
  const currentSettings = settingsObject(tenant.settings);
  const current = readShortcuts(currentSettings);
  const next = current.filter((item) => item.tag !== normalizedTag);
  const nextSettings = {
    ...currentSettings,
    shortcuts: next
  };
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: nextSettings }
  });
  return { tag: normalizedTag };
}

export async function listTeams(tenantId: string) {
  await ensureInboundTeam(tenantId);
  return prisma.team.findMany({
    where: { tenantId },
    select: { id: true, name: true, managerId: true },
    orderBy: { name: "asc" }
  });
}

export async function createTeam(tenantId: string, input: unknown) {
  const data = createTeamSchema.parse(input);
  if (data.managerId) {
    const manager = await prisma.user.findFirst({
      where: { id: data.managerId, tenantId },
      select: { id: true }
    });
    if (!manager) throw new Error("Gerente do departamento nao encontrado");
  }
  return prisma.team.create({
    data: {
      tenantId,
      name: data.name.trim(),
      managerId: data.managerId
    },
    select: { id: true, name: true, managerId: true }
  });
}

export async function deleteTeam(tenantId: string, id: string) {
  const team = await prisma.team.findFirst({
    where: { id, tenantId },
    include: {
      _count: {
        select: { members: true, conversations: true, leads: true }
      }
    }
  });
  if (!team) throw new Error("Departamento nao encontrado");
  if (team._count.members > 0 || team._count.conversations > 0 || team._count.leads > 0) {
    throw new Error("Remova membros, conversas e leads deste departamento antes de excluir.");
  }
  return prisma.team.delete({
    where: { id },
    select: { id: true, name: true, managerId: true }
  });
}

export async function createUser(tenantId: string, input: unknown) {
  const data = createUserSchema.parse(input);
  await assertCanAddUser(tenantId);
  const roleRequiresTeam = ["agent", "supervisor", "manager", "team_manager"].includes(data.role);
  if (roleRequiresTeam && !data.teamId) {
    throw new Error("Departamento obrigatorio para este perfil.");
  }
  if (data.teamId) {
    const team = await prisma.team.findFirst({
      where: { id: data.teamId, tenantId },
      select: { id: true }
    });
    if (!team) throw new Error("Departamento nao encontrado para este tenant.");
  }
  assertPassword(data.password);
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const permissions = data.permissions.length ? data.permissions : defaultPermissionsForRole(data.role);
  return prisma.user.create({
    data: {
      tenantId,
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash,
      role: data.role,
      teamId: data.teamId,
      phone: data.phone?.replace(/\D/g, "") || null,
      twoFactorEnabled: Boolean(data.twoFactorEnabled),
      permissions,
      status: "active"
    },
    select: { id: true, name: true, email: true, role: true, status: true, permissions: true, teamId: true }
  });
}

export async function updateUser(tenantId: string, id: string, input: unknown) {
  const data = updateUserSchema.parse(input);
  const existing = await prisma.user.findFirst({ where: { tenantId, id } });
  if (!existing) throw new Error("Usuario nao encontrado");

  const update: Record<string, unknown> = {};
  if (data.name) update.name = data.name;
  if (data.email) update.email = data.email.toLowerCase();
  if (data.role) update.role = data.role;
  if (data.teamId !== undefined) update.teamId = data.teamId;
  if (data.phone !== undefined) update.phone = data.phone ? data.phone.replace(/\D/g, "") : null;
  if (data.twoFactorEnabled !== undefined) update.twoFactorEnabled = data.twoFactorEnabled;
  if (data.status) update.status = data.status;
  if (data.permissions) update.permissions = data.permissions;
  if (data.password) {
    assertPassword(data.password);
    update.passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    update.tokenVersion = { increment: 1 };
  }

  return prisma.user.update({
    where: { id },
    data: update,
    select: { id: true, name: true, email: true, role: true, status: true, permissions: true, teamId: true }
  });
}

export async function deleteUser(tenantId: string, id: string) {
  const existing = await prisma.user.findFirst({ where: { tenantId, id } });
  if (!existing) throw new Error("Usuario nao encontrado");
  if (existing.role === "owner") throw new Error("Nao e permitido excluir o dono da empresa.");
  return prisma.user.delete({
    where: { id },
    select: { id: true, name: true, email: true, role: true, status: true }
  });
}

export async function listAuditLogs(tenantId: string, limit = 50) {
  return listAuditLogsDetailed(tenantId, { limit });
}

export async function listAccessRequests(tenantId: string) {
  return prisma.user.findMany({
    where: {
      tenantId,
      status: "inactive",
      role: { not: "owner" }
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function approveAccessRequest(tenantId: string, id: string) {
  const user = await prisma.user.findFirst({
    where: { tenantId, id, status: "inactive", role: { not: "owner" } },
    select: { id: true, role: true, permissions: true }
  });
  if (!user) throw new Error("Solicitacao nao encontrada");

  await assertCanAddUser(tenantId);

  const permissions =
    Array.isArray(user.permissions) && user.permissions.length
      ? user.permissions
      : defaultPermissionsForRole(user.role);

  return prisma.user.update({
    where: { id },
    data: { status: "active", permissions },
    select: { id: true, name: true, email: true, role: true, status: true, permissions: true }
  });
}

export async function rejectAccessRequest(tenantId: string, id: string) {
  const user = await prisma.user.findFirst({
    where: { tenantId, id, status: "inactive", role: { not: "owner" } },
    select: { id: true, name: true, email: true, role: true, status: true }
  });
  if (!user) throw new Error("Solicitacao nao encontrada");
  await prisma.user.delete({ where: { id } });
  return user;
}

export async function runOperationalReset(tenantId: string, input: unknown) {
  const data = operationalResetSchema.parse(input);
  const ownerEmail = data.ownerEmail.trim().toLowerCase();
  const ownerPhone = data.ownerPhone.replace(/\D/g, "");
  const ownerPasswordHash = await bcrypt.hash(data.ownerPassword, 12);

  const result = await prisma.$transaction(async (tx) => {
    const conversationIds = (
      await tx.conversation.findMany({
        where: { tenantId },
        select: { id: true }
      })
    ).map((row) => row.id);

    if (conversationIds.length) {
      await tx.message.deleteMany({ where: { conversationId: { in: conversationIds } } });
    }

    await tx.authChallenge.deleteMany({ where: { tenantId } });
    await tx.lead.deleteMany({ where: { tenantId } });
    await tx.conversation.deleteMany({ where: { tenantId } });
    await tx.monthlyTarget.deleteMany({ where: { tenantId } });
    await tx.automation.deleteMany({ where: { tenantId } });
    await tx.pipelineStage.deleteMany({ where: { pipeline: { tenantId } } });
    await tx.pipeline.deleteMany({ where: { tenantId } });
    await tx.paymentIntegration.deleteMany({ where: { tenantId } });
    await tx.auditLog.deleteMany({ where: { tenantId } });
    await tx.whatsAppInstance.deleteMany({ where: { tenantId } });

    await tx.user.updateMany({ where: { tenantId }, data: { teamId: null } });
    await tx.team.updateMany({ where: { tenantId }, data: { managerId: null } });
    await tx.team.deleteMany({ where: { tenantId } });
    await tx.user.deleteMany({ where: { tenantId } });

    const owner = await tx.user.create({
      data: {
        tenantId,
        name: data.ownerName.trim(),
        email: ownerEmail,
        passwordHash: ownerPasswordHash,
        role: "owner",
        status: "active",
        phone: ownerPhone,
        twoFactorEnabled: true,
        permissions: ["*"]
      },
      select: { id: true, name: true, email: true, phone: true, role: true, twoFactorEnabled: true }
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: owner.id,
        entity: "Tenant",
        entityId: tenantId,
        action: "operational_reset_completed",
        metadata: {
          ownerEmail,
          removedData: [
            "users",
            "teams",
            "instances",
            "conversations",
            "messages",
            "leads",
            "automations",
            "pipeline",
            "audit_logs"
          ]
        }
      }
    });

    return owner;
  });

  return result;
}
