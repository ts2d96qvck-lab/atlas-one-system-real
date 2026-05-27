# Full QA Test Plan — Atlas One

## Scope

Validate Atlas One as a **sellable SMB SaaS** — not just code completeness.

## Environments

| Env | URL | Purpose |
|-----|-----|---------|
| Local PM2 | localhost:4000 / :3001 | Primary QA (this run) |
| Production | Not deployed | BLOCKED |

## Phases executed

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Feature discovery → FEATURE_TEST_MATRIX.md | **Done** |
| 2 | Test data → scripts/seed-first-customer-test-data.ts | **Done** |
| 3 | Automated smoke → run-qa-api-smoke.mjs + Playwright | **Done** (15/15 + 24/24) |
| 4 | First customer E2E → FIRST_CUSTOMER_E2E_REPORT.md | **Done** |
| 5 | RBAC → API tests + rbac.spec.ts | **Done** |
| 6 | Billing → BILLING_QA_REPORT.md | Partial |
| 7 | WhatsApp → WHATSAPP_QA_REPORT.md | Partial |
| 8 | API/Webhooks → API_WEBHOOK_QA_REPORT.md | Partial (API key PASS) |
| 9 | Reports → REPORTS_QA_REPORT.md | Partial (CSV PASS) |
| 10 | UI/Mobile → UI_QA_REPORT.md | Partial (desktop public pages PASS) |
| 11 | Security → SECURITY_QA_REPORT.md | Partial |
| 12 | Ops → OPERATIONS_QA_REPORT.md | Partial |
| 13 | Bug fixing → QA-001, QA-005, QA-009 fixed | **Done** |
| 14 | Go-live decision → GO_LIVE_QA_DECISION.md | **Done** |

## Test customer

- **Tenant:** Atlas Test Customer (`atlas-test-customer`)
- **Plan:** Pro (maxUsers override 10)
- **Password:** `AtlasQA!2026Secure` (all QA users)
- **Users:** owner, admin, supervisor, agent1, agent2 @test.atlasone.local

## How to reproduce QA

```powershell
# 1. Start services (QA flags in ecosystem.config.cjs)
pm2 start ecosystem.config.cjs

# 2. Seed QA data
$env:NODE_ENV="development"
cd apps/server
corepack pnpm exec tsx ../../scripts/seed-first-customer-test-data.ts

# 3. API smoke
node scripts/run-qa-api-smoke.mjs

# 4. E2E
npx playwright test

# 5. Full QA
corepack pnpm test:qa
```

## Reset QA data

Re-run seed script (upserts). To delete tenant, see script header comments.

## Exit criteria for SMB go-live

- [x] Legal pages exist (pricing, terms, privacy)
- [x] Playwright 24/24 PASS
- [x] API smoke 15/15 PASS
- [ ] Owner login PASS in production config (without QA bypass)
- [ ] 1 payment flow validated (Asaas sandbox minimum)
- [ ] VPS deploy PASS
