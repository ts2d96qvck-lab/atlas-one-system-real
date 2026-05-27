import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env";
import { requireUser } from "./auth";
import { sendError } from "../utils/http";

export function isPlatformAdmin(email: string) {
  const normalized = email.trim().toLowerCase();
  return env.platformAdminEmails.includes(normalized);
}

export function requirePlatformAdmin() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = requireUser(request);
    if (!isPlatformAdmin(user.email)) {
      return sendError(reply, 403, "Acesso restrito a administradores da plataforma Atlas One");
    }
  };
}
