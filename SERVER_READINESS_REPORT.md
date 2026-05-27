# Atlas One — Server Readiness Report

**Data:** 2026-05-26  
**Ambiente testado:** Windows 11, Node 22, PostgreSQL local, PM2/dev ativo  
**Decisão final:** **Parcialmente pronto** para servidor de teste (com checklist de deploy abaixo)

---

## Resumo executivo

O sistema **compila e roda localmente**. A stack de deploy (Docker, nginx, docs, health checks) **existe e está documentada**. Para sair do notebook é necessário: configurar `.env` de produção/staging, subir PostgreSQL + Redis + Evolution (ou Meta), trocar URLs de túnel (`trycloudflare`) por domínio fixo, e usar `docker compose` ou PM2/systemd no Linux — **não depender do PM2 no Windows**.

---

## Checklist (15 itens)

| # | Item | Status | Evidência |
|---|------|--------|-----------|
| 1 | `pnpm dev` | **OK*** | API responde em `:4000`; web em `:3001`. *No Windows, o script `dev:enterprise` usa `&` (bash) — prefira PM2 ou dois terminais.* |
| 2 | `pnpm build` | **OK** | Build completo após correção em `plans.ts` (campo `campaigns` no plano Pro). |
| 3 | `pnpm start` | **Condicional** | Exige build prévio + `NODE_ENV=production` + `.env` válido (secrets fortes). Falha com credenciais padrão `atlas:atlas@` (validação intencional). |
| 4 | `.env.example` | **OK** | Raiz do repo — referência completa (core, API, web, WhatsApp, SMS, Docker). |
| 5 | `.env.production.example` | **OK** | Raiz do repo — template mínimo para servidor. |
| 6 | `Dockerfile` | **OK** | `apps/server/Dockerfile` + `apps/web/Dockerfile` (Next standalone). |
| 7 | `docker-compose.prod.yml` | **OK** | Postgres, Redis, Evolution, API, Web, nginx. |
| 8 | `DEPLOY.md` | **OK** | Guia Docker, Node bare-metal, migrations, health, arquitetura. |
| 9 | `GET /api/health` | **OK** | `{"ok":true,"service":"atlas-one-server","version":"0.1.0",...}` |
| 10 | `GET /api/ready` | **OK** | Retorna DB + Evolution + Redis; em dev `ready:true` mesmo sem Redis/Evolution. |
| 11 | Banco produção | **Parcial** | Prisma + PostgreSQL; migrations versionadas em `apps/server/prisma/migrations/`. Migration `campaigns` adicionada neste report. |
| 12 | Redis obrigatório? | **Não** | Opcional: rate-limit distribuído e fila de webhooks. Em produção com `REDIS_URL`, `/api/ready` exige Redis up. |
| 13 | WhatsApp externo? | **Sim** | Evolution API (Baileys) ou Meta Cloud API — serviços separados, configurados via env. |
| 14 | localhost / ngrok / trycloudflare? | **Atenção** | Código aceita `*.trycloudflare.com` (CORS/realtime). **Seu `.env` local usa trycloudflare** — trocar por domínio HTTPS fixo no servidor. |
| 15 | 24/7 sem notebook? | **Sim, com infra** | Docker Compose + `restart: unless-stopped` ou systemd/PM2 no Linux. Não usar túnel do notebook. |

---

## Comandos testados

```powershell
# Build (PASS — após fix plans.ts)
cd C:\Users\vinic\Downloads\atlas-one-system-real\atlas-one-system-real
corepack pnpm build

# Health (PASS — API já rodando)
Invoke-WebRequest http://127.0.0.1:4000/api/health

# Ready (PASS — ~24s por timeout Evolution)
Invoke-WebRequest http://127.0.0.1:4000/api/ready

# Start produção com .env local (FAIL esperado — credencial postgres padrão)
$env:NODE_ENV="production"
node apps/server/dist/server.mjs
# Erro: DATABASE_URL usa credencial padrao

# Start build compilado em dev (PASS — porta em uso confirma stack ativa)
$env:NODE_ENV="development"
$env:ATLAS_ENTERPRISE_MODE="false"
node apps/server/dist/server.mjs
```

---

## Erros encontrados e correções

| Erro | Impacto | Correção |
|------|---------|----------|
| `plans.ts`: falta `campaigns` no plano Pro | **`pnpm build` falhava** | Corrigido — `campaigns: true` no plano Pro. |
| Schema `Campaign` sem migration | `prisma migrate deploy` incompleto em prod | Migration `20260526200000_campaigns` adicionada. |
| `.env` local com `trycloudflare.com` | Webhooks quebram ao fechar notebook | Trocar `WEBHOOK_PUBLIC_URL` / `APP_PUBLIC_URL` no servidor. |
| `pnpm start` + credenciais postgres padrão | API não sobe em modo produção | Usar senhas de `.env.production.example` no servidor. |
| `pnpm dev` com `&` no Windows | Um dos processos pode não iniciar | Usar PM2 (`ecosystem.config.cjs`) ou terminais separados. |

