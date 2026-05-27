# Manual de Operação Completo — Atlas One

**Versão:** 1.0 · **Idioma:** Português (Brasil)  
**Para quem é:** dono do produto, implantação, comercial e suporte  
**Objetivo:** abrir e operar a comercialização do Atlas One com segurança

---

## Como usar este manual

1. Leia a **Parte 1** (confirmação) — 5 minutos  
2. Siga a **Parte 2** (passo a passo) na ordem — do zero ao primeiro cliente  
3. Use a **Parte 3** (índice) para aprofundar por perfil ou tema  
4. Imprima ou envie ao cliente os documentos da **Parte 4** (kit comercial)

**Documento mestre:** este arquivo.  
**Índice navegável:** [INDICE-DOCUMENTACAO.md](./INDICE-DOCUMENTACAO.md)

---

# PARTE 1 — Confirmação: está estável?

Sim, **para operação assistida do primeiro cliente**.

| Status | Detalhe |
|--------|---------|
| ✅ Estável localmente | 32 testes E2E + 16 smoke API passando |
| ✅ Produto core | Inbox, CRM, Admin, RBAC, billing, API, webhooks |
| ⚠️ Produção real | Você ainda precisa subir VPS + domínio HTTPS |
| ⚠️ Cobrança auto | Asaas precisa de chave sandbox/prod no `.env` |

Detalhes técnicos: [CONFIRMACAO-ESTABILIDADE.md](./CONFIRMACAO-ESTABILIDADE.md)

**Decisão comercial:** pode vender ao **primeiro SMB** com onboarding que **você** faz (criar tenant, conectar WhatsApp, treinar equipe). Não prometa ainda signup público sem setup ou SLA 99,9%.

---

# PARTE 2 — Passo a passo completo (do zero ao primeiro cliente pagante)

## FASE A — Preparar seu ambiente de trabalho (desenvolvimento / demo)

### A1. Requisitos na sua máquina

- Windows 10/11 (ou Linux/macOS para deploy)
- Node.js 20+
- PostgreSQL rodando
- Git
- PM2 (`npm i -g pm2`) — opcional mas recomendado
- Docker Desktop — para banco e deploy futuro

### A2. Instalar dependências

```powershell
cd C:\caminho\atlas-one-system-real
corepack pnpm install
```

### A3. Configurar variáveis de ambiente

1. Copie `.env.example` → `.env` (raiz) e `apps/server/.env` se necessário  
2. Preencha no mínimo:

```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/atlas_one
JWT_SECRET=uma_string_aleatoria_de_64_caracteres_no_minimo
WEBHOOK_SECRET=outro_segredo_forte
SETUP_TOKEN=token_para_criar_primeiro_tenant
EVOLUTION_URL=http://localhost:8080
EVOLUTION_API_KEY=sua_chave_evolution
WEBHOOK_PUBLIC_URL=http://app.atlasone.local.gd
APP_PUBLIC_URL=http://app.atlasone.local.gd
ATLAS_ENTERPRISE_MODE=true
```

3. **Desenvolvimento local com testes:** PM2 já pode usar `QA_BYPASS_2FA` e `QA_BYPASS_RATE_LIMIT` (ver `ecosystem.config.cjs`). **Nunca em produção.**

### A4. Banco de dados

```powershell
corepack pnpm db:push
```

### A5. Subir o sistema (Windows)

```powershell
.\start-atlas-completo.ps1
# ou
pm2 start ecosystem.config.cjs
```

### A6. Verificar se está saudável

```powershell
# API
curl http://localhost:4000/api/health
curl http://localhost:4000/api/ready

# Web
# Abra http://localhost:3001/landing
# Abra http://localhost:3001/status
```

### A7. Rodar testes (confirmação)

```powershell
node scripts/run-qa-api-smoke.mjs
npx playwright test
corepack pnpm test:qa
```

**Esperado:** smoke 16/16, Playwright 32/32.

