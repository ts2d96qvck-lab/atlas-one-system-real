# Validation Report — Atlas One QA

**Date:** 2026-05-26 (final)

| Command | Result |
|---------|--------|
| `corepack pnpm lint` | **PASS** |
| `corepack pnpm build` | **PASS** (11 routes incl. /apresentacao) |
| `node scripts/run-qa-api-smoke.mjs` | **16/16 PASS** |
| `node scripts/run-billing-smoke.mjs` | **PASS** (Asaas checkout manual/contact) |
| `node scripts/validate-docker-compose.mjs` | **PASS** (13 services) |
| `npx playwright test` | **35/35 PASS** |
| `npx playwright test tests/e2e/screenshots.spec.ts` | **3/3 PASS** |
| `node scripts/run-full-qa.mjs` | **8/8 PASS** |

## Extended API (via run-full-qa)

| Endpoint | Result |
|----------|--------|
| `GET /admin/teams` | **PASS** |
| `GET /admin/integrations/api-keys` | **PASS** |
| `GET /ops/export/leads.csv` | **PASS** |

## Screenshots comerciais

Salvos em `docs/screenshots/`:

- `screenshots-landing.png`
- `screenshots-apresentacao.png`
- `screenshots-pricing.png`

## Go-live decision

**YES, WITH CONDITIONS** — core product validated locally. Production VPS, Asaas real key, and owner OTP without QA bypass remain external.
