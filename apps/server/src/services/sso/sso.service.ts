import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { BCRYPT_ROUNDS } from "../../lib/security/bcrypt";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { completeLogin, type SessionUser } from "../auth.service";
import { assertCanAddUser } from "../billing/billing.service";
import { getOidcProviderConfig, listConfiguredOidcProviders, type OidcProviderId } from "./oidc-config";
import {
  buildAuthorizationUrl,
  createOidcStartState,
  exchangeAuthorizationCode,
  verifyIdToken,
  verifyOidcState
} from "./oidc-client";

type AccessContext = {
  ip?: string;
  userAgent?: string;
};

export type TenantSsoSettings = {
  enabled: boolean;
  providers: OidcProviderId[];
  jitProvisioning: boolean;
};

function settingsObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

export function readTenantSsoSettings(settings: unknown, plan?: string): TenantSsoSettings {
  const root = settingsObject(settings);
  const sso = settingsObject(root.sso);
  const providers = Array.isArray(sso.providers)
    ? sso.providers.map(String).filter((p): p is OidcProviderId => p === "google" || p === "microsoft" || p === "oidc")
    : [];

  let enabled: boolean;
  if (typeof sso.enabled === "boolean") {
    enabled = sso.enabled;
  } else {
    enabled = plan === "enterprise";
  }

  return {
    enabled,
    providers: providers.length ? providers : ["google"],
    jitProvisioning: sso.jitProvisioning === true
  };
}

export function listSsoProvidersForTenant(settings: unknown, plan?: string) {
  const tenantSso = readTenantSsoSettings(settings, plan);
  if (!tenantSso.enabled) return [];

  return listConfiguredOidcProviders().filter((provider) => tenantSso.providers.includes(provider.id));
}

export async function getTenantSsoSettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true, plan: true }
  });
  if (!tenant) throw new Error("Empresa nao encontrada");
  const settings = readTenantSsoSettings(tenant.settings, tenant.plan);
  return {
    ...settings,
    availableProviders: listConfiguredOidcProviders()
  };
}

const updateSsoSchema = z.object({
  enabled: z.boolean().optional(),
  providers: z.array(z.enum(["google", "microsoft", "oidc"])).optional(),
  jitProvisioning: z.boolean().optional()
});

export async function updateTenantSsoSettings(tenantId: string, input: unknown) {
  const data = updateSsoSchema.parse(input);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  if (!tenant) throw new Error("Empresa nao encontrada");

  const current = readTenantSsoSettings(tenant.settings);
  const next: TenantSsoSettings = {
    enabled: data.enabled ?? current.enabled,
    providers: data.providers ?? current.providers,
    jitProvisioning: data.jitProvisioning ?? current.jitProvisioning
  };

  const merged = {
    ...settingsObject(tenant.settings),
    sso: next
  };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: merged as Prisma.InputJsonObject }
  });

  return getTenantSsoSettings(tenantId);
}

export function buildOidcStartRedirect(providerId: string, tenantSlug: string) {
  const config = getOidcProviderConfig(providerId);
  if (!config) throw new Error("Provedor SSO nao configurado no servidor");

  const { state, nonce } = createOidcStartState(providerId, tenantSlug.trim().toLowerCase());
  return buildAuthorizationUrl(config, { state, nonce });
}

async function linkExternalIdentity(params: {
  tenantId: string;
  userId: string;
  provider: string;
  subject: string;
  email: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.externalIdentity.upsert({
    where: {
      tenantId_provider_providerSubject: {
        tenantId: params.tenantId,
        provider: params.provider,
        providerSubject: params.subject
      }
    },
    create: {
      tenantId: params.tenantId,
      userId: params.userId,
      provider: params.provider,
      providerSubject: params.subject,
      email: params.email,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonObject
    },
    update: {
      userId: params.userId,
      email: params.email,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonObject
    }
  });
}

function sessionFromUser(
  user: { id: string; tenantId: string; name: string; email: string; role: string; permissions: unknown },
  tenantSlug: string
): SessionUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    tenantSlug,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: Array.isArray(user.permissions) ? user.permissions.map(String) : []
  };
}