### A8. Setup comercial seguro (primeira vez no PC)

```powershell
.\scripts\setup-comercial-seguro.ps1
```

Gera segredos, ativa enterprise mode, agenda backup.

---

## FASE B — Configurar SUA operação (tenant atlas-one ou o seu)

Siga o manual do dono: **[MANUAL-DONO.md](./MANUAL-DONO.md)**

Resumo obrigatório:

| # | Ação | Onde |
|---|------|------|
| 1 | Login dono (2FA WhatsApp/SMS) | `/` |
| 2 | Conectar WhatsApp (QR) | Admin → Instâncias |
| 3 | Sync webhook | Admin → Sync webhook |
| 4 | Criar departamento **Novos** | Admin → Departamentos |
| 5 | Cadastrar atendentes | Admin → Usuários |
| 6 | Testar inbox (enviar/receber) | Inbox |
| 7 | Ajustar CRM Kanban | CRM |
| 8 | Revisar Dashboard | Dashboard |

Antes de liberar equipe: **[GO-LIVE-CHECKLIST.md](../GO-LIVE-CHECKLIST.md)**

---

## FASE C — Ir para PRODUÇÃO (VPS + domínio)

Guia detalhado: **[DEPLOY_FIRST_CUSTOMER.md](../DEPLOY_FIRST_CUSTOMER.md)** e **[DEPLOY.md](../DEPLOY.md)**

### C1. Contratar infraestrutura

| Item | Mínimo recomendado |
|------|-------------------|
| VPS | 2 vCPU, 4 GB RAM, Ubuntu 22.04 |
| Domínio | ex.: `app.suaempresa.com.br` |
| SSL | Let's Encrypt (via nginx ou Caddy) |
| PostgreSQL | No compose ou gerenciado |
| Redis | Obrigatório em produção |
| Evolution API | Instância dedicada 24/7 |

### C2. Preparar `.env` de produção

```powershell
cp .env.production.example .env
# Edite TODOS os REPLACE_WITH_*
```

Variáveis críticas:

- `POSTGRES_PASSWORD`, `REDIS_PASSWORD`
- `JWT_SECRET` (64+ chars)
- `WEBHOOK_SECRET`, `PAYMENTS_WEBHOOK_SECRET`, `SETUP_TOKEN`
- `WEBHOOK_PUBLIC_URL`, `APP_PUBLIC_URL` (HTTPS)
- `CORS_ORIGINS`
- `PAYMENT_PROVIDER=asaas` + `ASAAS_API_KEY` (quando for cobrar)
- **NÃO** incluir `QA_BYPASS_*`

### C3. Validar Docker antes de subir

```bash
node scripts/validate-docker-compose.mjs
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

### C4. Criar primeiro tenant do cliente

```bash
curl -X POST https://app.seudominio.com.br/auth/bootstrap-owner \
  -H "Content-Type: application/json" \
  -H "X-Setup-Token: SEU_SETUP_TOKEN" \
  -d '{
    "tenantSlug": "cliente-abc",
    "tenantName": "Cliente ABC Ltda",
    "ownerName": "João Silva",
    "ownerEmail": "joao@clienteabc.com.br",
    "ownerPassword": "SenhaForteMin12!",
    "ownerPhone": "5511999999999"
  }'
