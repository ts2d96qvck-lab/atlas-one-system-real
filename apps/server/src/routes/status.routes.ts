import type { FastifyInstance } from "fastify";
import { getPublicStatus } from "../services/ops/status.service";

export async function statusRoutes(app: FastifyInstance) {
  app.get("/status", async (_request, reply) => {
    return reply.send(await getPublicStatus());
  });

  app.get("/api/status", async (_request, reply) => {
    return reply.send(await getPublicStatus());
  });
}
