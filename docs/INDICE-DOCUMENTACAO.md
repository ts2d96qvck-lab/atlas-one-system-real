# Atlas One — Índice Master da Documentação

**Comece aqui:** [MANUAL-OPERACAO-COMPLETO.md](./MANUAL-OPERACAO-COMPLETO.md) — manual mestre em português com passo a passo completo.

**Estabilidade confirmada:** [CONFIRMACAO-ESTABILIDADE.md](./CONFIRMACAO-ESTABILIDADE.md) (32 E2E + 16 smoke API ✅)

---

## 🚀 Início rápido (3 documentos)

| Ordem | Documento | Para quê |
|-------|-----------|----------|
| 0 | [GUIA-ONDE-CLICAR.md](./GUIA-ONDE-CLICAR.md) | **Perdido na interface?** Deptos, API, URLs |
| 0 | [GUIA-ONDE-CLICAR.md](./GUIA-ONDE-CLICAR.md) | **Perdido na interface?** Deptos, API, URLs |
| 1 | [MANUAL-OPERACAO-COMPLETO.md](./MANUAL-OPERACAO-COMPLETO.md) | **Tudo** — do zero ao primeiro cliente |
| 2 | [HANDOFF-AUSENCIA.md](../HANDOFF-AUSENCIA.md) | Resumo do que foi feito na ausência |

---

## 💼 Comercial e vendas

| Documento | Conteúdo |
|-----------|----------|
| [APRESENTACAO-COMERCIAL.md](./APRESENTACAO-COMERCIAL.md) | Pitch, proposta de valor, demo |
| **Apresentação PDF (web)** | **`/apresentacao`** → Ctrl+P salvar PDF |
| [GUIA-ONDE-CLICAR.md](./GUIA-ONDE-CLICAR.md) | Onde clicar: Admin, deptos, API key |
| [KIT-COMERCIALIZACAO.md](./KIT-COMERCIALIZACAO.md) | Preços, proposta, onboarding 3 dias, SLA |
| [GO-LIVE-CHECKLIST.md](../GO-LIVE-CHECKLIST.md) | Liberar operação do cliente |
| [TRIAL.md](../TRIAL.md) | Período de teste |
| [SLA_TEMPLATE.md](../SLA_TEMPLATE.md) | Modelo SLA contrato |
| [DPA_TEMPLATE.md](../DPA_TEMPLATE.md) | Tratamento de dados (LGPD) |

**Páginas públicas do produto:**

| URL | Função |
|-----|--------|
| `/landing` | Apresentação comercial |
| `/pricing` | Planos |
| `/terms` | Termos de uso |
| `/privacy` | Privacidade |
| `/status` | Status operacional |
| `/` | Login da plataforma |

---

## 👥 Manuais por perfil (entregar ao cliente)

| Perfil | Documento |
|--------|-----------|
| **Dono / Diretor** | [MANUAL-DONO.md](./MANUAL-DONO.md) |
| **Supervisor / Gestor** | [MANUAL-EQUIPE.md](./MANUAL-EQUIPE.md) |
| **Atendente / SDR** | [GUIA-RAPIDO-ATENDENTE.md](./GUIA-RAPIDO-ATENDENTE.md) |
| **Suporte interno** | [FAQ-SUPORTE.md](./FAQ-SUPORTE.md) |
| **Glossário** | [GLOSSARIO.md](./GLOSSARIO.md) |

---

## 🔧 Técnico, deploy e operação

| Documento | Conteúdo |
|-----------|----------|
| [README.md](../README.md) | Visão geral + setup Windows |
| [DEPLOY.md](../DEPLOY.md) | Deploy detalhado |
| [DEPLOY_FIRST_CUSTOMER.md](../DEPLOY_FIRST_CUSTOMER.md) | Primeiro cliente em VPS |
| [ENTERPRISE.md](../ENTERPRISE.md) | Infra enterprise |
| [ENTERPRISE_READINESS.md](../ENTERPRISE_READINESS.md) | Matriz prontidão |
| [OPERATIONS_RUNBOOK.md](../OPERATIONS_RUNBOOK.md) | Runbook 24/7 |
| [BACKUP_RESTORE.md](../BACKUP_RESTORE.md) | Backup e restore |
| [WHATSAPP_PROVIDERS.md](../WHATSAPP_PROVIDERS.md) | Evolution + Meta Cloud |
| [AUTOMATED_TESTING_README.md](../AUTOMATED_TESTING_README.md) | Testes automatizados |

