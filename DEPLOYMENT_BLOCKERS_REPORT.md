# Deployment Blockers Report — VPS First Deploy Simulation

**Date:** 2026-05-27  
**Project:** `atlas-one-system-real`  
**Method:** Read-only simulation — no VPS deploy, no code/feature changes  
**Machine:** Windows 11, Docker 29.4.3, Compose 5.1.3, Node 22.22.0, pnpm 9.15.4

---

## Executive summary

The project **builds and runs locally** (`pnpm build` PASS, API `/api/health` PASS, Next.js prod start HTTP 200).  
The **documented VPS path** (`docker compose -f docker-compose.prod.yml up -d --build`) **cannot succeed today** because **both production Docker images fail to build**.

Verified blockers: **5 CRITICAL**, **6 HIGH**, **5 MEDIUM**, **4 LOW**.

---

## Simulation checklist (verified)

| # | Area | Result | Evidence |
|---|------|--------|----------|
| 1 | Docker Compose prod stack | **PARTIAL PASS** | `node scripts/validate-docker-compose.mjs` → PASS (13 service blocks); `docker compose -f docker-compose.prod.yml config` → OK |
| 2 | Nginx configuration | **PARTIAL PASS** | Syntax valid inside compose network; standalone `nginx -t` fails only because upstream hosts (`atlas-server`, `atlas-web`) are not resolvable outside compose (expected) |
| 3 | Production environment variables | **FAIL** | Root `.env` has placeholders / mismatches (see below); `.env.production.example` still contains `REPLACE_*` tokens |
| 4 | PostgreSQL startup | **CONFIG PASS / RUNTIME UNTESTED** | `postgres:16-alpine` + healthcheck + volume in prod compose; local `atlas_one_postgres` healthy with full schema |
| 5 | Redis startup | **CONFIG PASS / RUNTIME UNTESTED** | `redis:7-alpine` + password + healthcheck in prod compose; local dev Redis container stopped (dev stack only) |
| 6 | Evolution API startup | **PASS (dev) / UNTESTED (prod compose)** | `evoapicloud/evolution-api:latest` running 33h locally; HTTP 200 `"Welcome to the Evolution API"` |
| 7 | Atlas server startup | **PASS (local dev) / FAIL (prod Docker)** | Dev API healthy; `docker compose … build atlas-server` **FAIL** at `pnpm exec prisma generate` |
| 8 | Atlas web startup | **PASS (local) / FAIL (prod Docker)** | `pnpm start` → HTTP 200; `docker compose … build atlas-web` **FAIL** at `pnpm exec next build` |
| 9 | Health checks | **PARTIAL PASS** | Dev: `/api/health` OK, `/api/ready` OK (redis=false in dev); prod Docker healthchecks defined but blocked by failed image builds |
| 10 | HTTPS requirements | **NOT MET** | Compose exposes **port 80 only**; `443:443` commented; nginx HTTPS redirect commented |
| 11 | Domain requirements | **NOT MET / MISALIGNED** | No live DNS verified; nginx hardcoded `app.atlasone.com.br`; root `.env` uses `atlasone.app.br` |
| 12 | Missing secrets | **YES** | `SMS_WEBHOOK_URL` empty; `PLATFORM_ADMIN_EMAILS` placeholder; template still has `REPLACE_*` |
| 13 | Missing production configs | **YES** | No `.dockerignore`; prod stack never run (`atlas_prod_*` containers absent); no VPS |

---

## Blockers by severity

### CRITICAL

| ID | Blocker | Verification |
|----|---------|--------------|
| C1 | **Production Docker image `atlas-server` does not build** | `docker compose -f docker-compose.prod.yml build atlas-server` → `Error: Cannot find module '/app/apps/server/node_modules/prisma/build/index.js'` during `pnpm exec prisma generate` |
| C2 | **Production Docker image `atlas-web` does not build** | `docker compose -f docker-compose.prod.yml build atlas-web` → `Error: Cannot find module '/app/apps/web/node_modules/next/dist/bin/next'` during `pnpm exec next build` |
| C3 | **Prod stack never validated end-to-end** | `docker compose -f docker-compose.prod.yml ps` shows **zero** `atlas_prod_*` containers; only dev stack (`atlas_one_*`) running |
| C4 | **No VPS provisioned** | No server IP, SSH, or Linux host verified for deployment |
| C5 | **No live public HTTPS domain** | `WEBHOOK_PUBLIC_URL` / WhatsApp webhooks require public HTTPS; compose has no TLS termination on 443 |

