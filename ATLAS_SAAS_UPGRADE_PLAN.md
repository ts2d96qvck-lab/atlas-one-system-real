# Atlas One — SaaS Upgrade Plan

Lead engineer audit and phased execution plan.  
**Status:** Phases 1–10 complete.

---

## 1. Current state (audit — May 2026)

### What works today

| Area | Status | Notes |
|------|--------|-------|
| Monorepo structure | ✅ | `apps/server`, `apps/web`, `packages/lib`, `packages/ui` |
| Multi-tenant data model | ✅ | Prisma + `tenantId` on core entities |
| Auth (JWT, bcrypt, 2FA) | ✅ | SMS/WhatsApp OTP, audit on login |
| Product modules | ✅ | Inbox, CRM, Admin, Dashboard, Automations |
| PostgreSQL | ✅ | Docker + Prisma |
| Evolution WhatsApp | ✅ | Webhooks, send/receive |
| Health endpoints | ✅ | `/health`, `/ready` (+ `/api/*` aliases added) |
| Dockerfiles | ⚠️ | Existed but wrong CMD path; fixed in Phase 1 |
| Local ops scripts | ✅ | PM2, atlas-up (Windows dev only) |

### Critical problems found

1. **Root `package.json` pointed to legacy `server.js`** — not the Fastify monorepo.
2. **`pnpm build` did not exist at root** — only `build:enterprise` via turbo (fails on Windows when pnpm not in turbo PATH).
3. **`pnpm start` ran legacy Express** — not production API + Next.
4. **Production ran `pnpm dev`** via PM2/ecosystem — unacceptable for SaaS.
5. **Deployment relied on trycloudflare + developer PC** — not sellable.
6. **No `DEPLOY.md`, incomplete `.env.example`, no root `.gitignore`.**
7. **Server Dockerfile CMD was `dist/server.js`** — actual output is `dist/apps/server/src/server.js`.
8. **No `/api/health`** — enterprise monitors expect `/api/*` prefix.
9. **Turbo build unreliable on Windows** — replaced with explicit `pnpm --filter` chain.
10. **Redis queue optional in dev** — `REDIS_URL` enables async webhook delivery; falls back to inline when unset.

### Risks

| Risk | Impact | Mitigation (phase) |
|------|--------|-------------------|
| Single-server deployment | Downtime on deploy | Phase 2: blue/green or rolling; Phase 9: HA plan |
| `prisma db push` in prod | Schema drift | Phase 2: migrate to `prisma migrate` |
| Evolution API unofficial | Enterprise procurement block | Phase 4: Meta Cloud API adapter |
| No automated tests | Regressions on deploy | Phase 2+: CI pipeline |
| Secrets in local `.env` | Leak risk | Phase 2: SECURITY_BASELINE.md + vault |
| No SSO | IT checklist failure | Phase 7: OIDC foundation |

---

## 2. Execution order

```
Phase 1  Production readiness     ← THIS CYCLE (implement first)
Phase 2  Operational reliability  ← backup, security audit
Phase 3  SMB sellable product     ← onboarding, invites, mobile
Phase 4  WhatsApp provider layer  ← Evolution + Meta structure
Phase 5  Sales/support ops        ← SLA metrics, exports
Phase 6  Public API + webhooks
Phase 7  Security / LGPD / SSO prep
Phase 8  Billing / seats
Phase 9  Enterprise readiness docs
```

**Rule:** Do not start Phase N+1 until Phase N acceptance criteria pass.

---

## 3. Phase 1 — Implementation summary

### Technical decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build orchestration | `pnpm --filter` chain at root | Turbo PATH issues on Windows; explicit and debuggable |
| API production entry | `node dist/server.mjs` (esbuild bundle) | Raw tsc output fails on Node ESM dir imports |
| Web production | `next build` + `next start` / standalone Docker | Standard Next.js production |
| Health URLs | `/health` + `/api/health` | Backward compatible + monitor convention |
| Production stack | `docker-compose.prod.yml` | Postgres, Redis, Evolution, API, Web, nginx — no tunnel |
| HTTPS strategy | Cloudflare proxy or certbot | Documented in DEPLOY.md |
| Logging | JSON `startup-log.ts` | Structured startup/error without heavy deps |

