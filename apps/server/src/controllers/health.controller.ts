import type { FastifyReply, FastifyRequest } from "fastify";

export async function healthController(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    ok: true,
    service: "atlas-one-server",
    version: "0.1.0",
    environment: process.env.NODE_ENV ?? "development"
  });
}

