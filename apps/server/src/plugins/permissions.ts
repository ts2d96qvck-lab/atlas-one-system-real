import type { FastifyReply, FastifyRequest } from "fastify";
import { requireUser } from "./auth";
import { hasPermission } from "../services/auth.service";
import { sendError } from "../utils/http";

export function requirePermission(...permissions: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = requireUser(request);
    if (!permissions.length) return;
    if (permissions.some((permission) => hasPermission(user, permission))) return;
    return sendError(reply, 403, "Sem permissao para esta acao");
  };
}