### Comandos essenciais

```powershell
corepack pnpm install          # dependências
corepack pnpm db:push          # banco
corepack pnpm build            # build
.\start-atlas-completo.ps1     # subir tudo (Windows)
corepack pnpm test:qa          # validar (smoke + E2E)
node scripts/validate-docker-compose.mjs  # validar Docker prod
```

---

## 💰 Billing, API e integrações

| Documento | Conteúdo |
|-----------|----------|
| [BILLING.md](../BILLING.md) | Planos, seats, limites |
| [PAYMENTS.md](../PAYMENTS.md) | Asaas, webhooks pagamento |
| [API.md](../API.md) | API pública v1 |
| [WEBHOOKS.md](../WEBHOOKS.md) | Webhooks outbound |
| [OPS_EXPORTS.md](../OPS_EXPORTS.md) | Export CSV |

---

## 🔒 Segurança e compliance

| Documento | Conteúdo |
|-----------|----------|
| [SECURITY.md](../SECURITY.md) | Política segurança |
| [SEGURANCA-ENTERPRISE.md](./SEGURANCA-ENTERPRISE.md) | Guia segurança PT |
| [SECURITY_BASELINE.md](../SECURITY_BASELINE.md) | Baseline |
| [LGPD_CHECKLIST.md](../LGPD_CHECKLIST.md) | Checklist LGPD |
| [PRIVACY.md](../PRIVACY.md) | Política privacidade |
| [PENTEST_SCOPE.md](../PENTEST_SCOPE.md) | Escopo pentest |

---

## ✅ QA e qualidade (evidências)

| Documento | Conteúdo |
|-----------|----------|
| [GO_LIVE_QA_DECISION.md](../GO_LIVE_QA_DECISION.md) | Decisão go-live |
| [VALIDATION_REPORT.md](../VALIDATION_REPORT.md) | Resultados comandos |
| [FULL_QA_TEST_PLAN.md](../FULL_QA_TEST_PLAN.md) | Plano QA completo |
| [BUG_REPORT.md](../BUG_REPORT.md) | Bugs conhecidos |
| [FEATURE_TEST_MATRIX.md](../FEATURE_TEST_MATRIX.md) | Matriz funcionalidades |
| [FIRST_CUSTOMER_E2E_REPORT.md](../FIRST_CUSTOMER_E2E_REPORT.md) | E2E primeiro cliente |

---

## 📋 Ordem de leitura recomendada

### Você (dono do produto Atlas One)

1. MANUAL-OPERACAO-COMPLETO.md  
2. CONFIRMACAO-ESTABILIDADE.md  
3. DEPLOY_FIRST_CUSTOMER.md  
4. KIT-COMERCIALIZACAO.md  
5. APRESENTACAO-COMERCIAL.md  

### Seu primeiro cliente

1. MANUAL-DONO.md  
2. GO-LIVE-CHECKLIST.md  
3. MANUAL-EQUIPE.md  
4. GUIA-RAPIDO-ATENDENTE.md  
5. FAQ-SUPORTE.md  

---

## Acesso local (desenvolvimento)

| Item | Valor |
|------|--------|
| Web | http://localhost:3001 ou http://app.atlasone.local.gd |
| API | http://localhost:4000 |
| Health | http://localhost:4000/api/health |
| Status | http://localhost:3001/status |
| Tenant demo | `atlas-one` |
| Atendente demo | `demo@atlasone.com.br` / ver `.env` ou seed |
| Tenant QA teste | `atlas-test-customer` (seed script) |

---

*Índice atualizado após ciclo QA completo — Atlas One v1.0*
