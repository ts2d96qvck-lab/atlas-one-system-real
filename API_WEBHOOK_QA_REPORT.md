# API & Webhook QA Report

**Date:** 2026-05-25 (updated)

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1 | API key creation | **PASS** | POST `/admin/integrations/api-keys` → 201 |
| 2 | API key auth | **PASS** | GET `/v1/leads` with X-API-Key → 200 |
| 3 | API without key → fail | **PASS** | /v1/leads → 401 without key |
| 4 | Invalid key | NOT TESTED | |
| 5 | Valid key works | **PASS** | 10 leads returned |
| 6 | Tenant isolation | NOT TESTED | Needs cross-tenant key test |
| 7 | List leads v1 | **PASS** | |
| 8 | Create lead v1 | NOT TESTED | |
| 9 | List conversations v1 | NOT TESTED | |
| 10 | Export v1 | NOT TESTED | |
| 11 | Webhook endpoint create | NOT TESTED | |
| 12 | Webhook dispatch | NOT TESTED | Redis queue |
| 13 | Webhook retry | NOT TESTED | |
| 14 | Delivery logs | NOT TESTED | |
| 15 | Webhook HMAC outbound | PARTIAL | Code exists |
| 16 | Subscription webhook inbound | **PASS** | Tested live |

**Verdict:** Public API v1 **works for read** with API key. Outbound webhooks **not QA-validated** end-to-end.
