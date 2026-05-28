import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { requireAuth, requireUser } from "../plugins/auth";
import { requirePermission } from "../plugins/permissions";
import { getSlaMetrics } from "../services/ops/sla.service";
import { getTenantDiagnostics } from "../services/ops/diagnostics.service";
import {
  exportConversationsCsv,
  exportLeadsCsv,
  exportMessagesCsv
} from "../services/ops/export.service";
import { auditDataExport } from "../services/audit.service";

function scopeFromUser(user: ReturnType<typeof requireUser>) {
  return { userId: user.id, role: user.role };
}

export async function opsRoutes(app: FastifyInstance) {
  const guard = [requireAuth, requirePermission("dashboard:read")];
  const exportGuard = [...guard];

  app.get("/sla", { preHandler: guard }, async (request, reply) => {
    const user = requireUser(request);
    const query = request.query as { days?: string };
    const days = Math.min(90, Math.max(7, Number(query.days ?? 30) || 30));
    return reply.send(await getSlaMetrics(user.tenantId, scopeFromUser(user), days));
  });

  app.get("/diagnostics", { preHandler: [requireAuth, requirePermission("admin:read")] }, async (request, reply) => {
    const user = requireUser(request);
    return reply.send(await getTenantDiagnostics(user.tenantId));
  });

  await app.register(async (exportApp) => {
    await exportApp.register(rateLimit, { max: 20, timeWindow: "15 minutes" });

    exportApp.get("/export/leads.csv", { preHandler: exportGuard }, async (request, reply) => {
      const user = requireUser(request);
      const csv = await exportLeadsCsv(user.tenantId, scopeFromUser(user));
      await auditDataExport(user.tenantId, user.id, "leads.csv", { source: "ops" });
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", 'attachment; filename="atlas-leads.csv"');
      return reply.send(csv);
    });

    exportApp.get("/export/conversations.csv", { preHandler: exportGuard }, async (request, reply) => {
      const user = requireUser(request);
      const csv = await exportConversationsCsv(user.tenantId, scopeFromUser(user));
      await auditDataExport(user.tenantId, user.id, "conversations.csv", { source: "ops" });
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", 'attachment; filename="atlas-conversas.csv"');
      return reply.send(csv);
    });

    exportApp.get("/export/messages.csv", { preHandler: exportGuard }, async (request, reply) => {
      const user = requireUser(request);
      const query = request.query as { from?: string; to?: string };
      const from = query.from ? new Date(query.from) : undefined;
      const to = query.to ? new Date(query.to) : undefined;
      const csv = await exportMessagesCsv(user.tenantId, scopeFromUser(user), {
        from: from && !Number.isNaN(from.getTime()) ? from : undefined,
        to: to && !Number.isNaN(to.getTime()) ? to : undefined
      });
      await auditDataExport(user.tenantId, user.id, "messages.csv", { source: "ops", from: query.from, to: query.to });
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", 'attachment; filename="atlas-mensagens.csv"');
      return reply.send(csv);
    });
  });
}