```

O dono faz login em `/` com slug `cliente-abc` e recebe **OTP no WhatsApp** (produção).

### C5. Pós-deploy

```bash
curl https://app.seudominio.com.br/api/health
curl https://app.seudominio.com.br/api/ready
node scripts/run-billing-smoke.mjs
```

Monitoramento: configure UptimeRobot/Better Stack em `/api/status`.

Runbook: **[OPERATIONS_RUNBOOK.md](../OPERATIONS_RUNBOOK.md)**  
Backup: **[BACKUP_RESTORE.md](../BACKUP_RESTORE.md)**

---

## FASE D — Vender e implantar o PRIMEIRO CLIENTE

Kit comercial: **[KIT-COMERCIALIZACAO.md](./KIT-COMERCIALIZACAO.md)**  
Apresentação: **[APRESENTACAO-COMERCIAL.md](./APRESENTACAO-COMERCIAL.md)**

### D1. Antes da reunião comercial

- [ ] Demo funcionando (WhatsApp conectado)
- [ ] `/landing` e `/pricing` acessíveis
- [ ] Proposta impressa (template no KIT)
- [ ] Termos e privacidade: `/terms` e `/privacy`

### D2. Fechamento

1. Definir plano (Starter / Pro / Enterprise) — ver `/pricing`
2. Cobrar implantação + mensalidade (PIX/contrato ou Asaas)
3. Coletar: slug desejado, e-mail dono, telefone WhatsApp, nº usuários

### D3. Implantação (3 dias sugeridos)

| Dia | Atividade |
|-----|-----------|
| **0** | Contrato + pagamento implantação |
| **1** | Criar tenant, owner, conectar WhatsApp, departamentos |
| **2** | Treinamento dono (60 min) + equipe (60 min) |
| **3** | GO-LIVE-CHECKLIST + monitorar 2h |

### D4. Materiais para entregar ao cliente

| Documento | Para quem |
|-----------|-----------|
| [MANUAL-DONO.md](./MANUAL-DONO.md) | Dono / gestor |
| [MANUAL-EQUIPE.md](./MANUAL-EQUIPE.md) | Supervisores |
| [GUIA-RAPIDO-ATENDENTE.md](./GUIA-RAPIDO-ATENDENTE.md) | Atendentes |
| [FAQ-SUPORTE.md](./FAQ-SUPORTE.md) | Todos |
| [GO-LIVE-CHECKLIST.md](../GO-LIVE-CHECKLIST.md) | Implantação |

### D5. Cobrança recorrente

Manual: **[BILLING.md](../BILLING.md)** e **[PAYMENTS.md](../PAYMENTS.md)**

Opções:

1. **Manual** — PIX/contrato; você ativa plano via webhook ou Admin  
2. **Asaas** — configure `ASAAS_API_KEY`; checkout em Admin → Billing  

Teste: `node scripts/run-billing-smoke.mjs`

---

## FASE E — Operação diária e suporte

### E1. Rotina do dono/gestor

- Dashboard: conversas, SLA, funil  
- Admin → Auditoria (ações sensíveis)  
- Admin → Billing (plano, seats)  
- Status: `/status`

### E2. Rotina da equipe

Manual: **[MANUAL-EQUIPE.md](./MANUAL-EQUIPE.md)**  
Atendentes: **[GUIA-RAPIDO-ATENDENTE.md](./GUIA-RAPIDO-ATENDENTE.md)**

### E3. Problemas comuns

**FAQ:** [FAQ-SUPORTE.md](./FAQ-SUPORTE.md)

| Problema | Ação |
|----------|------|
| WhatsApp parou | Admin → Instâncias → reconectar QR |
| Login dono falha | Verificar Evolution online + SMS_PROVIDER |
| API lenta | Verificar `/api/ready` (DB, Redis, Evolution) |
| Cliente bloqueado | Billing → status inadimplente |

### E4. Backup e recuperação

```powershell
# Ver BACKUP_RESTORE.md
.\scripts\backup-database.ps1   # se existir no projeto
```

Agendado pelo `setup-comercial-seguro.ps1` (02:00).

---

# PARTE 3 — Índice de toda documentação

## 📋 Operação e negócio (português)

| Documento | Uso |
|-----------|-----|
| **Este manual** | Visão geral e passo a passo |
| [INDICE-DOCUMENTACAO.md](./INDICE-DOCUMENTACAO.md) | Índice navegável |
| [CONFIRMACAO-ESTABILIDADE.md](./CONFIRMACAO-ESTABILIDADE.md) | Prova de estabilidade |
| [MANUAL-DONO.md](./MANUAL-DONO.md) | Dono / diretor |
| [MANUAL-EQUIPE.md](./MANUAL-EQUIPE.md) | Supervisores |
| [GUIA-RAPIDO-ATENDENTE.md](./GUIA-RAPIDO-ATENDENTE.md) | Atendentes |
| [APRESENTACAO-COMERCIAL.md](./APRESENTACAO-COMERCIAL.md) | Pitch e vendas |
| [KIT-COMERCIALIZACAO.md](./KIT-COMERCIALIZACAO.md) | Preços, proposta, SLA |
| [FAQ-SUPORTE.md](./FAQ-SUPORTE.md) | Suporte |
| [GLOSSARIO.md](./GLOSSARIO.md) | Termos |
| [GO-LIVE-CHECKLIST.md](../GO-LIVE-CHECKLIST.md) | Liberar operação |

## 🔧 Técnico e deploy

| Documento | Uso |
|-----------|-----|
| [DEPLOY_FIRST_CUSTOMER.md](../DEPLOY_FIRST_CUSTOMER.md) | Primeiro cliente em VPS |
| [DEPLOY.md](../DEPLOY.md) | Deploy geral |
| [ENTERPRISE.md](../ENTERPRISE.md) | Infra enterprise |
| [OPERATIONS_RUNBOOK.md](../OPERATIONS_RUNBOOK.md) | Operação 24/7 |
| [BACKUP_RESTORE.md](../BACKUP_RESTORE.md) | Backup |
| [WHATSAPP_PROVIDERS.md](../WHATSAPP_PROVIDERS.md) | Evolution / Meta |
| [AUTOMATED_TESTING_README.md](../AUTOMATED_TESTING_README.md) | Testes automatizados |

## 💰 Billing e integrações

| Documento | Uso |
|-----------|-----|
| [BILLING.md](../BILLING.md) | Planos e limites |
| [PAYMENTS.md](../PAYMENTS.md) | Pagamentos |
| [API.md](../API.md) | API pública v1 |
| [WEBHOOKS.md](../WEBHOOKS.md) | Webhooks outbound |

## 🔒 Segurança e compliance

| Documento | Uso |
|-----------|-----|
| [SECURITY.md](../SECURITY.md) | Política de segurança |
| [SEGURANCA-ENTERPRISE.md](./SEGURANCA-ENTERPRISE.md) | LGPD, produção |
| [LGPD_CHECKLIST.md](../LGPD_CHECKLIST.md) | Checklist LGPD |
| [PRIVACY.md](../PRIVACY.md) | Privacidade |
| [DPA_TEMPLATE.md](../DPA_TEMPLATE.md) | Contrato tratamento dados |
| [SLA_TEMPLATE.md](../SLA_TEMPLATE.md) | SLA contrato |

## ✅ QA (evidências de testes)

| Documento | Uso |
|-----------|-----|
| [GO_LIVE_QA_DECISION.md](../GO_LIVE_QA_DECISION.md) | Decisão go-live |
| [VALIDATION_REPORT.md](../VALIDATION_REPORT.md) | Comandos e resultados |
| [FULL_QA_TEST_PLAN.md](../FULL_QA_TEST_PLAN.md) | Plano de QA |
| [BUG_REPORT.md](../BUG_REPORT.md) | Bugs conhecidos |

---

# PARTE 4 — Apresentação comercial (resumo executivo)

Use **[APRESENTACAO-COMERCIAL.md](./APRESENTACAO-COMERCIAL.md)** em reuniões.

**Proposta de valor em uma frase:**  
*Atlas One centraliza WhatsApp, CRM e supervisão comercial para equipes B2B que perdem leads no celular pessoal.*

**Páginas públicas para enviar ao prospect:**

- Landing: `https://seudominio.com.br/landing`
- Planos: `https://seudominio.com.br/pricing`
- Termos: `https://seudominio.com.br/terms`
- Privacidade: `https://seudominio.com.br/privacy`
- Status: `https://seudominio.com.br/status`

