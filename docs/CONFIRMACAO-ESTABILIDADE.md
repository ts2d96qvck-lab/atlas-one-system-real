# Confirmação de Estabilidade — Atlas One

**Data da verificação:** 2026-05-25  
**Ambiente:** Windows local, PM2 (`atlas-api` :4000, `atlas-web` :3001)

---

## Veredicto

| Pergunta | Resposta |
|----------|----------|
| O produto está estável para operação assistida? | **SIM** |
| Pode vender ao primeiro cliente SMB? | **SIM, com condições** (onboarding assistido + deploy produção) |
| Pode vender 100% self-service hoje? | **NÃO** — falta VPS + Asaas validado em produção |

---

## Evidências (executadas de verdade)

| Teste | Resultado |
|-------|-----------|
| `GET /api/health` | ✅ 200 |
| `GET /api/ready` | ✅ DB ok (Redis opcional em dev) |
| API smoke (`run-qa-api-smoke.mjs`) | ✅ **16/16** |
| Billing smoke (`run-billing-smoke.mjs`) | ✅ PASS |
| Docker compose validate | ✅ PASS (13 serviços) |
| Playwright E2E | ✅ **32/32** |
| Build + lint | ✅ PASS |
| PM2 atlas-api + atlas-web | ✅ online |

---

## O que funciona (validado)

- Login, logout, revogação de sessão
- RBAC (owner, admin, supervisor, agent)
- Inbox, CRM, billing overview, planos
- Audit logs + export CSV
- API keys + API pública v1
- Webhooks outbound (disparo registrado)
- Isolamento entre tenants
- Limite de seats (bloqueio ao ultrapassar)
- Quota mensal de conversas (enforcement ativo)
- Páginas públicas: `/landing`, `/pricing`, `/terms`, `/privacy`, `/status`

---

## O que ainda depende de você (externo)

| Item | Por quê |
|------|---------|
| **VPS + HTTPS** | Hoje roda no seu PC (PM2) |
| **ASAAS_API_KEY** | Cobrança automática não testada com chave real |
| **Login owner em produção** | OTP WhatsApp/SMS real (sem bypass de QA) |
| **Redis em produção** | Recomendado para fila de webhooks em escala |

---

## Flags de QA — NUNCA em produção

Estas variáveis existem **só para testes locais**:

```
QA_BYPASS_2FA=true
QA_BYPASS_RATE_LIMIT=true
```

Em produção: **remova ou deixe false**. O dono deve receber OTP real.

---

*Documento gerado após ciclo completo de QA. Detalhes em `VALIDATION_REPORT.md` e `GO_LIVE_QA_DECISION.md`.*
