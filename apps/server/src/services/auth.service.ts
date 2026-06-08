import bcrypt from "bcryptjs";
import { createHash, randomInt } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { maskPhone, otpDeliversForReal, otpDeliveryLabel, sendSms } from "./sms.service";
import { assertPassword } from "../lib/security/password-policy";
import { BCRYPT_ROUNDS } from "../lib/security/bcrypt";
import { readSessionToken, revokeUserSessions, signSessionToken } from "../lib/session";
import { appLog } from "../lib/app-log";
import { isPrivateOrLoopbackIp } from "../lib/client-ip";
import { AuthLoginError } from "../lib/auth-login-errors";
import { getTenantAccessDenial } from "./billing/billing.service";

export const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).optional(),
    senha: z.string().min(8).optional(),
    tenantSlug: z.string().min(2).default("atlas-one")
  })
  .superRefine((data, ctx) => {
    if (!data.password && !data.senha) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["senha"],
        message: "Senha obrigatoria"
      });
    }
  })
  .transform(({ senha, password, email, tenantSlug }) => ({
    email: email.trim().toLowerCase(),
    tenantSlug: tenantSlug.trim().toLowerCase(),
    password: password ?? senha!
  }));

const verifyCodeSchema = z.object({
  challengeId: z.string().min(5),
  code: z.string().regex(/^\d{6}$/)
});

const requestPasswordResetSchema = z.object({
  tenantSlug: z.string().min(2),
  email: z.string().email()
});

const confirmPasswordResetSchema = z.object({
  challengeId: z.string().min(5),
  code: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(12)
});

const bootstrapOwnerSchema = z.object({
  companyName: z.string().min(2),
  tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(12),
  ownerPhone: z.string().min(8)
});

const requestAccessSchema = z.object({
  tenantSlug: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(12),
  phone: z.string().min(8).optional()
});

export type SessionUser = {
  id: string;
  tenantId: string;
  tenantSlug: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
};

type AccessContext = {
  ip?: string;
  userAgent?: string;
  requestId?: string;
  host?: string;
};

export function publicUser(user: SessionUser) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: user.permissions
  };
}

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function generateCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function basePermissions(userPermissions: unknown): string[] {
  return Array.isArray(userPermissions) ? userPermissions.map(String) : [];
}

function asMetadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizePhone(raw: string | null | undefined) {
  return String(raw ?? "").replace(/\D/g, "");
}

const DEFAULT_STAGES = [
  "Novos leads",
  "Contato feito",
  "Reuniao marcada",
  "Proposta enviada",
  "Negociacao",
  "Fechado",
  "Perdido"
] as const;

async function recordAuthAudit(
  tenantId: string,
  actorId: string,
  action: string,
  context?: AccessContext,
  extra?: Record<string, unknown>
) {
  await prisma.auditLog.create({
    data: {
      tenantId,
      actorId,
      entity: "Auth",
      action,
      metadata: {
        ip: context?.ip ?? null,
        userAgent: context?.userAgent ?? null,
        ...extra
      }
    }
  });
}

async function isSuspiciousAccess(tenantId: string, userId: string, context?: AccessContext) {
  if (!context?.ip && !context?.userAgent) return false;
  const currentIp = context.ip ?? "";
  // Smoke tests via localhost/nginx and first access from public domain must not force 2FA.
  if (isPrivateOrLoopbackIp(currentIp)) return false;

  const lastSuccess = await prisma.auditLog.findFirst({
    where: { tenantId, actorId: userId, action: "auth_login_success" },
    orderBy: { createdAt: "desc" }
  });
  if (!lastSuccess) return false;
  const metadata = asMetadataRecord(lastSuccess.metadata);
  const lastIp = typeof metadata.ip === "string" ? metadata.ip : "";
  const lastAgent = typeof metadata.userAgent === "string" ? metadata.userAgent : "";
  if (isPrivateOrLoopbackIp(lastIp)) return false;
  const changedIp = Boolean(currentIp && lastIp && currentIp !== lastIp);
  const changedAgent = Boolean(context.userAgent && lastAgent && context.userAgent !== lastAgent);
  return changedIp || changedAgent;
}

