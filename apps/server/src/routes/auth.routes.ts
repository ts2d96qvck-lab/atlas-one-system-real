import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import {
  bootstrapOwnerAccount,
  confirmPasswordReset,
  login,
  logout,
  publicUser,
  requestPasswordReset,
  requestTenantAccess,
  resolveBootstrapStatus,
  verifyLoginCode
} from "../services/auth.service";
import { acceptUserInvite, previewUserInvite } from "../services/invite.service";
import { requireAuth, requireUser } from "../plugins/auth";
import { sendError, clientMessage, safeClientMessage } from "../utils/http";
import { listAuthProviders } from "../lib/auth";
import {
  buildOidcStartRedirect,
  buildSsoErrorRedirect,
  buildSsoSuccessRedirect,
  handleOidcCallback,
  listSsoProvidersForTenant
} from "../services/sso/sso.service";
import { env } from "../config/env";
import { isSetupAuthorizedForTenant } from "../lib/security/validate-env";
import { prisma } from "../lib/prisma";
import { resolveClientIp } from "../lib/client-ip";
import { AuthLoginError, formatZodIssues } from "../lib/auth-login-errors";

function readSetupCredential(request: { headers: Record<string, unknown>; query?: unknown }) {
  const header = request.headers["x-setup-token"];
  if (typeof header === "string" && header.trim()) return header.trim();
  const query = request.query as { setup?: string };
  if (typeof query.setup === "string" && query.setup.trim()) return query.setup.trim();
  return undefined;
}
import { appLog } from "../lib/app-log";