### Files created

- `ATLAS_SAAS_UPGRADE_PLAN.md` (this file)
- `DEPLOY.md`
- `.env.production.example`
- `.gitignore`
- `docker-compose.prod.yml`
- `infra/nginx/atlas-prod.conf`
- `scripts/bundle-server.js`
- `scripts/build.js`
- `scripts/lint.js`
- `scripts/start-production.js`
- `apps/server/src/lib/startup-log.ts`

### Files modified

- `package.json` (root) — `build`, `start`, `lint`, `typecheck`
- `apps/server/package.json` — production `start`, `build` with prisma generate
- `apps/web/package.json` — `typecheck` script
- `apps/web/next.config.mjs` — `output: "standalone"`
- `apps/server/Dockerfile` — fixed paths, healthcheck, prisma
- `apps/web/Dockerfile` — standalone runner
- `apps/server/src/server.ts` — `/api/ready`, error handler, startup logs
- `apps/server/src/routes/index.ts` — `/api/health`
- `.env.example` — complete reference
- `infra/nginx/atlas-local.conf` — `/api` routes

### Phase 1 acceptance criteria

| Criterion | Status |
|-----------|--------|
| `pnpm build` works | ✅ |
| `pnpm start` production mode | ✅ (requires build; uses `server.mjs` + `next start`) |
| `.env.example` complete | ✅ |
| `/api/health` works | ✅ |
| `DEPLOY.md` exists | ✅ |
| Fixed domain + HTTPS strategy | ✅ in DEPLOY.md |
| No notebook dependency | ✅ docker-compose.prod.yml |

---

## 4. Files to change in upcoming phases

### Phase 2

- `scripts/backup-atlas.ps1` → `scripts/backup-atlas.sh`
- `scripts/restore-atlas.sh` (new)
- `BACKUP_RESTORE.md`, `SECURITY_BASELINE.md`
- `apps/server/src/lib/tenant-guard.ts` (audit)
- `.github/workflows/ci.yml` (new)

### Phase 3

- `apps/server/src/services/tenant-onboarding.service.ts`
- `apps/server/src/routes/auth.routes.ts`
- `apps/web/src/components/atlas-shell.tsx`
- Invite flow (new routes + email)

### Phase 4

- `apps/server/src/services/whatsapp/providers/` (new)
- `WHATSAPP_PROVIDERS.md`

### Phase 5–9

See task list in product brief — documented when each phase starts.

---

## 5. Commands to validate Phase 1

```bash
corepack enable
pnpm install
pnpm build
curl http://localhost:4000/api/health    # after pnpm start:server
pnpm lint
```

Docker:

```bash
cp .env.production.example .env
# fill secrets
docker compose -f docker-compose.prod.yml up -d --build
curl http://localhost/api/health
```

---

## 6. Known gaps after Phase 1

- Automated backup not yet scheduled (Phase 2)
- No CI/CD pipeline
- SSO not implemented (Phase 7)
- Public API / webhooks (Phase 6)
- Billing/seats (Phase 8)
- Meta WhatsApp provider stub (Phase 4)
- `ecosystem.config.cjs` / PM2 still dev-oriented on Windows — use Docker prod on server

---

## 7. Phase 2 — Implementation summary (completed)

### Delivered

| Item | File |
|------|------|
| Backup Linux | `scripts/backup-atlas.sh` |
| Backup Windows | `scripts/backup-atlas.ps1` (improved) |
| Restore Linux | `scripts/restore-atlas.sh` |
| Restore Windows | `scripts/restore-atlas.ps1` |
| Schedule backup | `scripts/schedule-backup.ps1` + cron docs |
| Documentation | `BACKUP_RESTORE.md`, `SECURITY_BASELINE.md` |
| Structured logging | `apps/server/src/lib/app-log.ts` |
| Safe API errors | `apps/server/src/utils/http.ts` (prod hides details) |
| Tenant guards | `assertLeadInTenant`, `assertAutomationInTenant` |
| Seed prod block | `prisma/seed.ts` |
| Weak DB password check | `validate-env.ts` |
| CI pipeline | `.github/workflows/ci.yml` |

