import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { applySubscriptionWebhook } from "./billing.service";
import { normalizePlanId } from "./plans";
import type { CheckoutSessionInput, PaymentGatewayProvider, PaymentProviderId } from "./payment-gateway.types";
import { asaasPaymentProvider } from "./providers/asaas.provider";
import { manualPaymentProvider } from "./providers/manual.provider";

const providers: PaymentGatewayProvider[] = [asaasPaymentProvider, manualPaymentProvider];

function activeProvider(): PaymentGatewayProvider {
  const preferred = (env.paymentProvider ?? "manual") as PaymentProviderId;
  const match = providers.find((provider) => provider.id === preferred && provider.isConfigured());
  if (match) return match;
  return providers.find((provider) => provider.isConfigured()) ?? manualPaymentProvider;
}

function readBillingSettings(settings: unknown) {
  const root =
    settings && typeof settings === "object" && !Array.isArray(settings) ? (settings as Record<string, unknown>) : {};
  const billing =
    root.billing && typeof root.billing === "object" && !Array.isArray(root.billing)
      ? (root.billing as Record<string, unknown>)
      : {};
  return billing;
}

export function listPaymentProviders() {
  return providers.map((provider) => ({
    id: provider.id,
    configured: provider.isConfigured()
  }));
}

export async function createPlanCheckout(tenantId: string, planId: string, actorEmail: string, actorName: string) {
  const normalized = normalizePlanId(planId);
  if (normalized === "enterprise") {
    throw new Error("Plano Enterprise requer contato comercial.");
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Empresa nao encontrada");

  const provider = activeProvider();
  const input: CheckoutSessionInput = {
    tenantId,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    planId: normalized as "starter" | "pro",
    customerEmail: actorEmail,
    customerName: actorName
  };

  const session = await provider.createCheckoutSession(input);

  if (session.externalCustomerId || session.externalSubscriptionId) {
    const settings =
      tenant.settings && typeof tenant.settings === "object" && !Array.isArray(tenant.settings)
        ? (tenant.settings as Record<string, unknown>)
        : {};
    const billing = readBillingSettings(settings);
    const nextBilling = {
      ...billing,
      provider: session.provider,
      externalCustomerId: session.externalCustomerId ?? billing.externalCustomerId,
      externalSubscriptionId: session.externalSubscriptionId ?? billing.externalSubscriptionId,
      subscriptionStatus: "pending"
    };

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: { ...settings, billing: nextBilling } as Prisma.InputJsonObject
      }
    });
  }

  return {
    ...session,
    plan: normalized
  };
}

export async function handlePaymentProviderWebhook(
  providerId: PaymentProviderId,
  body: unknown,
  headers: Record<string, unknown>
) {
  const provider = providers.find((item) => item.id === providerId);
  if (!provider) throw new Error("Provider desconhecido");

  const event = provider.parseWebhook(body, headers);
  if (!event?.tenantSlug) return { ok: true, ignored: true };

  const updated = await applySubscriptionWebhook({
    tenantSlug: event.tenantSlug,
    event: event.event,
    plan: event.plan,
    billingStatus: event.billingStatus,
    externalCustomerId: event.externalCustomerId,
    provider: event.provider
  });

  return { ok: true, tenantId: updated.id, plan: updated.plan, billingStatus: updated.billingStatus };
}