**Planos (referência):**

| Plano | Público | Referência |
|-------|---------|------------|
| Starter | 3 usuários, 1 WhatsApp | R$ 297/mês |
| Pro | 10–25 usuários, automações + API | R$ 697–897/mês |
| Enterprise | Escala + SSO | Sob consulta |

**O que prometer no cliente #1:**

- ✅ Inbox multi-atendente WhatsApp  
- ✅ CRM Kanban integrado  
- ✅ Dashboard e export CSV  
- ✅ Perfis e permissões  
- ✅ Implantação assistida + treinamento  

**O que NÃO prometer ainda:**

- ❌ Signup público sem você configurar  
- ❌ SLA 99,9% sem VPS monitorada  
- ❌ SSO Google/Microsoft sem configurar OIDC  
- ❌ Pentest / ISO / SOC2  

---

# PARTE 5 — Segurança: regras que você DEVE seguir

1. **Nunca** commitar `.env` com secrets  
2. **Nunca** `QA_BYPASS_2FA` em produção  
3. **Sempre** HTTPS em produção  
4. **Sempre** backup diário do PostgreSQL  
5. **Sempre** 2FA para conta dono em produção  
6. **Sempre** `SETUP_TOKEN` para criar novos tenants (bootstrap)  
7. **Revisar** Admin → Auditoria semanalmente  
8. Senhas: mínimo 12 caracteres, 3 classes (já enforced)  

