import type { CheckoutSessionInput, CheckoutSessionResult, PaymentGatewayProvider } from "../payment-gateway.types";

export const manualPaymentProvider: PaymentGatewayProvider = {
  id: "manual",
  isConfigured: () => true,
  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    return {
      provider: "manual",
      configured: true,
      message: `Plano ${input.planId} — entre em contato com suporte@atlasone.com.br informando a empresa "${input.tenantSlug}".`
    };
  },
  parseWebhook() {
    return null;
  }
};
