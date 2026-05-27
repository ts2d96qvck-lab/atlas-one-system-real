import type { CheckoutSessionInput, CheckoutSessionResult, PaymentGatewayProvider, PaymentWebhookEvent } from "../payment-gateway.types";
import { env } from "../../../config/env";

type AsaasCustomer = { id: string };
type AsaasSubscription = { id: string; invoiceUrl?: string; bankSlipUrl?: string };

function asaasBaseUrl() {
  return env.asaasEnv === "production" ? "https://api.asaas.com/api/v3" : "https://sandbox.asaas.com/api/v3";
}

function asaasToken() {
  return env.asaasApiKey;
}

async function asaasRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = asaasToken();
  if (!token) throw new Error("Asaas nao configurado");

  const response = await fetch(`${asaasBaseUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      access_token: token,
      ...(init?.headers ?? {})
    }
  });

  const body = (await response.json()) as T & { errors?: Array<{ description?: string }> };
  if (!response.ok) {
    const detail = body.errors?.[0]?.description ?? response.statusText;
    throw new Error(`Asaas: ${detail}`);
  }
  return body;
}

const PLAN_VALUES: Record<string, number> = {
  starter: 297,
  pro: 897
};

export const asaasPaymentProvider: PaymentGatewayProvider = {
  id: "asaas",
  isConfigured: () => Boolean(asaasToken()),
  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    if (!this.isConfigured()) {
      return {
        provider: "asaas",
        configured: false,
        message: "Configure ASAAS_API_KEY no servidor."
      };
    }

    const value = PLAN_VALUES[input.planId];
    if (!value) {
      return {
        provider: "asaas",
        configured: true,
        message: "Plano Enterprise requer contato comercial."
      };
    }

    const customer = await asaasRequest<AsaasCustomer>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: input.customerName,
        email: input.customerEmail,
        externalReference: input.tenantSlug,
        notificationDisabled: false
      })
    });

    const subscription = await asaasRequest<AsaasSubscription>("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: customer.id,
        billingType: "UNDEFINED",
        value,
        cycle: "MONTHLY",
        description: `Atlas One ${input.planId}`,
        externalReference: `${input.tenantSlug}:${input.planId}`
      })
    });

    return {
      provider: "asaas",
      configured: true,
      checkoutUrl: subscription.invoiceUrl ?? subscription.bankSlipUrl,
      externalCustomerId: customer.id,
      externalSubscriptionId: subscription.id,
      message: subscription.invoiceUrl ? undefined : "Assinatura criada. Aguarde cobranca pelo Asaas."
    };
  },
  parseWebhook(body: unknown, _headers: Record<string, unknown>): PaymentWebhookEvent | null {
    const payload = body as {
      event?: string;
      payment?: { externalReference?: string; status?: string; customer?: string };
      subscription?: { externalReference?: string; status?: string; customer?: string };
    };

    if (!payload.event) return null;

    const ref = payload.subscription?.externalReference ?? payload.payment?.externalReference ?? "";
    const [tenantSlug, plan] = ref.split(":");

    let billingStatus: "active" | "overdue" | "blocked" | undefined;
    const event = payload.event.toUpperCase();

    if (event.includes("RECEIVED") || event.includes("CONFIRMED") || event === "SUBSCRIPTION_CREATED") {
      billingStatus = "active";
    } else if (event.includes("OVERDUE")) {
      billingStatus = "overdue";
    } else if (event.includes("DELETED") || event.includes("CANCELED")) {
      billingStatus = "blocked";
    }

    return {
      provider: "asaas",
      tenantSlug: tenantSlug || undefined,
      event: payload.event,
      plan: plan || undefined,
      billingStatus,
      externalCustomerId: payload.payment?.customer ?? payload.subscription?.customer
    };
  }
};