Detalhes: [SEGURANCA-ENTERPRISE.md](./SEGURANCA-ENTERPRISE.md)

---

# PARTE 6 — Comandos rápidos (cola na parede)

```powershell
# Instalar
corepack pnpm install

# Banco
corepack pnpm db:push

# Build
corepack pnpm build

# Subir (Windows)
.\start-atlas-completo.ps1
# ou pm2 start ecosystem.config.cjs

# Testes
node scripts/run-qa-api-smoke.mjs
npx playwright test
corepack pnpm test:qa

# Billing
node scripts/run-billing-smoke.mjs

# Docker validate
node scripts/validate-docker-compose.mjs

# Seed cliente teste QA
cd apps/server
$env:NODE_ENV="development"
corepack pnpm exec tsx ../../scripts/seed-first-customer-test-data.ts

# Health
curl http://localhost:4000/api/health
curl http://localhost:4000/api/ready
```

---

# PARTE 7 — Checklist final antes de abrir operação comercial

## Você (fornecedor Atlas One)

- [ ] VPS em produção com HTTPS
- [ ] `.env` produção sem QA bypass
- [ ] Backup automático funcionando
- [ ] Evolution 24/7 online
- [ ] Redis rodando em produção
- [ ] Testes smoke passando no servidor
- [ ] Asaas configurado OU processo manual de cobrança definido
- [ ] Proposta comercial e contrato prontos
- [ ] Canal de suporte definido (WhatsApp/e-mail)

## Cliente (após implantação)

- [ ] GO-LIVE-CHECKLIST completo
- [ ] Dono treinado (MANUAL-DONO)
- [ ] Equipe treinada (GUIA-RAPIDO)
- [ ] WhatsApp enviando e recebendo
- [ ] 3 atendimentos reais simulados com sucesso

---

# PARTE 8 — Próximos passos recomendados (ordem)

1. **Hoje:** rode `corepack pnpm test:qa` e confirme 32/32  
2. **Esta semana:** contrate VPS, siga `DEPLOY_FIRST_CUSTOMER.md`  
3. **Esta semana:** configure Asaas sandbox OU defina cobrança manual  
4. **Próxima semana:** feche cliente piloto usando `KIT-COMERCIALIZACAO.md`  
5. **Contínuo:** monitore `/status` e backups  

---

*Atlas One — Manual de Operação Completo v1.0*  
*Dúvidas técnicas: `FAQ-SUPORTE.md` · Evidências QA: `docs/CONFIRMACAO-ESTABILIDADE.md`*