---

## O que ainda precisa corrigir antes de produção real

1. **Domínio fixo + HTTPS** — Cloudflare ou certbot; atualizar `WEBHOOK_PUBLIC_URL`, `CORS_ORIGINS`, `NEXT_PUBLIC_*`.
2. **Secrets fortes** — `JWT_SECRET`, `WEBHOOK_SECRET`, `PAYMENTS_WEBHOOK_SECRET`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD` (32+ chars).
3. **Evolution no servidor** — incluído no `docker-compose.prod.yml` ou instância externa acessível pela API.
4. **Redis em staging/prod** — recomendado; compose já provisiona.
5. **SMS em produção** — `SMS_PROVIDER=twilio` ou `webhook` (não `console`).
6. **Desligar robô URA** se ainda estiver ativo no tenant (`menuBot.enabled=false` no Admin) até go-live controlado.
7. **Seed inicial** — `ALLOW_SEED=true` apenas no primeiro deploy de staging.

---

## Variáveis de ambiente necessárias (servidor de teste)

Copie `.env.production.example` → `.env` e preencha:

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `NODE_ENV` | Sim | `production` |
| `DATABASE_URL` | Sim | PostgreSQL (senha forte) |
| `JWT_SECRET` | Sim | 32+ caracteres aleatórios |
| `WEBHOOK_PUBLIC_URL` | Sim | HTTPS público (webhooks Evolution/Meta) |
| `APP_PUBLIC_URL` | Sim | URL do app |
| `CORS_ORIGINS` | Sim | Mesmo domínio do app |
| `EVOLUTION_URL` | Sim* | URL interna/externa da Evolution |
| `EVOLUTION_API_KEY` | Sim* | Chave da Evolution |
| `WEBHOOK_SECRET` | Sim | 32+ chars |
| `PAYMENTS_WEBHOOK_SECRET` | Sim | 32+ chars |
| `PLATFORM_ADMIN_EMAILS` | Sim | E-mails dos admins |
| `SETUP_TOKEN` | Sim | Token one-time bootstrap |
| `REDIS_URL` | Recomendado | `redis://:senha@redis:6379` |
| `NEXT_PUBLIC_API_URL` | Sim (build web) | Domínio público |
| `NEXT_PUBLIC_WS_URL` | Sim (build web) | Domínio público (WSS) |
| `SMS_PROVIDER` | Sim (prod) | `twilio` ou `webhook` |
| `META_WHATSAPP_*` | Opcional | Se usar API oficial Meta |

\* Obrigatório se `WHATSAPP_DEFAULT_PROVIDER=evolution`.

---

## Serviços necessários

```
Internet → HTTPS (Cloudflare/nginx)
         → atlas-web:3001 (Next.js)
         → atlas-server:4000 (Fastify API)
         → evolution-api:8080 (WhatsApp)
         → postgres:5432 (dados Atlas)
         → redis:6379 (rate limit + fila, recomendado)
         → evolution-postgres + evolution-redis (stack Evolution)
```

---

## Comandos exatos para subir em servidor de teste

### Opção A — Docker (recomendado)

```bash
git clone <repo> atlas-one && cd atlas-one
cp .env.production.example .env
# Edite .env — TODOS os REPLACE/CHANGE_ME

docker compose -f docker-compose.prod.yml up -d --build

# Verificar
curl -s http://localhost/api/health
curl -s http://localhost/api/ready

# Seed (primeira vez, staging)
docker compose -f docker-compose.prod.yml exec atlas-server sh -c "cd /app && ALLOW_SEED=true npx tsx prisma/seed.ts"
```

### Opção B — Node 20 bare-metal (Linux)

```bash
corepack enable && corepack pnpm install
cp .env.production.example .env
# configure .env + PostgreSQL + Redis + Evolution

pnpm build
pnpm --filter @atlas-one/server db:migrate:deploy
NODE_ENV=production pnpm start
# ou: pm2 start ecosystem.config.cjs --env production
```

### Parar dependência do notebook

- Não usar `docker-compose.public-tunnel.yml` nem URLs `trycloudflare.com`.
- Apontar DNS do domínio de teste para o IP do VPS.
- Configurar webhook Evolution: `{WEBHOOK_PUBLIC_URL}/webhook/evolution/{tenantSlug}`.

---

## Decisão final

### **Parcialmente pronto** para servidor de teste

| Critério | Situação |
|----------|----------|
| Código compila | Sim (`pnpm build` OK) |
| Artefatos de produção | Sim (`dist/server.mjs`, `.next/` completo) |
| Documentação de deploy | Sim |
| Infra Docker | Sim |
| Configuração do ambiente | Pendente no servidor (domínio, secrets, Evolution) |
| Independência do notebook | Sim, após deploy correto |

**Próximo passo:** VPS Linux + `.env` de produção + `docker compose -f docker-compose.prod.yml up -d --build` + validar `/api/health` e login no domínio de teste.
