import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { assertTeamInTenant } from "../lib/tenant-guard";
import { defaultPermissionsForRole } from "./admin.service";
import { assertCanAddUser } from "./billing/billing.service";
import { auditLog } from "./audit.service";
import { signSessionToken } from "../lib/session";
import { assertPassword } from "../lib/security/password-policy";
import { BCRYPT_ROUNDS } from "../lib/security/bcrypt";
import { publicUser, type SessionUser } from "./auth.service";

const inviteUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["admin", "supervisor", "agent", "manager", "team_manager"]).default("agent"),
  teamId: z.string().optional()
});

const acceptInviteSchema = z.object({
  token: z.string().min(20),
  tenantSlug: z.string().min(2),
  password: z.string().min(8)
});

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function inviteBaseUrl() {
  return (env.appPublicUrl || env.webhookPublicUrl || "http://127.0.0.1").replace(/\/$/, "");
}

export async function createUserInvite(
  tenantId: string,
  invitedById: string,
  input: unknown
): Promise<{ inviteUrl: string; expiresAt: string; userId: string }> {
  const data = inviteUserSchema.parse(input);
  const email = data.email.trim().toLowerCase();

  const existing = await prisma.user.findFirst({ where: { tenantId, email } });
  if (existing && existing.status === "active") {
    throw new Error("Ja existe um usuario ativo com este e-mail.");
  }

  if (data.teamId) await assertTeamInTenant(tenantId, data.teamId);

  await assertCanAddUser(tenantId);

  const placeholderHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
  const permissions = defaultPermissionsForRole(data.role);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
  if (!tenant) throw new Error("Empresa nao encontrada.");

  const user =
    existing ??
    (await prisma.user.create({
      data: {
        tenantId,
        name: data.name.trim(),
        email,
        passwordHash: placeholderHash,
        role: data.role,
        teamId: data.teamId ?? null,
        status: "invited",
        permissions
      }
    }));

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: data.name.trim(),
        role: data.role,
        teamId: data.teamId ?? null,
        status: "invited",
        permissions
      }
    });
  }

  await prisma.userInvite.deleteMany({ where: { tenantId, userId: user.id, acceptedAt: null } });

  await prisma.userInvite.create({
    data: {
      tenantId,
      userId: user.id,
      tokenHash,
      invitedById,
      expiresAt
    }
  });

  await auditLog({
    tenantId,
    actorId: invitedById,
    entity: "UserInvite",
    entityId: user.id,
    action: "created",
    metadata: { email, role: data.role }
  });

  const inviteUrl = `${inviteBaseUrl()}/?invite=${rawToken}&tenant=${tenant.slug}`;
  return { inviteUrl, expiresAt: expiresAt.toISOString(), userId: user.id };
}

export async function previewUserInvite(token: string, tenantSlug: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug.toLowerCase() },
    select: { id: true, name: true, slug: true }
  });
  if (!tenant) throw new Error("Convite invalido ou expirado.");

  const invite = await prisma.userInvite.findFirst({
    where: {
      tenantId: tenant.id,
      tokenHash: hashToken(token),
      acceptedAt: null,
      expiresAt: { gt: new Date() }
    },
    include: { user: { select: { name: true, email: true, role: true, status: true } } }
  });

  if (!invite || invite.user.status !== "invited") {
    throw new Error("Convite invalido ou expirado.");
  }

  return {
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    name: invite.user.name,
    email: invite.user.email,
    role: invite.user.role,
    expiresAt: invite.expiresAt.toISOString()
  };
}

export async function acceptUserInvite(input: unknown): Promise<{ token: string; user: ReturnType<typeof publicUser> }> {
  const data = acceptInviteSchema.parse(input);
  const tenant = await prisma.tenant.findUnique({
    where: { slug: data.tenantSlug.toLowerCase() },
    select: { id: true, slug: true, billingStatus: true, blockedAt: true }
  });
  if (!tenant || tenant.billingStatus === "blocked" || tenant.blockedAt) {
    throw new Error("Empresa indisponivel.");
  }

  const invite = await prisma.userInvite.findFirst({
    where: {
      tenantId: tenant.id,
      tokenHash: hashToken(data.token),
      acceptedAt: null,
      expiresAt: { gt: new Date() }
    },
    include: { user: true }
  });

  if (!invite || invite.user.status !== "invited") {
    throw new Error("Convite invalido ou expirado.");
  }

  assertPassword(data.password);
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: invite.userId },
      data: { passwordHash, status: "active" }
    });
    await tx.userInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() }
    });
    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorId: user.id,
        entity: "UserInvite",
        entityId: invite.id,
        action: "accepted"
      }
    });
    return user;
  });

  const sessionUser: SessionUser = {
    id: updated.id,
    tenantId: updated.tenantId,
    tenantSlug: tenant.slug,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    permissions: Array.isArray(updated.permissions) ? updated.permissions.map(String) : []
  };

  const token = signSessionToken(sessionUser, updated.tokenVersion);
  return { token, user: publicUser(sessionUser) };
}
