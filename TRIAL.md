# Atlas One — Free Trial

Fluxo de trial gratuito para novos tenants B2B.

---

## Como funciona

1. **Novo tenant** criado via platform onboarding recebe:
   - Plano **Starter**
   - **14 dias** de trial (`settings.billing.trialEndsAt`)
   - `subscriptionStatus: "trialing"`
   - `billingStatus: "active"`

2. Durante o trial, limites do plano Starter aplicam normalmente (5 seats, 1 canal).

3. Admin ve trial em **Admin → Plano e faturamento**.

---

## Configuracao

| Constante | Valor | Arquivo |
|-----------|-------|---------|
| `TRIAL_DAYS` | 14 | `billing/plans.ts` |
| `DEFAULT_PLAN` | starter | `billing/plans.ts` |

Onboarding em `tenant-onboarding.service.ts` preenche `settings.billing`.

---

## Pos-trial (manual / gateway)

Opcoes para producao:

1. **Webhook subscription** — gateway envia `plan` + `billingStatus` apos pagamento
2. **Platform admin** — `PATCH /admin/billing/tenants/:id/plan`
3. **Job agendado** (futuro) — bloquear tenants com trial expirado sem pagamento

Exemplo webhook pos-pagamento:

```json
POST /payments/webhook/subscription
{
  "tenantSlug": "acme",
  "event": "subscription.created",
  "plan": "pro",
  "billingStatus": "active",
  "provider": "asaas",
  "externalCustomerId": "sub_123"
}
```

---

## Trial expirado (comportamento recomendado)

| Dia | Acao |
|-----|------|
| D-3 | E-mail lembrete (implementar Phase 8.1) |
| D0 | Marcar `billingStatus=overdue` |
| D+7 | `billingStatus=blocked` — login bloqueado |

Automacao de e-mail nao incluida nesta fase — configurar via gateway ou cron externo.

---

## Testar localmente

1. Platform admin → criar tenant via onboarding
2. Verificar `GET /admin/billing/overview` — `trialActive: true`
3. Simular upgrade via webhook subscription

---

*Phase 8 — trial flow.*
