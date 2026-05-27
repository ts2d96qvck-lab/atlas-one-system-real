# Billing QA Report

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1 | Plans starter/pro/enterprise exist | PASS | GET /admin/billing/plans |
| 2 | Tenant has plan (QA pro) | PASS | overview.plan.id=pro |
| 3 | Seat limit enforced | NOT TESTED | assertCanAddUser exists |
| 4 | Create user above limit | NOT TESTED | |
| 5 | Plan upgrade path | PARTIAL | checkout API + manual webhook |
| 6 | Plan downgrade | NOT TESTED | |
| 7 | Inactive subscription | PARTIAL | billingStatus logic in auth |
| 8 | Overdue/blocked | PARTIAL | blockedAt check on login |
| 9 | Manual activation | PASS | subscription webhook tested |
| 10 | Asaas webhook endpoint | NOT TESTED | POST /payments/webhook/asaas |
| 11 | Asaas payment mapping | EXT | No ASAAS_API_KEY |
| 12 | Sandbox/prod separation | EXT | |
| 13 | Webhook secret validation | PASS | subscription webhook with secret |
| 14 | Billing audit events | NOT TESTED | |

**Production payment:** EXTERNAL DEPENDENCY — Asaas not validated live.