async function createChallenge(params: {
  tenantId: string;
  userId: string;
  purpose: "login_2fa" | "password_reset";
  phone: string;
}) {
  const code = generateCode();
  const challenge = await prisma.authChallenge.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      purpose: params.purpose,
      channel: "sms",
      target: params.phone,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    }
  });
  return { challenge, code };
}

type LoginSuccess = { token: string; user: ReturnType<typeof publicUser>; requires2fa: false };
type LoginNeeds2fa = {
  requires2fa: true;
  challengeId: string;
  maskedPhone: string;
  message: string;
  role: string;
  ownerFirstAccess: boolean;
};
export type LoginResult = LoginSuccess | LoginNeeds2fa;

export async function login(input: unknown, context?: AccessContext): Promise<LoginResult> {
  const log = (step: string, detail: Record<string, unknown> = {}) => {
    appLog.info("auth_login", {
      step,
      requestId: context?.requestId,
      host: context?.host,
      clientIp: context?.ip,
      ...detail
    });
  };

  const credentials = loginSchema.parse(input);
  log("schema_ok", {
    tenantSlug: credentials.tenantSlug,
    email: credentials.email
  });

  const tenant = await prisma.tenant.findUnique({
    where: { slug: credentials.tenantSlug },
    include: {
      instances: { where: { phone: { not: null } }, select: { phone: true }, take: 1 },
      users: {
        where: { email: credentials.email },
        take: 1
      }
    }
  });

  const user = tenant?.users[0];
  log("tenant_lookup", {
    tenantFound: Boolean(tenant),
    tenantSlug: credentials.tenantSlug,
    userFound: Boolean(user),
    userStatus: user?.status ?? null,
    userRole: user?.role ?? null,
    twoFactorEnabled: user?.twoFactorEnabled ?? null,
    billingStatus: tenant?.billingStatus ?? null
  });

  if (!tenant || !user || user.status !== "active") {
    log("invalid_credentials", { reason: "tenant_or_user_missing_or_inactive" });
    throw new AuthLoginError("invalid_credentials", "Login invalido");
  }

  const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
  log("password_check", { bcryptPassed: isValid });
  if (!isValid) {
    await recordAuthAudit(tenant.id, user.id, "auth_login_failed", context, { reason: "invalid_password" });
    const since = new Date(Date.now() - 15 * 60 * 1000);
    const failures = await prisma.auditLog.count({
      where: { tenantId: tenant.id, actorId: user.id, action: "auth_login_failed", createdAt: { gte: since } }
    });
    if (failures >= 5) {
      log("rate_limited", { failures });
      throw new AuthLoginError(
        "rate_limited",
        "Conta temporariamente bloqueada por tentativas invalidas. Aguarde 15 minutos."
      );
    }
    throw new AuthLoginError("invalid_credentials", "Login invalido");
  }

  const accessDenial = getTenantAccessDenial(tenant);
  if (accessDenial.denied) {
    log(accessDenial.code, { billingStatus: tenant.billingStatus, blockedAt: tenant.blockedAt });
    throw new AuthLoginError(
      accessDenial.code === "trial_expired" ? "trial_expired" : "billing_blocked",
      accessDenial.message
    );
  }

  const sessionUser: SessionUser = {
    id: user.id,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: basePermissions(user.permissions)
  };

  const suspicious = await isSuspiciousAccess(tenant.id, user.id, context);
  if (suspicious) {
    await recordAuthAudit(tenant.id, user.id, "auth_suspicious_access_detected", context, {
      note: "audit_only_not_blocking_login"
    });
  }

  const smsDeliversForReal = otpDeliversForReal();
  const ownerMustUse2fa = user.role === "owner" && smsDeliversForReal;
  const suspiciousWouldForce2fa = suspicious && smsDeliversForReal && !env.disableSuspicious2fa;
  const mustUse2fa = ownerMustUse2fa || user.twoFactorEnabled || suspiciousWouldForce2fa;
  log("twofa_decision", {
    suspicious,
    disableSuspicious2fa: env.disableSuspicious2fa,
    smsDeliversForReal,
    ownerMustUse2fa,
    twoFactorEnabled: user.twoFactorEnabled,
    suspiciousWouldForce2fa,
    mustUse2fa,
    qaBypass2fa: env.qaBypass2fa
  });
  const otpChannel = otpDeliveryLabel();
  const hasPreviousSuccess = await prisma.auditLog.findFirst({
    where: { tenantId: tenant.id, actorId: user.id, action: "auth_login_success" },
    select: { id: true }
  });
  const ownerFirstAccess = ownerMustUse2fa && !hasPreviousSuccess;

  if (mustUse2fa && !env.qaBypass2fa) {
    const phone = normalizePhone(user.phone ?? tenant.instances[0]?.phone);
    if (!phone) {
      log("twofa_phone_missing", { otpChannel });
      throw new AuthLoginError(
        "twofa_phone_missing",
        `Configure um telefone para receber verificacao por ${otpChannel}.`
      );
    }
    const { challenge, code } = await createChallenge({
      tenantId: tenant.id,
      userId: user.id,
      purpose: "login_2fa",
      phone
    });
    try {
      await sendSms(phone, `Seu codigo Atlas One: ${code}. Expira em 10 minutos.`, { tenantId: tenant.id });
    } catch (error) {
      await prisma.authChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
      const detail = error instanceof Error ? error.message : String(error);
      appLog.warn("twofa_sms_failed", {
        requestId: context?.requestId,
        tenantId: tenant.id,
        userId: user.id,
        otpChannel,
        detail,
        action: "login_continued_without_2fa"
      });
      log("twofa_sms_failed", { otpChannel, detail, action: "login_continued" });
      const token = signSessionToken(sessionUser, user.tokenVersion);
      await recordAuthAudit(tenant.id, user.id, "auth_login_success", context, {
        mode: "2fa_skipped_delivery_failed",
        reason: detail,
        suspicious
      });
      log("login_success", { mode: "2fa_skipped_delivery_failed" });
      return { token, user: publicUser(sessionUser), requires2fa: false };
    }
    await recordAuthAudit(tenant.id, user.id, "auth_login_challenge", context, {
      reason: suspicious ? "suspicious_access" : ownerMustUse2fa ? "owner_policy" : "user_2fa_enabled"
    });
    log("twofa_challenge", { challengeId: challenge.id, ownerFirstAccess });
    return {
      requires2fa: true,
      challengeId: challenge.id,
      maskedPhone: maskPhone(phone),
      message: ownerFirstAccess
        ? `Primeiro acesso do dono detectado. Enviamos um codigo no ${otpChannel} para validar a conta principal.`
        : `Enviamos um codigo no ${otpChannel} para confirmar seu acesso.`,
      role: user.role,
      ownerFirstAccess
    };
  }

  const token = signSessionToken(sessionUser, user.tokenVersion);
  await recordAuthAudit(tenant.id, user.id, "auth_login_success", context, { mode: "password_only" });
  log("login_success", { mode: "password_only", role: user.role });
  return { token, user: publicUser(sessionUser), requires2fa: false };
}

