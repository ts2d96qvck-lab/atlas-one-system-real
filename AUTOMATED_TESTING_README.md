# Automated Testing README

## Overview

Atlas One now includes:

| Layer | Tool | Location |
|-------|------|----------|
| API smoke | Node fetch script | `scripts/run-qa-api-smoke.mjs` |
| E2E API + web | Playwright | `tests/e2e/*.spec.ts` |
| QA seed | tsx + Prisma | `scripts/seed-first-customer-test-data.ts` |
| Unit tests | Vitest (configured, empty) | `apps/server` — no tests yet |

## Prerequisites

- `atlas-api` on port 4000
- `atlas-web` on port 3001
- PostgreSQL with seed or QA seed data

## Commands

```bash
# API smoke only
pnpm test:smoke

# Playwright E2E (install browsers first)
npx playwright install chromium
pnpm test:e2e

# Full QA suite
pnpm test:qa

# Seed QA tenant
cd apps/server && NODE_ENV=development pnpm exec tsx ../../scripts/seed-first-customer-test-data.ts
```

## Environment variables

| Var | Default | Purpose |
|-----|---------|---------|
| `QA_API_URL` | http://localhost:4000 | API base for tests |
| `QA_WEB_URL` | http://localhost:3001 | Web base for Playwright |

PM2 dev env (ecosystem.config.cjs) sets `QA_BYPASS_RATE_LIMIT=true` and `QA_BYPASS_2FA=true` on atlas-api for reliable automated login. **Never enable in production.**

## Test files

| File | Covers |
|------|--------|
| `global-setup.ts` | Prefetch auth tokens once |
| `smoke.spec.ts` | health, ready, 401, inbox |
| `production-readiness.spec.ts` | health, ready, 401 |
| `auth.spec.ts` | login, logout revoke |
| `rbac.spec.ts` | agent/admin/supervisor API |
| `public-pages.spec.ts` | /, /status, pricing, terms, privacy |
| `first-customer-flow.spec.ts` | onboarding API path |

## Known limitations

- Playwright uses `workers: 1` and globalSetup token cache
- Owner login in **production** requires real WhatsApp OTP (QA_BYPASS_2FA is dev-only)
- No UI login flow automated yet (SPA client-side auth)
- Mobile/empty states not covered

## CI recommendation

```yaml
- run: pnpm test:smoke
- run: npx playwright install chromium --with-deps
- run: pnpm test:e2e
```

Requires services container (postgres + api + web) in CI.