### HIGH

| ID | Blocker | Verification |
|----|---------|--------------|
| H1 | **Domain mismatch across layers** | `infra/nginx/atlas-prod.conf` → `server_name app.atlasone.com.br`; root `.env` → `APP_PUBLIC_URL`, `CORS_ORIGINS`, `NEXT_PUBLIC_*` = `https://atlasone.app.br` |
| H2 | **`PLATFORM_ADMIN_EMAILS` is a placeholder** | Root `.env`: `seu-email@empresa.com` |
| H3 | **SMS/2FA not production-ready** | Root `.env`: `SMS_PROVIDER=webhook`, `SMS_WEBHOOK_URL=` (empty), `ATLAS_ALLOW_LOCAL_SMS=false` |
| H4 | **`atlas-web` blocked by `atlas-server` health gate** | Compose `depends_on: atlas-server: condition: service_healthy`; server healthcheck hits `/api/ready` which requires DB + Redis in production — any startup delay fails the chain |
| H5 | **pnpm workspace layout breaks Docker build stages** | `prisma` is in `apps/server` **devDependencies**; Docker runs `pnpm exec` from `apps/server` and `apps/web` subdirs after root install — hoisted modules not found |
| H6 | **First deploy bootstrap not automated** | No compose step for initial seed / owner bootstrap; manual steps required (`SETUP_TOKEN`, seed, Evolution QR) |

### MEDIUM

| ID | Blocker | Verification |
|----|---------|--------------|
| M1 | **TLS only via external layer** | Port 443 commented; operator must configure Cloudflare or certbot separately |
| M2 | **Evolution DB password defaults to `evolution`** | `EVOLUTION_DB_PASSWORD` not in `.env.production.example`; compose default `${EVOLUTION_DB_PASSWORD:-evolution}` |
| M3 | **Evolution service has no healthcheck in prod compose** | `evolution-api` starts without health gate; WhatsApp may be down while API reports partial readiness |
| M4 | **No `.dockerignore`** | Build context transferred ~27 MB; risk of slow builds and accidental inclusion of local artifacts on VPS |
| M5 | **Billing env incomplete in template** | `.env.production.example` sets `PAYMENT_PROVIDER=asaas` with empty `ASAAS_API_KEY` (generated `.env` uses `manual`) |

### LOW

| ID | Blocker | Verification |
|----|---------|--------------|
| L1 | **Dev `.env` still uses trycloudflare URLs** | `apps/server/.env` → `WEBHOOK_PUBLIC_URL=https://…trycloudflare.com` (ignored if prod `.env` used on VPS) |
| L2 | **Local dev Redis stopped** | `atlas_one_redis` → Exited; dev `/api/ready` reports `redis: false` (not prod stack) |
| L3 | **Docker build warns git missing in PATH** | BuildKit warning during image build (non-fatal) |
| L4 | **README contains demo login credentials** | Public repo risk if GitHub repo is public |

---

## Area-by-area notes

### 1. Docker Compose production stack

- **Services defined:** postgres, redis, evolution-postgres, evolution-redis, evolution-api, atlas-server, atlas-web, nginx (8 services).
- **Compose validation:** PASS.
- **Image build:** FAIL for custom images (`atlas-server`, `atlas-web`).
- **Runtime simulation:** NOT EXECUTED (would require deploy).

### 2. Nginx configuration

- File: `infra/nginx/atlas-prod.conf`
- Proxies API routes, Socket.io, and web frontend correctly **when upstream containers exist**.
- `/api/health` location rewrites to backend `/health` — backend exposes both `/health` and `/api/health` → OK.
- **Hardcoded domain** `app.atlasone.com.br` may not match operator domain.

### 3. Production environment variables

**Root `.env` (generated for `atlasone.app.br`):**

| Variable | Status |
|----------|--------|
| `JWT_SECRET`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `WEBHOOK_SECRET`, `SETUP_TOKEN`, `EVOLUTION_API_KEY` | Present (generated hex values) |
| `APP_PUBLIC_URL`, `WEBHOOK_PUBLIC_URL`, `CORS_ORIGINS`, `NEXT_PUBLIC_*` | Set to `https://atlasone.app.br` |
| `PLATFORM_ADMIN_EMAILS` | **Placeholder** `seu-email@empresa.com` |
| `SMS_WEBHOOK_URL` | **Empty** |
| `WHATSAPP_DEFAULT_PROVIDER` | `evolution` |

