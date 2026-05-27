import type { FastifyInstance } from "fastify";
import { requireAuth, requireUser } from "../plugins/auth";
import { requirePermission } from "../plugins/permissions";
import { getDashboard } from "../services/dashboard.service";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [requireAuth, requirePermission("dashboard:read")] }, async (request, reply) => {
    const user = requireUser(request);
    return reply.send(await getDashboard(user.tenantId, { userId: user.id, role: user.role }));
  });
}

