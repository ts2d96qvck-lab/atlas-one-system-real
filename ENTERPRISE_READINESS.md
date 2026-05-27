# Atlas One — Enterprise Readiness

Documento-mestre para conversas com procurement, TI e jurídico de empresas médias e grandes.  
Resume o que **já está pronto**, o que é **parcial** e o que **ainda falta** — sem prometer o que o produto ainda não entrega.

**Não substitui contrato, DPA assinado ou assessoria jurídica.**

**Última revisão:** Phase 10 — Enterprise hardening (May 2026)

---

## 1. Resumo executivo

| Dimensão | Status | Evidência |
|----------|--------|-----------|
| Deploy produção 24/7 | ✅ Pronto | [DEPLOY.md](./DEPLOY.md), `docker-compose.prod.yml` |
| Multi-tenant + RBAC | ✅ Pronto | JWT + `tokenVersion`, `tenantId`, guards |
| Backup / restore | ✅ Pronto | [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) |
| Auditoria + export CSV | ✅ Pronto | Admin → Monitor; `GET /admin/audit-logs/export.csv` |
| LGPD / privacidade | ✅ Docs + controles | [PRIVACY.md](./PRIVACY.md), [LGPD_CHECKLIST.md](./LGPD_CHECKLIST.md) |
| API pública + webhooks | ✅ Pronto (Pro+) | [API.md](./API.md), [WEBHOOKS.md](./WEBHOOKS.md) |
| Billing por plano/seats | ✅ Foundation | [BILLING.md](./BILLING.md), Asaas MVP |
| SSO Google/Microsoft | ✅ Pronto | [SSO_PLAN.md](./SSO_PLAN.md) |
| WhatsApp Meta Cloud | ✅ Pronto | Inbound + outbound — [WHATSAPP_PROVIDERS.md](./WHATSAPP_PROVIDERS.md) |
| SLA contratual | ✅ Template | [SLA_TEMPLATE.md](./SLA_TEMPLATE.md) |
| Status page pública | ✅ MVP | `/status`, `/api/status` |
| Sessão revogável (logout) | ✅ Pronto | `User.tokenVersion` |
| Graceful shutdown | ✅ Pronto | SIGTERM/SIGINT em `server.ts` |
| Redis queue webhooks | ✅ Pronto | Fallback inline se Redis indisponível |
| Pentest externo | 📋 Escopo definido | [PENTEST_SCOPE.md](./PENTEST_SCOPE.md) |
| Alta disponibilidade multi-AZ | ❌ Roadmap | [ROADMAP_ENTERPRISE.md](./ROADMAP_ENTERPRISE.md) |
| SOC 2 / ISO 27001 | ❌ Longo prazo | — |

**Conclusão comercial:** Atlas One está pronto para **mid-market e Enterprise inicial** com due diligence técnica completa. Contratos Fortune 500 exigem pentest executado + HA multi-AZ (roadmap).

---

## 2. Checklist de procurement (TI / compras)

