# Atlas One — Security Baseline

Minimum security posture for B2B SaaS operation. Use as internal checklist and starting point for customer IT reviews.

**Not a substitute for legal/compliance advice or formal pentest.**

---

## 1. Secrets & credentials

| Control | Status | Notes |
|---------|--------|-------|
| No secrets in git | ✅ | `.gitignore` covers `.env`, uploads, backups |
| JWT from env | ✅ | Dev fallback blocked in production (`validate-env.ts`) |
| Seed passwords dev-only | ✅ | `prisma/seed.ts` blocked when `NODE_ENV=production` |
| Webhook secrets required (prod) | ✅ | `WEBHOOK_SECRET`, `PAYMENTS_WEBHOOK_SECRET` |
| Weak secret detection | ✅ | Rejects `atlas-one-dev-secret`, `CHANGE_ME` |

**Action before production:**

```bash
# Generate secrets
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 24   # WEBHOOK_SECRET
```

Never commit `.env` or `apps/server/.env`.

---

## 2. Authentication & sessions

| Control | Implementation |
|---------|------------------|
| Password hashing | bcrypt (cost 12) |
| JWT expiry | 12 hours |
| Session validation | DB check on each request (`requireAuth`) |
| Blocked tenant | Rejected at auth middleware |
| Login rate limit | 30 req / 15 min on `/auth/*` |
| 2FA | Owner policy + optional user 2FA via SMS/WhatsApp |
| Failed login lockout | 5 failures / 15 min per user |

Production requirements:

- `SMS_PROVIDER` ≠ `console` (use `twilio` or `webhook`)
- `ALLOW_PUBLIC_BOOTSTRAP=false`

---

## 3. Multi-tenant isolation

All tenant-scoped data uses `tenantId` from authenticated session — **never from client body alone**.

| Layer | Mechanism |
|-------|-----------|
| API routes | `user.tenantId` from JWT + `requireAuth` |
| Services | Queries include `where: { tenantId }` |
| Cross-entity FK | `tenant-guard.ts` validates user/team/conversation/lead |
| Media | `/media/:tenantId/:file` — token required, tenant match |
| Webhooks | `/webhook/evolution/:tenantSlug` per company |
| Socket.IO | JWT + tenant room |

### Audited modules (tenant-safe)

- Inbox, CRM, Dashboard, Admin, Automations, WhatsApp routes
- Media routes (explicit tenant check)

### Hardening added (Phase 2)

- `assertLeadInTenant`, `assertAutomationInTenant` in `tenant-guard.ts`
- Production API errors hide internal details (`utils/http.ts`)

---

## 4. Network & transport

| Control | Requirement |
|---------|-------------|
| HTTPS | Mandatory in production (Cloudflare or certbot) |
| CORS | Explicit `CORS_ORIGINS` in production |
| Helmet | Enabled on Fastify |
| Rate limit | Global 300/min + auth-specific limits |

---

## 5. Logging & audit

| Event | Logged |
|-------|--------|
| Server startup / env validation | JSON `app-log` |
| 5xx errors | JSON `app-log` |
| Auth login success/fail/challenge/logout | `AuditLog` table |
| Password change / permissions change | `AuditLog` |
| Data export (CSV) | `AuditLog` action `data_export` |
| CRM/Inbox/Admin mutations | `auditLog()` service |
| Uncaught exceptions | Process handler + exit |

Admin UI: **Monitor de acessos** (Admin panel).

---

## 6. Backup & recovery

See [BACKUP_RESTORE.md](./BACKUP_RESTORE.md).

- Daily automated backup recommended
- Monthly restore test to staging

---

## 7. Dependency & CI

| Control | Status |
|---------|--------|
| CI build + lint | ✅ `.github/workflows/ci.yml` |
| Lockfile | `pnpm-lock.yaml` committed |

---

## 8. Production checklist (quick)

```
[ ] NODE_ENV=production
[ ] JWT_SECRET >= 32 chars random
[ ] DATABASE_URL uses strong password (not atlas/atlas)
[ ] HTTPS on fixed domain
[ ] ALLOW_PUBLIC_BOOTSTRAP=false
[ ] SMS_PROVIDER configured
[ ] Backup scheduled + offsite copy
[ ] /api/health monitored externally
[ ] Seed NOT run in production (unless ALLOW_SEED=true staging)
```

---

## 9. Known gaps (future phases)

| Item | Phase |
|------|-------|
| SSO rollout (Google/Microsoft UI) | 7.1 |
| Field-level encryption | 7+ |
| WAF / DDoS (Cloudflare rules) | Ops |
| Formal pentest report | 9 |
| SOC 2 / ISO 27001 | Enterprise roadmap |

**Completed since v1:** API keys (Phase 6), audit export events (Phase 7), SSO foundation (Phase 7).

See also: [SECURITY.md](./SECURITY.md), [LGPD_CHECKLIST.md](./LGPD_CHECKLIST.md), [SSO_PLAN.md](./SSO_PLAN.md).

---

*Atlas One — Security Baseline v2 (Phase 7)*