async function resolveSsoUser(params: {
  tenantId: string;
  tenantSlug: string;
  provider: string;
  subject: string;
  email: string;
  name?: string;
  jitProvisioning: boolean;
}) {
  const linked = await prisma.externalIdentity.findUnique({
    where: {
      tenantId_provider_providerSubject: {
        tenantId: params.tenantId,
        provider: params.provider,
        providerSubject: params.subject
      }
    },
    include: { user: true }
  });

  if (linked?.user && linked.user.status === "active") {
    return linked.user;
  }

  const existing = await prisma.user.findFirst({
    where: { tenantId: params.tenantId, email: params.email, status: "active" }
  });

  if (existing) {
    await linkExternalIdentity({
      tenantId: params.tenantId,
      userId: existing.id,
      provider: params.provider,
      subject: params.subject,
      email: params.email
    });
    return existing;
  }

  if (!params.jitProvisioning) {
    throw new Error("Usuario nao autorizado. Solicite convite ao administrador da empresa.");
  }

  await assertCanAddUser(params.tenantId);

  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), BCRYPT_ROUNDS);
  const created = await prisma.user.create({
    data: {
      tenantId: params.tenantId,
      name: params.name?.trim() || params.email.split("@")[0] || "Usuario SSO",
      email: params.email,
      passwordHash,
      role: "agent",
      status: "active",
      permissions: []
    }
  });

  await linkExternalIdentity({
    tenantId: params.tenantId,
    userId: created.id,
    provider: params.provider,
    subject: params.subject,
    email: params.email,
    metadata: { source: "jit" }
  });

  return created;
}

export async function handleOidcCallback(query: { code?: string; state?: string; error?: string }, context?: AccessContext) {
  if (query.error) throw new Error(`SSO cancelado: ${query.error}`);
  if (!query.code || !query.state) throw new Error("Callback SSO incompleto");

  const statePayload = verifyOidcState(query.state);
  const config = getOidcProviderConfig(statePayload.provider);
  if (!config) throw new Error("Provedor SSO nao configurado");

  const tenant = await prisma.tenant.findUnique({ where: { slug: statePayload.tenantSlug } });
  if (!tenant) throw new Error("Empresa nao encontrada");

  const tenantSso = readTenantSsoSettings(tenant.settings, tenant.plan);
  if (!tenantSso.enabled) throw new Error("SSO desabilitado para esta empresa");
  if (!tenantSso.providers.includes(config.id)) throw new Error("Provedor SSO nao habilitado para esta empresa");

  if (tenant.billingStatus === "blocked" || tenant.blockedAt) {
    throw new Error("Conta bloqueada por pendencia de pagamento");
  }

  const tokens = await exchangeAuthorizationCode(config, query.code, statePayload.codeVerifier);
  const identity = await verifyIdToken(config, tokens.idToken, statePayload.nonce);

  const user = await resolveSsoUser({
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    provider: config.id,
    subject: identity.subject,
    email: identity.email,
    name: identity.name,
    jitProvisioning: tenantSso.jitProvisioning
  });

  const sessionUser = sessionFromUser(user, tenant.slug);
  const login = await completeLogin(sessionUser, user.tokenVersion, context, {
    mode: "oidc",
    provider: config.id
  });

  return login;
}

export function buildSsoSuccessRedirect(token: string) {
  const base = env.appPublicUrl.replace(/\/$/, "");
  return `${base}/#sso_token=${encodeURIComponent(token)}`;
}

export function buildSsoErrorRedirect(message: string) {
  const base = env.appPublicUrl.replace(/\/$/, "");
  return `${base}/#sso_error=${encodeURIComponent(message)}`;
}

export { listConfiguredOidcProviders };