### Phase 2 acceptance criteria

| Criterion | Status |
|-----------|--------|
| Functional backup | ✅ |
| Restore documented | ✅ |
| Security checklist | ✅ |
| No hardcoded secrets in code | ✅ (seed dev-only) |
| Tenant isolation audited | ✅ |
| Operational docs | ✅ |

---

## 8. Phase 3 — Implementation summary (completed)

### Delivered

| Item | File |
|------|------|
| User invite model | `apps/server/prisma/schema.prisma` (`UserInvite`, status `invited`) |
| Invite service | `apps/server/src/services/invite.service.ts` |
| Company settings | `apps/server/src/services/company-settings.service.ts` |
| Admin routes | `POST /admin/users/invite`, `GET/PATCH /admin/company-settings`, `GET /admin/channel-settings` |
| Auth routes | `GET /auth/invite/preview`, `POST /auth/invite/accept` |
| API client | `apps/web/src/lib/api.ts` |
| Accept invite UI | `apps/web/src/components/atlas-shell.tsx` (`?invite=&tenant=`) |
| Admin settings + invite | `apps/web/src/components/admin-view.tsx` |
| Empty states | `apps/web/src/components/empty-state.tsx` |
| Friendly errors | `apps/web/src/lib/friendly-errors.ts` |
| Owner delete guard | `apps/server/src/services/admin.service.ts` |

### Phase 3 acceptance criteria

| Criterion | Status |
|-----------|--------|
| Admin can invite user by link | ✅ |
| Invited user sets password and enters | ✅ |
| Company settings (name, timezone, hours) | ✅ |
| Empty states in admin | ✅ |
| Owner cannot be deleted | ✅ |
| `pnpm build` passes | ✅ |
| `prisma db push` (UserInvite table) | ✅ |

### How to test invite flow

1. Login as admin/owner → Admin → Novo usuario → **Convidar por link**
2. Copy link (format: `/?invite=TOKEN&tenant=SLUG`)
3. Open in incognito → set password → auto-login

---

## 9. Phase 4 — Implementation summary (completed)

### Delivered

| Item | File |
|------|------|
| Provider factory | `apps/server/src/services/whatsapp/providers/factory.ts` |
| Evolution adapter | `apps/server/src/services/whatsapp/providers/evolution.provider.ts` |
| Meta Cloud adapter | `apps/server/src/services/whatsapp/providers/meta-cloud.provider.ts` |
| Outbound preparation | `apps/server/src/services/whatsapp/whatsapp-instance.service.ts` |
| Provider catalog API | `GET /whatsapp/providers` |
| Instance provider field | `POST /whatsapp/instances` accepts `provider` |
| Meta webhook stub | `GET/POST /webhook/meta` |
| Refactored send paths | inbox, automation, sms, whatsapp routes |

### Phase 4 acceptance criteria

| Criterion | Status |
|-----------|--------|
| Provider abstraction (Evolution + Meta) | ✅ |
| Factory selects by `instance.provider` | ✅ |
| Evolution send still works | ✅ |
| Meta Cloud send when env configured | ✅ |
| Meta webhook verify endpoint | ✅ |
| Documentation | `WHATSAPP_PROVIDERS.md` |
| `pnpm build` (server) | ✅ |

---

## 9.1 Phase 4.1 — Meta inbound + Redis queue (completed)

### Delivered