export async function completeLogin(
  sessionUser: SessionUser,
  tokenVersion: number,
  context?: AccessContext,
  extra?: Record<string, unknown>
): Promise<{ token: string; user: ReturnType<typeof publicUser> }> {
  const token = signSessionToken(sessionUser, tokenVersion);
  await recordAuthAudit(sessionUser.tenantId, sessionUser.id, "auth_login_success", context, extra);
  return { token, user: publicUser(sessionUser) };
}

export async function verifyLoginCode(
  input: unknown,
  context?: AccessContext
): Promise<{ token: string; user: ReturnType<typeof publicUser> }> {
  const data = verifyCodeSchema.parse(input);
  const challenge = await prisma.authChallenge.findUnique({
    where: { id: data.challengeId },
    include: { tenant: true, user: true }
  });
  if (!challenge || challenge.purpose !== "login_2fa") throw new Error("Codigo invalido");
  if (challenge.consumedAt) throw new Error("Codigo ja utilizado");
  if (challenge.expiresAt.getTime() < Date.now()) throw new Error("Codigo expirado");
  if (challenge.attempts >= 5) throw new Error("Muitas tentativas invalidas");

  const valid = challenge.codeHash === hashCode(data.code);
  if (!valid) {
    await prisma.authChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } }
    });
    throw new Error("Codigo invalido");
  }

  await prisma.authChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() }
  });

  const accessDenial = getTenantAccessDenial(challenge.tenant);
  if (accessDenial.denied) {
    throw new Error(accessDenial.message);
  }

  const sessionUser: SessionUser = {
    id: challenge.user.id,
    tenantId: challenge.tenant.id,
    tenantSlug: challenge.tenant.slug,
    name: challenge.user.name,
    email: challenge.user.email,
    role: challenge.user.role,
    permissions: basePermissions(challenge.user.permissions)
  };
  const token = signSessionToken(sessionUser, challenge.user.tokenVersion);
  await recordAuthAudit(challenge.tenant.id, challenge.user.id, "auth_login_success", context, { mode: "sms_2fa" });
  return { token, user: publicUser(sessionUser) };
}

