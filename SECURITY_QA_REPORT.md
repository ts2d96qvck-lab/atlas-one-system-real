# Security QA Report

**Date:** 2026-05-25 (updated)

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1 | Tenant A ≠ Tenant B data | NOT TESTED | Needs two tokens cross-try |
| 2 | API key tenant isolation | NOT TESTED | |
| 3 | Agent blocked admin | **PASS** | 403 on /admin/users |
| 4 | Unauth private API | **PASS** | 401 |
| 5 | Rate limits | **PASS** | QA_BYPASS_RATE_LIMIT for dev only |
| 6 | Audit logs on sensitive actions | **PASS** | 5+ entries visible |
| 7 | Logout revokes session | **PASS** | tokenVersion |
| 8 | Secrets in frontend bundle | NOT TESTED | |
| 9 | Stack traces in prod errors | PARTIAL | Generic message in prod |
| 10 | CORS | PARTIAL | Configured in env |
| 11 | Webhook signature Meta | NOT TESTED | |
| 12 | .env in gitignore | **PASS** | |
| 13 | Bootstrap SETUP_TOKEN | **PASS** | bootstrap without token blocked in prod mode |
| 14 | QA bypass flags prod-safe | **PASS** | QA_BYPASS_2FA disabled when NODE_ENV=production |

**Note:** `QA_BYPASS_2FA` and `QA_BYPASS_RATE_LIMIT` must never be set in production `.env`.
