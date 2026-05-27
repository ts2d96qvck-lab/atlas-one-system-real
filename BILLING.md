# Atlas One — Billing

Modelo comercial B2B por plano, seats e canais WhatsApp.

---

## Planos

| Plano | Seats | Canais WA | Conversas/mes | Preco ref. |
|-------|-------|-----------|---------------|------------|
| **Starter** | 5 | 1 | 500 | R$ 297/mes |
| **Pro** | 25 | 3 | 5.000 | R$ 897/mes |
| **Enterprise** | 999 | 20 | Ilimitado | Sob consulta |

### Recursos por plano

| Recurso | Starter | Pro | Enterprise |
|---------|---------|-----|------------|
| Inbox + CRM | sim | sim | sim |
| SLA / Dashboard | sim | sim | sim |
| Automacoes | nao | sim | sim |
| API publica (`/v1`) | nao | sim | sim |
| Webhooks de saida | nao | sim | sim |
| SSO | nao | nao | sim |

Limites customizados podem ser definidos em `tenant.settings` (platform admin).

---

## Controle de seats

Usuarios contabilizados: status `active` + `invited`.

Bloqueio automatico ao criar usuario/convite quando:
- seats usados >= limite do plano
- conta com `billingStatus=blocked`

Mensagem amigavel orienta upgrade.

---

## API

### Visao do tenant (admin/owner)

```
GET /admin/billing/overview
GET /admin/billing/plans
```

Resposta inclui plano, uso, seats, canais, trial e capabilities.

### Platform admin — alterar plano

```
PATCH /admin/billing/tenants/:tenantId/plan
{ "plan": "pro" }
```

Requer `PLATFORM_ADMIN_EMAILS`.

### Webhook de assinatura (gateway futuro)

```
POST /payments/webhook/subscription
Header: x-webhook-secret (PAYMENTS_WEBHOOK_SECRET)

{
  "tenantSlug": "acme",
  "event": "subscription.updated",
  "plan": "pro",
  "billingStatus": "active",
  "provider": "stripe",
  "externalCustomerId": "cus_xxx"
}
```

Integracao preparada para **Asaas** (implementado), **Stripe** (roadmap) via `PaymentIntegration` + webhook.

Ver [PAYMENTS.md](./PAYMENTS.md) para checkout e webhook Asaas.

---

## Status financeiro

| Status | Efeito |
|--------|--------|
| `active` | Operacao normal |
| `overdue` | Aviso (configuravel) |
| `blocked` | Login bloqueado |

Campo `tenant.plan` + `tenant.billingStatus` + `tenant.settings.billing`.

---

## UI

**Admin → Plano e faturamento** — seats, canais, conversas/mes, features do plano.

---

## Arquivos

| Area | Caminho |
|------|---------|
| Planos | `apps/server/src/services/billing/plans.ts` |
| Servico | `apps/server/src/services/billing/billing.service.ts` |
| Rotas | `apps/server/src/routes/billing.routes.ts` |
| Webhook | `apps/server/src/routes/payments.routes.ts` |

Ver tambem: [TRIAL.md](./TRIAL.md)

---

*Phase 8 — billing e seats.*