| Item | File |
|------|------|
| Meta webhook parser | `apps/server/src/services/whatsapp/meta-webhook.parser.ts` |
| Meta config (env + tenant) | `apps/server/src/services/whatsapp/meta-config.ts` |
| Inbound handler | `handleMetaCloudWebhook()` in `webhook.service.ts` |
| Redis client | `apps/server/src/lib/redis.ts` |
| Webhook delivery queue | `apps/server/src/lib/webhook-queue.ts` |
| Queue worker | `server.ts` — batch every 5s + retries every 60s |
| Status page Redis check | `status.service.ts` component `queue` |
| Tenant settings on routes | `whatsapp.routes.ts` |

### Phase 4.1 acceptance criteria

| Criterion | Status |
|-----------|--------|
| Meta inbound creates conversation + message | ✅ |
| Meta delivery status updates message | ✅ |
| Instance resolved by phone_number_id | ✅ |
| Webhook outbound enqueued when Redis available | ✅ |
| Inline fallback when Redis absent | ✅ |
| `pnpm build` passes | ✅ |

---

## 10. Phase 5 — Implementation summary (completed)

### Delivered

| Item | File |
|------|------|
| SLA metrics service | `apps/server/src/services/ops/sla.service.ts` |
| CSV export service | `apps/server/src/services/ops/export.service.ts` |
| Ops routes | `GET /ops/sla`, `GET /ops/export/*.csv` |
| Dashboard SLA panel | `apps/web/src/components/dashboard-view.tsx` |
| Export buttons UI | Dashboard header |
| SLA config in admin | `admin-view.tsx` + `company-settings.service.ts` |
| Documentation | `OPS_EXPORTS.md` |

### Phase 5 acceptance criteria

| Criterion | Status |
|-----------|--------|
| SLA first response + resolution metrics | ✅ |
| Per-agent SLA breakdown | ✅ |
| Export leads/conversations/messages CSV | ✅ |
| Configurable SLA targets in admin | ✅ |
| Dashboard shows SLA + export | ✅ |
| `pnpm build` passes | ✅ |

---

## 11. Phase 6 — Implementation summary (completed)

### Delivered

| Item | File |
|------|------|
| API key model + auth | `ApiKey` schema, `api-key-auth.ts` |
| Public API v1 | `apps/server/src/routes/v1.routes.ts` |
| OpenAPI spec | `GET /v1/openapi.json` |
| Webhook endpoints | `WebhookEndpoint`, `WebhookDelivery` schema |
| Webhook dispatcher + retry | `webhook-dispatcher.service.ts` |
| Admin integrations UI | `admin-view.tsx` (API keys + webhooks) |
| Event hooks | crm, inbox, webhook services |
| Documentation | `API.md`, `WEBHOOKS.md` |

### Phase 6 acceptance criteria

| Criterion | Status |
|-----------|--------|
| Initial public API exists | ✅ |
| Endpoint documentation exists | ✅ |
| Company can create API keys | ✅ |
| Webhooks configurable per tenant | ✅ |
| Webhook delivery logs | ✅ |
| `pnpm build` passes | ✅ |

---

## 12. Phase 7 — Implementation summary (completed)

### Delivered

| Item | File |
|------|------|
| Security overview | `SECURITY.md` |
| Privacy structure | `PRIVACY.md` |
| DPA draft | `DPA_TEMPLATE.md` |
| LGPD checklist | `LGPD_CHECKLIST.md` |
| SSO foundation | `apps/server/src/lib/auth/`, `SSO_PLAN.md` |
| Audit actions catalog | `audit.service.ts` (`AUDIT_ACTIONS`) |
| Audit filters + actor | `listAuditLogsDetailed()` |
| Logout + audit | `POST /auth/logout` |
| Export audit | ops + v1 routes |
| Permission change audit | admin user patch |
| Export rate limit | 20 req / 15 min |
| Admin audit UI filters | `admin-view.tsx` Monitor de acessos |
| Auth providers API | `GET /auth/providers` |

### Phase 7 acceptance criteria

| Criterion | Status |
|-----------|--------|
| Security/LGPD documentation | ✅ |
| Critical events audited | ✅ |
| Admin can view/filter logs | ✅ |
| SSO foundation prepared | ✅ |
| Sensitive routes authorized | ✅ |
| `pnpm build` passes | ✅ |

