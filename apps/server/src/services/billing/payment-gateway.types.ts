export type PaymentProviderId = "asaas" | "stripe" | "manual";

export type CheckoutSessionInput = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  planId: "starter" | "pro";
  customerEmail: string;
  customerName: string;
};

export type CheckoutSessionResult = {
  provider: PaymentProviderId;
  configured: boolean;
  checkoutUrl?: string;
  externalCustomerId?: string;
  externalSubscriptionId?: string;
  message?: string;
};

export type PaymentWebhookEvent = {
  provider: PaymentProviderId;
  tenantSlug?: string;
  event: string;
  plan?: string;
  billingStatus?: "active" | "overdue" | "blocked";
  externalCustomerId?: string;
};

export interface PaymentGatewayProvider {
  id: PaymentProviderId;
  isConfigured(): boolean;
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult>;
  parseWebhook(body: unknown, headers: Record<string, unknown>): PaymentWebhookEvent | null;
}