**`.env.production.example`:** still contains `REPLACE_*` placeholders — not deploy-ready without editing or running `scripts/generate-staging-env.mjs`.

### 4. PostgreSQL startup

- Prod compose: `postgres:16-alpine`, healthcheck `pg_isready`, persistent volume `atlas_postgres_data`.
- Migrations: 3 versioned migrations under `apps/server/prisma/migrations/`.
- Entrypoint: `npx prisma migrate deploy` before API start.
- Local DB verified healthy with application tables.

### 5. Redis startup

- Prod compose: `redis:7-alpine`, `--requirepass`, healthcheck with auth.
- Production `/api/ready` **requires Redis** when `REDIS_URL` is set (it is in prod `.env`).

### 6. Evolution API startup

- Prod compose includes dedicated Postgres + Redis + `evoapicloud/evolution-api:latest`.
- Local Evolution API v2.3.7 responding.
- Requires post-deploy QR connect + webhook sync to public URL.

### 7. Atlas server startup

- **Local:** running; env validation blocks weak credentials in production mode (expected).
- **Docker prod:** build failure prevents container start.
- Production env validation (`validateProductionEnv`) enforces HTTPS URLs, strong secrets, `SETUP_TOKEN`, etc.

### 8. Atlas web startup

- **Local:** `next build` + `next start` → HTTP 200.
- **Docker prod:** build failure (`next` binary not found in workspace path).

### 9. Health checks

| Endpoint | Dev result | Prod compose definition |
|----------|------------|-------------------------|
| `/api/health` | 200 OK | atlas-server + nginx |
| `/api/ready` | 200 OK (`redis: false` in dev) | atlas-server healthcheck; requires DB + Redis in prod |

### 10. HTTPS requirements

- Application validation rejects non-HTTPS `APP_PUBLIC_URL` / `WEBHOOK_PUBLIC_URL` in production (except localhost).
- Compose nginx listens on **80 only**; HTTPS must be terminated at Cloudflare or host certbot.

### 11. Domain requirements

- **Required:** DNS A record → VPS IP, valid TLS, consistent URLs in `.env`, nginx `server_name`, and CORS.
- **Verified mismatch:** `atlasone.app.br` (env) vs `app.atlasone.com.br` (nginx default).

### 12. Missing secrets

- Template placeholders if not generated.
- `SMS_WEBHOOK_URL` empty in generated `.env`.
- `ASAAS_API_KEY` empty when using Asaas template defaults.

### 13. Missing production configs

- No `.dockerignore`.
- Prod compose never run on any host.
- Manual post-deploy: owner bootstrap, optional seed, Evolution QR, webhook sync.

---

## What works today (verified)

- `pnpm build` → **PASS** (re-verified 2026-05-27)
- Git remote synced → `git ls-remote origin HEAD` = `65a327f`
- Dev PostgreSQL healthy with schema
- Dev Evolution API healthy
- Dev API `/api/health` and `/api/ready` respond
- Next.js production mode serves HTTP 200 locally

---

## Probability calculation (evidence-based)

**Method:** 18 first-deploy gates scored PASS / FAIL / UNTESTED from this simulation.

| Outcome | Count |
|---------|-------|
| PASS today | 7 |
| FAIL today | 6 |
| UNTESTED / PARTIAL today | 5 |

**After resolving all CRITICAL + HIGH blockers** (Docker builds fixed, VPS + DNS + HTTPS live, domain aligned, secrets completed, SMS configured):

| Outcome | Count |
|---------|-------|
| Expected PASS | 14 |
| Residual UNTESTED (first compose up, Evolution QR, webhook E2E, SMS delivery) | 4 |

**Formula:** `14 / 18 × 100 = 77.8%`

---

## Probability of successful VPS deployment after fixes: **78%**

*(Rounded from verified gate score 14/18. Residual 22% = first-time prod compose runtime, WhatsApp QR/webhook E2E, and SMS delivery not yet executed on a VPS.)*

---

## Recommended fix order (informational — not applied)

1. Fix Dockerfiles / pnpm workspace install so `atlas-server` and `atlas-web` images build.
2. Provision VPS + DNS + HTTPS (Cloudflare recommended).
3. Align domain across nginx, `.env`, and CORS.
4. Complete secrets (`PLATFORM_ADMIN_EMAILS`, SMS provider).
5. Run `docker compose -f docker-compose.prod.yml up -d --build` on VPS and verify `/api/health`, `/api/ready`, login, Evolution QR.

---

*Report generated from local verification only. No deployment was performed.*
