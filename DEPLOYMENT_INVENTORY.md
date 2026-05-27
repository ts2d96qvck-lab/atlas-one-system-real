# Deployment Inventory — Atlas One

**Inspected:** 2026-05-26  
**Path:** `C:\Users\vinic\Downloads\atlas-one-system-real\atlas-one-system-real`  
**Method:** filesystem inspection, Docker CLI, env files, compose validation (no code changes)

---

## 1. Is the project stored in GitHub?

**No.** There is no `.git` directory in the workspace. The project is a local folder only. A `.github/workflows/ci.yml` file exists (CI template) but no remote repository is configured.

---

## 2. What is the GitHub repository URL?

**None.** No `git remote` could be verified. `git` is not available in the system PATH on the inspected machine, and no `.git/config` file exists.

---

## 3. Is git configured correctly?

**No.**

| Check | Result |
|-------|--------|
| `.git` directory | Absent |
| `git` CLI | Not found in PATH |
| Remote configured | Not verifiable |
| `.gitignore` | Present |
| `.github/workflows/ci.yml` | Present (unused without a repo) |

The project is not under version control on this machine.

---

## 4. What database is being used?

**PostgreSQL 16** via **Prisma ORM** (`apps/server/prisma/schema.prisma`, `datasource db { provider = "postgresql" }`).

---

## 5. Where is the database currently running?

**Docker container on the local machine**, not on a remote VPS.

| Evidence | Detail |
|----------|--------|
| Running container | `atlas_one_postgres` — Up, healthy |
| Compose source | `docker-compose.atlas-stack.yml` (container naming pattern) |
| App connection (`apps/server/.env`) | `postgresql://…@localhost:5432/atlas_one` |
| Root `.env` (Docker-oriented) | `postgresql://…@postgres:5432/atlas_one` (hostname for in-compose use) |

The API in development connects to PostgreSQL on **localhost:5432**.

---

## 6. Does Docker work?

**Yes.**

| Check | Result |
|-------|--------|
| Docker Engine | v29.4.3 |
| Docker Compose | v5.1.3 |
| Running containers | `atlas_one_postgres`, `atlas_one_proxy`, `atlas_one_tunnel`, `atlas_evolution_api`, `atlas_evolution_postgres`, `atlas_evolution_redis` |

---

## 7. Does docker-compose.prod.yml start successfully?

**Not verified on this machine.**

| Check | Result |
|-------|--------|
| `docker compose -f docker-compose.prod.yml config` | Passes (syntax valid) |
| Containers named `atlas_prod_*` | **None running** |
| Active stack | `docker-compose.atlas-stack.yml` (dev/tunnel stack), not prod compose |

The production compose file exists and validates, but a full `docker compose -f docker-compose.prod.yml up` has **not** been confirmed successful in this environment.

---

## 8. Does the system require Redis?

**No — optional, but recommended in production when configured.**

| Mode | Behavior |
|------|----------|
| `REDIS_URL` unset | App runs; rate-limit uses in-memory; webhook queue runs inline |
| `REDIS_URL` set + `NODE_ENV=production` | `/api/ready` requires Redis to be reachable |
| Root `.env` | `REDIS_URL` is set (Docker hostname `redis`) |
| `apps/server/.env` | `REDIS_URL=redis://localhost:6379` |
| Running Redis container | `atlas_one_redis` is **not** in the current `docker ps` list (only `atlas_evolution_redis`) |

---

## 9. What external services are required?

| Service | Required? | Purpose |
|---------|-----------|---------|
| **PostgreSQL** | Yes | Application data |
| **Evolution API** (or **Meta WhatsApp Cloud API**) | Yes (for WhatsApp) | Send/receive messages, QR connect |
| **Public HTTPS domain** | Yes (production) | App URL, CORS, webhooks |
| **Redis** | Optional | Distributed rate limit, webhook queue |
| **SMS provider** (Twilio / webhook) | Required in production validation | 2FA / owner login |
| **Asaas / Stripe** | Optional | Billing subscriptions |
| **OpenAI / Groq** | Optional | Audio transcription |
| **Cloudflare / certbot** | Recommended | TLS for `atlasone.app.br` |

Current dev setup still references a **trycloudflare.com** tunnel URL in `apps/server/.env` for webhooks. Root `.env` targets **https://atlasone.app.br** (not yet deployed).

---

## 10. Can this project be deployed today on a VPS?

**Partially yes — not fully verified end-to-end.**

| Ready | Not ready / unverified |
|-------|-------------------------|
| `pnpm build` succeeds | No GitHub repo to clone on VPS |
| `docker-compose.prod.yml` + Dockerfiles exist | Prod compose not tested running here |
| `.env.production.example` + generator script exist | Domain `atlasone.app.br` DNS/VPS not confirmed |
| Prisma migrations present | Must copy project manually or init git first |
| Health endpoints implemented (`/api/health`, `/api/ready`) | Webhook URL still on trycloudflare in dev env |
| DEPLOY.md + TEST_SERVER_GO_LIVE.md documented | SMS provider not configured for strict production |

**Objective conclusion:** Deployment to a VPS is **feasible today** if the operator copies the project, configures `.env` with real secrets and domain, and runs `docker compose -f docker-compose.prod.yml up -d --build`. It is **not** a one-command deploy from GitHub, and production stack startup has **not** been validated on this machine.

---

## Summary table

| # | Question | Answer |
|---|----------|--------|
| 1 | GitHub? | No |
| 2 | GitHub URL? | None |
| 3 | Git configured? | No |
| 4 | Database? | PostgreSQL 16 + Prisma |
| 5 | DB location? | Docker `atlas_one_postgres` on localhost |
| 6 | Docker works? | Yes |
| 7 | prod compose starts? | Not verified (config valid; prod containers not running) |
| 8 | Redis required? | No (optional; required for `/api/ready` if `REDIS_URL` set in prod) |
| 9 | External services? | PostgreSQL, WhatsApp provider, HTTPS domain; optional Redis, SMS, billing |
| 10 | Deploy on VPS today? | Partially — manual copy + env setup; not clone-from-GitHub |
