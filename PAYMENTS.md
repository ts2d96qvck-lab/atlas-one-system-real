# Atlas One — Payment Gateway

Integracao de cobranca recorrente (Phase 8+). Provider padrao: **Asaas** (Brasil).

---

## Providers

| Provider | Env | Status |
|----------|-----|--------|
| **Asaas** | `ASAAS_API_KEY`, `ASAAS_ENV` | Implementado |
| **Manual** | `PAYMENT_PROVIDER=manual` | Fallback (sem cobranca automatica) |
| Stripe | — | Roadmap |

```env
PAYMENT_PROVIDER=asaas
ASAAS_API_KEY=sua_chave
ASAAS_ENV=sandbox
```

Sandbox: https://sandbox.asaas.com · Producao: `ASAAS_ENV=production`

---

## Fluxo checkout

1. Admin → **Plano e faturamento** → **Assinar Pro** (ou Starter)
2. `POST /admin/billing/checkout` `{ "plan": "pro" }`
3. Servidor cria customer + subscription no Asaas
4. Retorna `checkoutUrl` (fatura/link de pagamento)
5. Webhook Asaas atualiza plano e `billingStatus`

---

## Webhooks

| Endpoint | Provider |
|----------|----------|
| `POST /payments/webhook/subscription` | Generico (header `x-webhook-secret`) |
| `POST /payments/webhook/asaas` | Asaas (eventos nativos) |

Configure no painel Asaas:

```
https://app.atlasone.app.br/payments/webhook/asaas
```

Eventos mapeados: pagamento confirmado → `active`, atraso → `overdue`, cancelamento → `blocked`.

Referencia generica (integradores):

```json
POST /payments/webhook/subscription
Header: x-webhook-secret: PAYMENTS_WEBHOOK_SECRET

{
  "tenantSlug": "acme",
  "event": "subscription.updated",
  "plan": "pro",
  "billingStatus": "active",
  "provider": "asaas",
  "externalCustomerId": "cus_xxx"
}
```

---

## API

```
POST /admin/billing/checkout
Authorization: Bearer {token}
{ "plan": "starter" | "pro" }
```

Resposta:

```json
{
  "provider": "asaas",
  "configured": true,
  "checkoutUrl": "https://...",
  "plan": "pro"
}
```

---

## Arquivos

| Area | Caminho |
|------|---------|
| Gateway service | `billing/payment-gateway.service.ts` |
| Asaas provider | `billing/providers/asaas.provider.ts` |
| Rotas billing | `billing.routes.ts` |
| Webhooks | `payments.routes.ts` |

Ver tambem: [BILLING.md](./BILLING.md)

---

*Payment gateway MVP — Asaas + manual fallback.*