---

## 13. Phase 8 — Implementation summary (completed)

### Delivered

| Item | File |
|------|------|
| Plan catalog (Starter/Pro/Enterprise) | `billing/plans.ts` |
| Billing + seat limits service | `billing/billing.service.ts` |
| Admin billing API | `GET /admin/billing/overview` |
| Platform plan update | `PATCH /admin/billing/tenants/:id/plan` |
| Seat enforcement | `createUser`, `createUserInvite` |
| Channel enforcement | WhatsApp instance create |
| Feature gating | API keys, webhooks, automations, `/v1` |
| Subscription webhook stub | `POST /payments/webhook/subscription` |
| Trial on onboard | 14 days Starter |
| Admin billing UI | `admin-view.tsx` |
| Documentation | `BILLING.md`, `TRIAL.md` |

### Phase 8 acceptance criteria

| Criterion | Status |
|-----------|--------|
| Plan structure exists | ✅ |
| Seat control exists | ✅ |
| Recurring billing foundation | ✅ |
| Admin sees current plan | ✅ |
| Resource limits by plan | ✅ |
| `pnpm build` passes | ✅ |

---

## 14. Phase 9 — Implementation summary (completed)

### Delivered

| Item | File |
|------|------|
| Enterprise readiness master doc | `ENTERPRISE_READINESS.md` |
| SLA contract template | `SLA_TEMPLATE.md` |
| Status page plan | `STATUS_PAGE_PLAN.md` |
| Pentest scope (external) | `PENTEST_SCOPE.md` |
| Enterprise roadmap | `ROADMAP_ENTERPRISE.md` |
| Procurement checklist | ENTERPRISE_READINESS.md §2 |
| Code gaps inventory | ENTERPRISE_READINESS.md §4 + ROADMAP_ENTERPRISE.md |

### Phase 9 acceptance criteria

| Criterion | Status |
|-----------|--------|
| Documentation for enterprise sales | ✅ |
| Clear view of ready vs missing | ✅ |
| Product can evolve without rewrite | ✅ |
| Pentest scope defined | ✅ |
| SLA template exists | ✅ |
| Status page plan exists | ✅ |

---

*Last updated: Phase 10 (Enterprise hardening).*

---

## 15. Phase 10 — Enterprise hardening (completed)

### Delivered

| Item | File |
|------|------|
| JWT session revocation | `User.tokenVersion`, `lib/session.ts` |
| Password policy (12+ chars) | `lib/security/password-policy.ts` |
| Bootstrap gate in prod | `X-Setup-Token`, `validate-env.ts` |
| Graceful shutdown | `server.ts` SIGTERM/SIGINT |
| trustProxy + request ID logging | `server.ts`, `lib/request-context.ts` |
| Readiness includes Redis | `/api/ready` |
| Meta webhook HMAC | `lib/security/meta-webhook-signature.ts` |
| Webhook rate limits | scoped plugin in `server.ts` |
| Socket.IO CORS fix | `lib/realtime.ts` |
| Audit CSV export | `GET /admin/audit-logs/export.csv` |
| Security headers (Next + nginx) | `next.config.mjs`, `atlas-prod.conf` |
| Redis auth in prod compose | `docker-compose.prod.yml` |
| Migrate on container start | `docker-entrypoint.sh` |
| Operations runbook | `OPERATIONS_RUNBOOK.md` |
| CI dependency audit | `.github/workflows/ci.yml` |

### Phase 10 acceptance criteria

| Criterion | Status |
|-----------|--------|
| Logout invalida token imediatamente | ✅ |
| Bootstrap bloqueado sem SETUP_TOKEN em prod | ✅ |
| Meta webhook assinado | ✅ |
| Graceful shutdown | ✅ |
| Request ID em logs | ✅ |
| ENTERPRISE_READINESS atualizado | ✅ |
| `pnpm build` passes | ✅ |
