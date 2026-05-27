import type { FastifyReply, FastifyRequest } from "fastify";
import type { SessionUser } from "../services/auth.service";
import { requireSessionToken } from "../lib/session";

declare module "fastify" {
  interface FastifyRequest {
    user?: SessionUser;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const user = await requireSessionToken(token, reply);
  if (!user) return;
  request.user = user;
}

export function requireUser(request: FastifyRequest): SessionUser {
  if (!request.user) {
    throw new Error("Usuario nao autenticado");
  }
  return request.user;
}
