export type PlanId = "starter" | "pro" | "enterprise";

export type PlanFeatures = {
  automations: boolean;
  campaigns: boolean;
  publicApi: boolean;
  webhooks: boolean;
  sla: boolean;
  sso: boolean;
};

export type PlanDefinition = {
  id: PlanId;
  name: string;
  description: string;
  maxUsers: number;
  maxInstances: number;
  maxConversationsPerMonth: number | null;
  features: PlanFeatures;
  priceLabel: string;
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    description: "Times pequenos com WhatsApp e CRM basico.",
    maxUsers: 5,
    maxInstances: 1,
    maxConversationsPerMonth: 500,
    features: {
      automations: false,
      campaigns: false,
      publicApi: false,
      webhooks: false,
      sla: true,
      sso: false
    },
    priceLabel: "R$ 297/mes"
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Operacao comercial com automacoes e integracoes.",
    maxUsers: 25,
    maxInstances: 3,
    maxConversationsPerMonth: 5000,
    features: {
      automations: true,
      campaigns: true,
      publicApi: true,
      webhooks: true,
      sla: true,
      sso: false
    },
    priceLabel: "R$ 897/mes"
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Escala, SSO e limites elevados.",
    maxUsers: 999,
    maxInstances: 20,
    maxConversationsPerMonth: null,
    features: {
      automations: true,
      campaigns: true,
      publicApi: true,
      webhooks: true,
      sla: true,
      sso: true
    },
    priceLabel: "Sob consulta"
  }
};

export const DEFAULT_PLAN: PlanId = "starter";
export const TRIAL_DAYS = 14;

export function normalizePlanId(value: string | null | undefined): PlanId {
  const id = String(value ?? DEFAULT_PLAN).toLowerCase();
  if (id in PLANS) return id as PlanId;
  return DEFAULT_PLAN;
}

export function getPlan(planId: string | null | undefined): PlanDefinition {
  return PLANS[normalizePlanId(planId)];
}