export async function requestPasswordReset(
  input: unknown
): Promise<{ ok: true; challengeId: string | null; maskedPhone: string | null }> {
  const data = requestPasswordResetSchema.parse(input);
  const tenant = await prisma.tenant.findUnique({
    where: { slug: data.tenantSlug },
    include: {
      users: { where: { email: data.email.toLowerCase(), status: "active" }, take: 1 }
    }
  });
  const user = tenant?.users[0];
  if (!tenant || !user?.phone) {
    return { ok: true, challengeId: null, maskedPhone: null };
  }

  const { challenge, code } = await createChallenge({
    tenantId: tenant.id,
    userId: user.id,
    purpose: "password_reset",
    phone: user.phone
  });
  await sendSms(user.phone, `Recuperacao Atlas One: codigo ${code}. Expira em 10 minutos.`, { tenantId: tenant.id });
  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      actorId: user.id,
      entity: "Auth",
      action: "password_reset_requested",
      entityId: challenge.id
    }
  });
  return { ok: true, challengeId: challenge.id, maskedPhone: maskPhone(user.phone) };
}

export async function confirmPasswordReset(input: unknown): Promise<{ ok: true }> {
  const data = confirmPasswordResetSchema.parse(input);
  assertPassword(data.newPassword);
  const challenge = await prisma.authChallenge.findUnique({
    where: { id: data.challengeId },
    include: { user: true, tenant: true }
  });
  if (!challenge || challenge.purpose !== "password_reset") throw new Error("Codigo invalido");
  if (challenge.consumedAt) throw new Error("Codigo ja utilizado");
  if (challenge.expiresAt.getTime() < Date.now()) throw new Error("Codigo expirado");
  if (challenge.attempts >= 5) throw new Error("Muitas tentativas invalidas");

  const valid = challenge.codeHash === hashCode(data.code);
  if (!valid) {
    await prisma.authChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } }
    });
    throw new Error("Codigo invalido");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: challenge.userId },
      data: {
        passwordHash: await bcrypt.hash(data.newPassword, BCRYPT_ROUNDS),
        tokenVersion: { increment: 1 }
      }
    });
    await tx.authChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() }
    });
    await tx.auditLog.create({
      data: {
        tenantId: challenge.tenantId,
        actorId: challenge.userId,
        entity: "Auth",
        entityId: challenge.id,
        action: "password_reset_confirmed"
      }
    });
  });

  return { ok: true };
}

