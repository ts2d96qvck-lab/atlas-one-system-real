# Regression Test Report — Atlas One QA

**Baseline:** Phase 10 hardening + QA session 2026-05-25 (final)

| Area | Regression risk | Test | Result |
|------|-----------------|------|--------|
| Auth login | High | demo + QA agent login | **PASS** |
| Auth logout revoke | High | token after logout | **PASS** |
| RBAC agent | High | admin 403 | **PASS** |
| Health endpoints | Medium | /api/health, /ready | **PASS** |
| Public pages | Medium | /pricing, /terms, /privacy | **PASS** (new) |
| Webhook subscription | Medium | POST subscription webhook | **PASS** |
| API keys + v1 | Medium | create key + /v1/leads | **PASS** (new) |
| CSV exports | Low | leads.csv, audit.csv | **PASS** (new) |
| Build | High | pnpm build | **PASS** |
| Typecheck | Medium | pnpm lint | **PASS** |
| Playwright E2E | High | 24 tests | **PASS** 24/24 |
| API smoke | High | 15 checks | **PASS** 15/15 |

**Regressions found:** None in tested paths.  
**Fixes applied this session:** QA-001 (public pages), QA-005/009 (QA bypass flags + token cache).
