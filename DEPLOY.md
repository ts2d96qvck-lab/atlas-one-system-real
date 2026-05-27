# Atlas One — Deployment Guide

This guide covers production deployment without developer laptops or `trycloudflare.com` tunnels.

## Prerequisites

- Linux VPS (Ubuntu 22.04+ recommended) or cloud VM (AWS, Azure, GCP, Hetzner)
- Docker Engine 24+ and Docker Compose v2
- Domain you control (e.g. `app.atlasone.app.br`)
- Minimum: 2 vCPU, 4 GB RAM, 40 GB disk

## Quick start (Docker production stack)

```bash
git clone <repository-url> atlas-one
cd atlas-one

cp .env.production.example .env
# Edit .env — replace ALL CHANGE_ME / REPLACE values

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec atlas-server node -e "console.log('api ok')"
```

Verify:

```bash
curl -s http://localhost/api/health
curl -s http://localhost/api/ready
```

Expected `/api/health`:

```json
{"ok":true,"service":"atlas-one-server","version":"0.1.0","environment":"production"}
```

## Build and run without Docker (VPS with Node 20)

```bash
corepack enable
pnpm install
cp .env.production.example .env
# configure .env

pnpm build
NODE_ENV=production pnpm start
```

Production uses compiled API (`node dist/...`) and `next start` — **never** `pnpm dev`.

## Environment variables

| File | Purpose |
|------|---------|
| `.env.example` | Full reference (dev + prod) |
| `.env.production.example` | Minimal production template |
| `.env` | Active config on server (never commit) |

Required in production (`NODE_ENV=production`):

- `JWT_SECRET` (32+ random chars)
- `DATABASE_URL`
- `EVOLUTION_API_KEY`
- `WEBHOOK_SECRET`, `PAYMENTS_WEBHOOK_SECRET`
- `PLATFORM_ADMIN_EMAILS`
- `CORS_ORIGINS` with your fixed domain
- `WEBHOOK_PUBLIC_URL` = public HTTPS URL
- `SMS_PROVIDER` ≠ `console` (use `twilio` or `webhook`)

## Fixed domain and HTTPS

### Option A — Cloudflare (recommended)

1. Point `app.atlasone.app.br` A record to VPS IP (orange cloud ON).
2. SSL/TLS mode: **Full (strict)**.
3. Set `WEBHOOK_PUBLIC_URL=https://app.atlasone.app.br`.
4. Set `CORS_ORIGINS=https://app.atlasone.app.br`.
5. Optional tenant subdomains: `*.atlasone.app.br` CNAME to same origin; nginx `atlas-prod.conf` already accepts wildcard `server_name`.

### Option B — Let's Encrypt on VPS

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d app.atlasone.app.br
```

Mount certificates into nginx container or terminate TLS on host nginx.

### Option C — Cloud PaaS (Railway, Render, Fly.io)

- Deploy `atlas-server` and `atlas-web` as separate services.
- Use managed PostgreSQL.
- Set env vars from `.env.production.example`.
- Point custom domain in platform UI.

## Database migrations

**Desenvolvimento** (schema rapido):

```bash
pnpm --filter @atlas-one/server db:push
```

**Producao** (recomendado — historico versionado):

```bash
pnpm --filter @atlas-one/server db:migrate:deploy
```

Primeiro deploy (se ainda nao houver migrations aplicadas):

```bash
docker compose -f docker-compose.prod.yml exec atlas-server sh -c "cd /app/apps/server && npx prisma migrate deploy"
docker compose -f docker-compose.prod.yml exec atlas-server sh -c "cd /app && npx tsx prisma/seed.ts"
```

Fallback legado: `prisma db push` (nao usar em prod de longo prazo).

## Health checks and monitoring

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Liveness (process up) |
| `GET /api/ready` | Readiness (DB + Evolution) |
| `GET /api/status` | Status page JSON (componentes + incidentes) |
| `GET /health` | Alias (legacy) |
| `GET /ready` | Alias (legacy) |

Pagina publica: **`/status`** (Next.js) — consome `/api/status`.

Configure uptime monitor (UptimeRobot, Better Stack, Datadog) on:

```
https://app.atlasone.app.br/api/health
https://app.atlasone.app.br/api/ready
https://app.atlasone.app.br/api/status
```

Incidentes manuais: edite `infra/status/incidents.json` (ver [STATUS_PAGE_PLAN.md](./STATUS_PAGE_PLAN.md)).

Logs: JSON structured logs on API startup and errors (`startup-log.ts`). Docker:

```bash
docker compose -f docker-compose.prod.yml logs -f atlas-server
```

## Architecture (production)

```
Internet → Cloudflare HTTPS → nginx:80 → atlas-web:3001 (Next.js)
                                      → atlas-server:4000 (Fastify API)
                                      → evolution-api:8080
                    postgres / redis
```

No dependency on:

- Developer notebook
- PM2 on Windows
- Cloudflare quick tunnels

## Post-deploy checklist

- [ ] `/api/health` returns 200
- [ ] `/api/ready` shows `database: true`
- [ ] Login works on fixed domain
- [ ] WhatsApp webhook URL points to `https://app.atlasone.app.br/webhook/evolution/{slug}`
- [ ] `ALLOW_PUBLIC_BOOTSTRAP=false`
- [ ] **Backup scheduled** — see [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)
- [ ] **Security baseline reviewed** — see [SECURITY_BASELINE.md](./SECURITY_BASELINE.md)

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| API exits on start | Check env validation errors in logs — weak `JWT_SECRET` or missing secrets |
| 502 from nginx | Wait for healthchecks; check `docker compose ps` |
| Webhook not receiving | Verify `WEBHOOK_PUBLIC_URL` and Evolution sync |
| CORS errors | Add exact origin to `CORS_ORIGINS` |

## Local development (not production)

```bash
pnpm install
cp .env.example apps/server/.env
pnpm --filter @atlas-one/server dev
pnpm --filter @atlas-one/web dev
```

Use `docker compose -f docker-compose.atlas-stack.yml` only for local integration — not for customer-facing SaaS.
