import type { FastifyReply, FastifyRequest } from "fastify";
import { extractApiKeyFromRequest } from "../lib/security/api-key";
import { apiKeyHasScope, resolveApiKey, type ApiKeyContext } from "../services/integrations/api-key.service";
import { sendError } from "../utils/http";

declare module "fastify" {
  interface FastifyRequest {
    apiKey?: ApiKeyContext;
  }
}

export async function requireApiKey(request: FastifyRequest, reply: FastifyReply) {
  const raw = extractApiKeyFromRequest(request.headers as Record<string, string | string[] | undefined>);
  if (!raw) {
    return sendError(reply, 401, "API key obrigatoria", "Use Authorization: Bearer atlas_live_... ou X-Api-Key");
  }

  const ctx = await resolveApiKey(raw);
  if (!ctx) {
    return sendError(reply, 401, "API key invalida ou revogada");
  }

  request.apiKey = ctx;
}

export function requireApiScope(scope: "read" | "write") {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx = request.apiKey;
    if (!ctx) return sendError(reply, 401, "API key obrigatoria");
    if (!apiKeyHasScope(ctx, scope)) {
      return sendError(reply, 403, "Escopo insuficiente para esta acao");
    }
  };
}

export function requireApiTenant(request: FastifyRequest) {
  const ctx = request.apiKey;
  if (!ctx) throw new Error("API key obrigatoria");
  return ctx;
}
