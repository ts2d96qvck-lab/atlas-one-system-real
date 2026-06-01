import jwt from "jsonwebtoken";
import type { FastifyReply } from "fastify";
import { env } from "../config/env";
import { prisma } from "./prisma";
import type { SessionUser } from "../services/auth.service";
import { getTenantAccessDenial } from "../services/billing/billing.service";
import { sendError } from "../utils/http";

type JwtPayload = SessionUser & { tv: number };

function basePermissions(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

export function signSessionToken(user: SessionUser, tokenVersion: number) {
  const payload: JwtPayload = { ...user, tv: tokenVersion };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "12h" });
}

export function readSessionToken(token: string): { user: SessionUser; tokenVersion: number } {
  const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
  const { tv, ...user } = decoded;
  return { user, tokenVersion: typeof tv === "number" ? tv : 0 };
}

export async function revokeUserSessions(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } }
  });
}

export async function resolveSessionUser(token: string): Promise<SessionUser | null> {
  let parsed: { user: SessionUser; tokenVersion: number };
  try {
    parsed = readSessionToken(token);
  } catch {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: { id: parsed.user.id, tenantId: parsed.user.tenantId, status: "active" },
    include: { tenant: { select: { slug: true, billingStatus: true, blockedAt: true, settings: true } } }
  });

  if (!user?.tenant) {
    return null;
  }

  const accessDenial = getTenantAccessDenial(user.tenant);
  if (accessDenial.denied) {
    return null;
  }

  if (user.tokenVersion !== parsed.tokenVersion) {
    return null;
  }

  return {
    id: user.id,
    tenantId: user.tenantId,
    tenantSlug: user.tenant.slug,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: basePermissions(user.permissions)
  };
}

export async function requireSessionToken(token: string | null | undefined, reply: FastifyReply) {
  if (!token) {
    sendError(reply, 401, "Nao autorizado");
    return null;
  }

  const user = await resolveSessionUser(token);
  if (!user) {
    sendError(reply, 401, "Sessao invalida ou expirada");
    return null;
  }

  return user;
}