export async function authRoutes(app: FastifyInstance) {
  await app.register(async (authApp) => {
    await authApp.register(rateLimit, {
      max: env.qaBypassRateLimit ? 10_000 : 30,
      timeWindow: "15 minutes"
    });

    authApp.post("/login", async (request, reply) => {
      const requestId = request.requestId;
      const accessContext = {
        ip: resolveClientIp(request),
        userAgent: request.headers["user-agent"],
        requestId,
        host: typeof request.headers.host === "string" ? request.headers.host : undefined
      };

      appLog.info("auth_login_request", {
        requestId,
        host: accessContext.host,
        clientIp: accessContext.ip,
        origin: request.headers.origin ?? null,
        userAgent: accessContext.userAgent ?? null
      });

      try {
        const result = await login(request.body, accessContext);
        appLog.info("auth_login_response", {
          requestId,
          requires2fa: result.requires2fa,
          role: result.requires2fa ? result.role : result.user.role
        });
        return reply.send(result);
      } catch (error) {
        if (error instanceof ZodError) {
          const detail = formatZodIssues(error.issues);
          appLog.warn("auth_login_schema_error", { requestId, detail });
          return sendError(reply, 422, "Dados de login invalidos", detail, {
            requestId,
            exposeMessage: true
          });
        }

        if (error instanceof AuthLoginError) {
          appLog.warn("auth_login_rejected", {
            requestId,
            code: error.code,
            message: error.message
          });
          if (error.code === "invalid_credentials") {
            return sendError(reply, 401, "Falha no login", "Credenciais invalidas", {
              requestId,
              exposeMessage: true
            });
          }
          if (error.code === "rate_limited") {
            return sendError(reply, 429, "Muitas tentativas", error.message, {
              requestId,
              exposeMessage: true
            });
          }
          if (error.code === "billing_blocked") {
            return sendError(reply, 403, "Conta bloqueada", error.message, {
              requestId,
              exposeMessage: true
            });
          }
          if (error.code === "trial_expired") {
            return sendError(reply, 403, "Trial encerrado", error.message, {
              requestId,
              exposeMessage: true
            });
          }
          return sendError(reply, 422, "Verificacao adicional necessaria", error.message, {
            requestId,
            exposeMessage: true
          });
        }

        appLog.error("auth_login_unexpected", {
          requestId,
          message: error instanceof Error ? error.message : String(error)
        });
        return sendError(reply, 500, "Erro interno no login", clientMessage(error, "Erro interno"), {
          requestId,
          exposeMessage: false
        });
      }
    });

    authApp.post("/login/verify-code", async (request, reply) => {
      try {
        return reply.send(
          await verifyLoginCode(request.body, {
            ip: request.ip,
            userAgent: request.headers["user-agent"]
          })
        );
      } catch (error) {
        return sendError(reply, 400, "Codigo invalido ou expirado", error instanceof Error ? error.message : error);
      }
    });

    authApp.post("/password/request-reset", async (request, reply) => {
      try {
        return reply.send(await requestPasswordReset(request.body));
      } catch (error) {
        return sendError(reply, 400, "Falha ao solicitar recuperacao", error instanceof Error ? error.message : error);
      }
    });

    authApp.post("/password/confirm-reset", async (request, reply) => {
      try {
        return reply.send(await confirmPasswordReset(request.body));
      } catch (error) {
        return sendError(reply, 400, "Falha ao redefinir senha", error instanceof Error ? error.message : error);
      }
    });
  });

  await app.register(async (publicApp) => {
    await publicApp.register(rateLimit, {
      max: env.qaBypassRateLimit ? 10_000 : 10,
      timeWindow: "15 minutes"
    });

    publicApp.post("/bootstrap-owner", async (request, reply) => {
      const body = request.body as { tenantSlug?: string };
      const credential = readSetupCredential(request);
      if (!isSetupAuthorizedForTenant(credential, body.tenantSlug)) {
        return sendError(
          reply,
          403,
          "Cadastro requer link de onboarding valido",
          "Solicite um novo link de onboarding enviado pela Atlas."
        );
      }
      const status = await resolveBootstrapStatus(body.tenantSlug, true);
      if (!status.canBootstrap) {
        return sendError(
          reply,
          400,
          status.blockedReason ?? "Esta empresa ja possui cadastro. Entre com sua conta ou solicite acesso como equipe."
        );
      }
      try {
        const created = await bootstrapOwnerAccount(request.body);
        return reply.status(201).send(created);
      } catch (error) {
        return sendError(
          reply,
          400,
          "Nao foi possivel criar conta dona",
          safeClientMessage(error, "Nao foi possivel criar conta dona")
        );
      }
    });

    publicApp.post("/request-access", async (request, reply) => {
      try {
        return reply.status(201).send(await requestTenantAccess(request.body));
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel solicitar acesso", error instanceof Error ? error.message : error);
      }
    });

    publicApp.get("/bootstrap-status", async (request, reply) => {
      try {
        const query = request.query as { tenantSlug?: string };
        const credential = readSetupCredential(request);
        const setupAuthorized = isSetupAuthorizedForTenant(credential, query.tenantSlug);
        return reply.send(await resolveBootstrapStatus(query.tenantSlug, setupAuthorized));
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel verificar status", safeClientMessage(error, "Nao foi possivel verificar status"));
      }
    });

    publicApp.get("/invite/preview", async (request, reply) => {
      try {
        const query = request.query as { token?: string; tenant?: string };
        if (!query.token || !query.tenant) {
          return sendError(reply, 400, "Convite invalido");
        }
        return reply.send(await previewUserInvite(query.token, query.tenant));
      } catch (error) {
        return sendError(reply, 400, "Convite invalido ou expirado", clientMessage(error, "Convite invalido"));
      }
    });

    publicApp.post("/invite/accept", async (request, reply) => {
      try {
        return reply.send(await acceptUserInvite(request.body));
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel aceitar convite", clientMessage(error, "Convite invalido"));
      }
    });
  });

  app.get("/me", { preHandler: requireAuth }, async (request, reply) => {
    const user = requireUser(request);
    return reply.send({ user: publicUser(user) });
  });

  app.get("/providers", async (request, reply) => {
    const query = request.query as { tenant?: string };
    const globalProviders = listAuthProviders();

    if (!query.tenant) {
      return reply.send({ providers: globalProviders });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug: query.tenant.trim().toLowerCase() },
      select: { settings: true, plan: true }
    });

    if (!tenant) {
      return reply.send({ providers: globalProviders.filter((provider) => provider.kind === "local") });
    }

    const ssoProviders = listSsoProvidersForTenant(tenant.settings, tenant.plan).map((provider) => ({
      kind: "oidc" as const,
      id: provider.id,
      displayName: provider.displayName,
      configured: true
    }));

    return reply.send({
      providers: [
        ...globalProviders.filter((provider) => provider.kind === "local"),
        ...ssoProviders
      ]
    });
  });

  app.get("/oidc/:provider/start", async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const query = request.query as { tenant?: string };
    if (!query.tenant) {
      return sendError(reply, 400, "Empresa obrigatoria", "Informe o ID da empresa (tenant).");
    }

    try {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: query.tenant.trim().toLowerCase() },
        select: { settings: true, plan: true }
      });
      if (!tenant) throw new Error("Empresa nao encontrada");

      const allowed = listSsoProvidersForTenant(tenant.settings, tenant.plan);
      if (!allowed.some((item) => item.id === provider)) {
        throw new Error("SSO nao habilitado para esta empresa");
      }

      const redirectUrl = buildOidcStartRedirect(provider, query.tenant);
      return reply.redirect(redirectUrl);
    } catch (error) {
      return reply.redirect(buildSsoErrorRedirect(clientMessage(error, "Falha ao iniciar SSO")));
    }
  });

  app.get("/oidc/callback", async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };
    try {
      const result = await handleOidcCallback(query, {
        ip: request.ip,
        userAgent: request.headers["user-agent"]
      });
      return reply.redirect(buildSsoSuccessRedirect(result.token));
    } catch (error) {
      return reply.redirect(buildSsoErrorRedirect(clientMessage(error, "Falha no login SSO")));
    }
  });

  app.post("/logout", { preHandler: requireAuth }, async (request, reply) => {
    const user = requireUser(request);
    return reply.send(
      await logout(user, {
        ip: request.ip,
        userAgent: request.headers["user-agent"]
      })
    );
  });
}