export async function bootstrapOwnerAccount(input: unknown): Promise<{
  ok: true;
  tenant: { id: string; slug: string; name: string };
  owner: { id: string; email: string };
}> {
  const data = bootstrapOwnerSchema.parse(input);
  assertPassword(data.ownerPassword);
  const existing = await prisma.tenant.findUnique({
    where: { slug: data.tenantSlug },
    include: {
      users: { where: { role: "owner" }, select: { id: true }, take: 1 }
    }
  });

  if (existing?.users[0]) {
    throw new Error("Essa empresa ja possui conta dona criada.");
  }

  const passwordHash = await bcrypt.hash(data.ownerPassword, BCRYPT_ROUNDS);

  const result = await prisma.$transaction(async (tx) => {
    const tenant =
      existing ??
      (await tx.tenant.create({
        data: {
          name: data.companyName.trim(),
          slug: data.tenantSlug.trim().toLowerCase(),
          plan: "enterprise",
          billingStatus: "active"
        }
      }));

    const owner = await tx.user.create({
      data: {
        tenantId: tenant.id,
        name: data.ownerName.trim(),
        email: data.ownerEmail.trim().toLowerCase(),
        passwordHash,
        role: "owner",
        status: "active",
        phone: normalizePhone(data.ownerPhone),
        twoFactorEnabled: true,
        permissions: ["*"]
      },
      select: { id: true, email: true }
    });

    const instanceName = `${tenant.slug}-comercial`.slice(0, 48);
    await tx.whatsAppInstance.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: instanceName } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: instanceName,
        label: "WhatsApp Comercial",
        status: "created",
        phone: normalizePhone(data.ownerPhone)
      }
    });

    const pipeline = await tx.pipeline.create({
      data: {
        tenantId: tenant.id,
        name: "Pipeline Comercial"
      }
    });
    await Promise.all(
      DEFAULT_STAGES.map((stage, index) =>
        tx.pipelineStage.create({
          data: {
            pipelineId: pipeline.id,
            name: stage,
            order: index,
            color: index >= 5 ? "#12b981" : "#1f6fff"
          }
        })
      )
    );

    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorId: owner.id,
        entity: "Auth",
        entityId: owner.id,
        action: "owner_bootstrap_created",
        metadata: { tenantSlug: tenant.slug, ownerEmail: owner.email }
      }
    });

    return {
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      owner
    };
  });

  return { ok: true, ...result };
}

export async function requestTenantAccess(input: unknown): Promise<{ ok: true; message: string }> {
  const data = requestAccessSchema.parse(input);
  assertPassword(data.password);
  const tenant = await prisma.tenant.findUnique({
    where: { slug: data.tenantSlug.toLowerCase() },
    include: { users: { where: { role: "owner" }, select: { id: true }, take: 1 } }
  });
  if (!tenant) throw new Error("Empresa nao encontrada.");
  if (!tenant.users[0]) throw new Error("Conta dona ainda nao foi criada para esta empresa.");

  const email = data.email.trim().toLowerCase();
  const exists = await prisma.user.findFirst({ where: { tenantId: tenant.id, email } });
  if (exists) throw new Error("Ja existe solicitacao ou conta com este e-mail.");

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: data.name.trim(),
      email,
      passwordHash,
      role: "agent",
      status: "inactive",
      phone: data.phone ? normalizePhone(data.phone) : null,
      twoFactorEnabled: false,
      permissions: []
    }
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      entity: "Auth",
      action: "access_request_created",
      metadata: { email, name: data.name }
    }
  });

  return {
    ok: true,
    message: "Solicitacao criada. Aguarde aprovacao do dono para ativacao do acesso."
  };
}

export async function getBootstrapStatus(tenantSlug?: string): Promise<{ canBootstrap: boolean }> {
  const slug = (tenantSlug ?? "").trim().toLowerCase();
  if (!slug) return { canBootstrap: false };

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: {
      users: {
        where: { role: "owner" },
        select: { id: true },
        take: 1
      }
    }
  });

  if (!tenant) return { canBootstrap: true };
  return { canBootstrap: !tenant.users[0] };
}

export async function logout(user: SessionUser, context?: AccessContext) {
  await revokeUserSessions(user.id);
  await recordAuthAudit(user.tenantId, user.id, "auth_logout", context);
  return { ok: true as const };
}

export function verifyToken(token: string): SessionUser {
  return readSessionToken(token).user;
}

function normalizeRole(role: string) {
  return role.trim().toLowerCase();
}

function normalizePermissions(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value === "*") return ["*"];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "*") return ["*"];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch {
        return [];
      }
    }
  }
  return [];
}

export function hasFullAccess(user: Pick<SessionUser, "role" | "permissions">) {
  const role = normalizeRole(user.role ?? "agent");
  if (role === "owner" || role === "admin") return true;
  return normalizePermissions(user.permissions).includes("*");
}

export function hasPermission(user: SessionUser, permission: string) {
  if (hasFullAccess(user)) return true;
  return normalizePermissions(user.permissions).includes(permission);
}