| # | Requisito | Status | Onde verificar |
|---|-----------|--------|----------------|
| 1 | **SSO (OIDC)** | ✅ | SSO_PLAN.md, login + Admin SSO |
| 2 | **LGPD / privacidade** | ✅ | LGPD_CHECKLIST.md, PRIVACY.md |
| 3 | **DPA (operador)** | ✅ Rascunho | DPA_TEMPLATE.md |
| 4 | **Backup automatizado** | ✅ | BACKUP_RESTORE.md |
| 5 | **Restore testado** | ✅ Documentado | BACKUP_RESTORE.md |
| 6 | **Logs estruturados + request ID** | ✅ | `app-log.ts`, `X-Request-Id` |
| 7 | **Audit trail + export** | ✅ | `/admin/audit-logs/export.csv` |
| 8 | **Segurança (RBAC, 2FA, rate limit, JWT revoke)** | ✅ | SECURITY.md |
| 9 | **Suporte / SLA** | ✅ Template | SLA_TEMPLATE.md |
| 10 | **Disponibilidade / status** | ✅ | `/status`, `/api/status` |
| 11 | **WhatsApp API oficial (Meta)** | ✅ | WHATSAPP_PROVIDERS.md |
| 12 | **Integrações (API + webhooks)** | ✅ | API.md, WEBHOOKS.md |
| 13 | **Exportação de dados** | ✅ | Dashboard CSV, `/ops/export/*`, API v1 |
| 14 | **Isolamento multi-tenant** | ✅ | Guards + `tenantId` |
| 15 | **Pentest / vuln assessment** | 📋 Escopo | PENTEST_SCOPE.md |
| 16 | **Controle de seats / planos** | ✅ | BILLING.md |
| 17 | **Relatórios operacionais / SLA** | ✅ | OPS_EXPORTS.md |
| 18 | **Documentação de deploy** | ✅ | DEPLOY.md, OPERATIONS_RUNBOOK.md |
| 19 | **Bootstrap bloqueado em prod** | ✅ | `X-Setup-Token` + `SETUP_TOKEN` |
| 20 | **Política de senha forte** | ✅ | 12+ chars, 3 classes |
| 21 | **Meta webhook HMAC** | ✅ | `META_WHATSAPP_APP_SECRET` |
| 22 | **Redis autenticado (prod)** | ✅ | `REDIS_PASSWORD` no compose |

Legenda: ✅ pronto · ⚠️ parcial · 📋 documentado, pendente externo · ❌ não disponível

---

## 3. Matriz por plano comercial

| Capacidade | Starter | Pro | Enterprise |
|------------|---------|-----|------------|
| Inbox + CRM + Dashboard | ✅ | ✅ | ✅ |
| SLA métricas + export CSV | ✅ | ✅ | ✅ |
| Automações | ❌ | ✅ | ✅ |
| API pública + webhooks | ❌ | ✅ | ✅ |
| SSO OIDC | ❌ | ❌ | ✅ |
| Meta WhatsApp Cloud | Evolution | Evolution ou Meta | Meta recomendado |
| DPA + SLA negociável | Opcional | Opcional | ✅ |
| Pentest compartilhado | — | — | Sob consulta |

---

## 4. Gaps restantes (honestidade comercial)

| Gap | Impacto | Mitigação |
|-----|---------|-----------|
| Pentest externo não executado | Questionário segurança | Contratar via PENTEST_SCOPE.md |
| HA multi-instância API | SLA 99,99% | 2+ replicas + LB (2027 roadmap) |
| SOC 2 / ISO 27001 | Fortune 500 procurement | Programa longo prazo |
| Gateway Asaas em cliente real | Receita automática | Configurar produção Asaas |
| APM (Datadog/Sentry) | Observabilidade avançada | Agente no host — OPERATIONS_RUNBOOK.md |

---

## 5. Pacote de due diligence

1. SECURITY.md
2. PRIVACY.md + LGPD_CHECKLIST.md
3. DPA_TEMPLATE.md
4. SLA_TEMPLATE.md
5. BACKUP_RESTORE.md
6. API.md + WEBHOOKS.md
7. WHATSAPP_PROVIDERS.md
8. OPERATIONS_RUNBOOK.md
9. ENTERPRISE_READINESS.md (este documento)
10. Relatório de pentest (quando existir)

---

## 6. Documentos relacionados

| Documento | Uso |
|-----------|-----|
| [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md) | Operação 24/7 |
| [ROADMAP_ENTERPRISE.md](./ROADMAP_ENTERPRISE.md) | Pendências técnicas |
| [ATLAS_SAAS_UPGRADE_PLAN.md](./ATLAS_SAAS_UPGRADE_PLAN.md) | Histórico fases 1–10 |

---

*Enterprise Readiness v2 — Phase 10.*
