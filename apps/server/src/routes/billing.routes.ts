import type { FastifyInstance } from "fastify";
import { requireAuth, requireUser } from "../plugins/auth";
import { requireRole } from "../plugins/roles";
import { requirePermission } from "../plugins/permissions";
import { requirePlatformAdmin } from "../plugins/platform-admin";
import {
  getTenantBillingOverview,
  listPlansCatalog,
  updateTenantPlan
} from "../services/billing/billing.service";
import { getCommercialAccessOverview, recordManualPayment } from "../services/billing/commercial.service";
import { createPlanCheckout, listPaymentProviders } from "../services/billing/payment-gateway.service";
import { normalizePlanId } from "../services/billing/plans";
import { sendError } from "../utils/http";
import { z } from "zod";

const updatePlanSchema = z.object({
  plan: z.enum(["starter", "pro", "enterprise"])
});

const checkoutSchema = z.object({
  plan: z.enum(["starter", "pro"])
});

export async function billingRoutes(app: FastifyInstance) {
  const readGuard = [requireAuth, requireRole("owner", "admin"), requirePermission("admin:read")];

  app.get("/overview", { preHandler: readGuard }, async (request, reply) => {
    const user = requireUser(request);
    return reply.send(await getCommercialAccessOverview(user.tenantId));
  });

  app.post(
    "/manual-payment",
    { preHandler: [requireAuth, requireRole("owner", "admin"), requirePermission("admin:user:update")] },
    async (request, reply) => {
      const user = requireUser(request);
      const body = request.body as {
        status?: "active" | "overdue" | "blocked";
        note?: string;
        amount?: number;
        paidAt?: string;
      };
      if (!body.status) return sendError(reply, 400, "Status obrigatorio");
      try {
        return reply.send(
          await recordManualPayment(user.tenantId, {
            status: body.status,
            note: body.note,
            amount: body.amount,
            paidAt: body.paidAt,
            actorId: user.id
          })
        );
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel registrar pagamento", error instanceof Error ? error.message : error);
      }
    }
  );

  app.get("/plans", { preHandler: readGuard }, async (_request, reply) => {
    return reply.send({ plans: listPlansCatalog(), paymentProviders: listPaymentProviders() });
  });

  app.post("/checkout", { preHandler: [requireAuth, requireRole("owner", "admin"), requirePermission("admin:user:update")] }, async (request, reply) => {
    const user = requireUser(request);
    try {
      const body = checkoutSchema.parse(request.body);
      return reply.send(
        await createPlanCheckout(user.tenantId, body.plan, user.email, user.name)
      );
    } catch (error) {
      return sendError(reply, 400, "Nao foi possivel iniciar checkout", error instanceof Error ? error.message : error);
    }
  });

  app.patch(
    "/tenants/:tenantId/plan",
    { preHandler: [requireAuth, requirePlatformAdmin()] },
    async (request, reply) => {
      const user = requireUser(request);
      const { tenantId } = request.params as { tenantId: string };
      try {
        const body = updatePlanSchema.parse(request.body);
        const updated = await updateTenantPlan(tenantId, normalizePlanId(body.plan), user.id);
        return reply.send(updated);
      } catch (error) {
        return sendError(reply, 400, "Nao foi possivel atualizar plano", error instanceof Error ? error.message : error);
      }
    }
  );
}
