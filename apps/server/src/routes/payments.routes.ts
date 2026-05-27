import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma";
import { runLeadStageAutomations } from "../services/automation.service";
import { applySubscriptionWebhook } from "../services/billing/billing.service";
import { handlePaymentProviderWebhook } from "../services/billing/payment-gateway.service";
import { verifyPaymentsWebhook, verifyAsaasWebhook } from "../lib/webhook-auth";

export async function paymentsRoutes(app: FastifyInstance) {
  const handleWebhook = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyPaymentsWebhook(request)) {
      return reply.status(401).send({ ok: false, error: "webhook_unauthorized" });
    }
    const body = request.body as {
      tenantSlug?: string;
      event?: string;
      customerPhone?: string;
      amount?: number;
      status?: string;
    };

    const tenant = await prisma.tenant.findFirst({
      where: { slug: body.tenantSlug ?? "atlas-one" }
    });
    if (!tenant) return reply.status(404).send({ ok: false, error: "tenant_not_found" });

    const phone = String(body.customerPhone ?? "").replace(/\D/g, "");
    const lead = phone
      ? await prisma.lead.findFirst({ where: { tenantId: tenant.id, phone } })
      : null;

    let newStatus = lead?.status ?? "Novos leads";
    if (body.event === "payment.paid" || body.status === "paid") newStatus = "Fechado";
    if (body.event === "payment.overdue" || body.status === "overdue") newStatus = "Negociacao";

    if (lead) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: newStatus, value: body.amount ?? lead.value }
      });
      await runLeadStageAutomations(tenant.id, lead.id, newStatus);
    }

    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        entity: "Payment",
        action: String(body.event ?? "webhook.received"),
        metadata: body as object
      }
    });

    return reply.send({ ok: true, leadId: lead?.id ?? null, status: newStatus });
  };

  const handleSubscriptionWebhook = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyPaymentsWebhook(request)) {
      return reply.status(401).send({ ok: false, error: "webhook_unauthorized" });
    }
    const body = request.body as {
      tenantSlug?: string;
      event?: string;
      plan?: string;
      billingStatus?: "active" | "overdue" | "blocked";
      externalCustomerId?: string;
      provider?: string;
    };
    if (!body.tenantSlug) {
      return reply.status(400).send({ ok: false, error: "tenantSlug obrigatorio" });
    }
    try {
      const updated = await applySubscriptionWebhook({
        tenantSlug: body.tenantSlug,
        event: body.event,
        plan: body.plan,
        billingStatus: body.billingStatus,
        externalCustomerId: body.externalCustomerId,
        provider: body.provider
      });
      await prisma.auditLog.create({
        data: {
          tenantId: updated.id,
          entity: "Subscription",
          action: String(body.event ?? "subscription.updated"),
          metadata: body as object
        }
      });
      return reply.send({ ok: true, tenantId: updated.id, plan: updated.plan, billingStatus: updated.billingStatus });
    } catch (error) {
      return reply.status(404).send({
        ok: false,
        error: error instanceof Error ? error.message : "subscription_webhook_failed"
      });
    }
  };

  app.post("/webhook/atlas-one", handleWebhook);
  app.post("/webhook/cashfest", handleWebhook);
  app.post("/webhook/subscription", handleSubscriptionWebhook);

  app.post("/webhook/asaas", async (request, reply) => {
    if (!verifyAsaasWebhook(request)) {
      return reply.status(401).send({ ok: false, error: "webhook_unauthorized" });
    }
    try {
      const result = await handlePaymentProviderWebhook("asaas", request.body, request.headers as Record<string, unknown>);
      return reply.send(result);
    } catch (error) {
      return reply.status(400).send({
        ok: false,
        error: error instanceof Error ? error.message : "asaas_webhook_failed"
      });
    }
  });
}
