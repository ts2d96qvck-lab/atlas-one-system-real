# Deploy do Primeiro Cliente — Atlas One

Checklist operacional para sair do PC local e ir para produção.

## 1. Servidor (VPS)

Requisitos mínimos: 2 vCPU, 4 GB RAM, Ubuntu 22.04+, domínio com HTTPS.

```bash
# No servidor
git clone <repo> atlas-one && cd atlas-one
cp .env.production.example .env
# Edite .env com senhas reais (POSTGRES, REDIS, JWT, WEBHOOK, SETUP_TOKEN)
nano .env
```

## 2. Validar compose localmente

```bash
node scripts/validate-docker-compose.mjs
docker compose -f docker-compose.prod.yml --env-file .env config
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

## 3. Primeiro tenant (owner)

```bash
curl -X POST https://app.seudominio.com.br/auth/bootstrap-owner \
  -H "Content-Type: application/json" \
  -H "X-Setup-Token: SEU_SETUP_TOKEN" \
  -d '{"tenantSlug":"cliente-1","tenantName":"Cliente Um","ownerName":"Dono","ownerEmail":"owner@cliente.com","ownerPassword":"SenhaForte12!","ownerPhone":"5511999999999"}'
```

**Produção:** não use `QA_BYPASS_2FA` nem `QA_BYPASS_RATE_LIMIT`. Owner receberá OTP via WhatsApp/SMS.

## 4. Asaas (opcional para cobrança automática)

```env
PAYMENT_PROVIDER=asaas
ASAAS_API_KEY=sua_chave_sandbox_ou_prod
ASAAS_ENV=sandbox
```

Teste:

```bash
node scripts/run-billing-smoke.mjs
```

## 5. Evolution / WhatsApp

- Evolution API rodando e `connectionStatus=open`
- `EVOLUTION_URL`, `EVOLUTION_API_KEY`, `WEBHOOK_PUBLIC_URL` corretos
- Webhook Evolution apontando para `https://app.seudominio.com.br/webhook/evolution/{tenantSlug}`

## 6. Pós-deploy

```bash
curl https://app.seudominio.com.br/api/health
curl https://app.seudominio.com.br/api/ready
curl https://app.seudominio.com.br/landing
```

## 7. QA em staging

```bash
QA_API_URL=https://app.seudominio.com.br QA_WEB_URL=https://app.seudominio.com.br node scripts/run-qa-api-smoke.mjs
# E2E contra staging (sem QA bypass em prod!)
```

## O que NÃO fazer em produção

- `QA_BYPASS_2FA=true`
- `QA_BYPASS_RATE_LIMIT=true`
- `ALLOW_PUBLIC_BOOTSTRAP=true` sem `SETUP_TOKEN` forte
- Commitar `.env` com secrets
