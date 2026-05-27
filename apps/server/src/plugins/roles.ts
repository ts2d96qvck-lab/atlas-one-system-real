import type { FastifyReply, FastifyRequest } from "fastify";
import { requireUser } from "./auth";
import { sendError } from "../utils/http";

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = requireUser(request);
    if (user.role === "owner" || roles.includes(user.role)) return;
    return sendError(reply, 403, "Sem permissao para esta acao");
  };
}
