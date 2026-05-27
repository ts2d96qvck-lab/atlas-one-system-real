# Bug Report — Atlas One QA

| ID | Severity | Area | Bug | Fix Status |
|----|----------|------|-----|------------|
| QA-001 | Critical | Commercial | No pricing/terms/privacy | **Fixed** |
| QA-002 | Critical | Auth | Owner login when Evolution offline | Partial — dev fallback |
| QA-003 | High | Auth | Owner forced 2FA in prod | By design — OTP real required |
| QA-004 | High | Ops | No production VPS | **Documented** — DEPLOY_FIRST_CUSTOMER.md |
| QA-005 | Medium | Auth | Rate limit breaks E2E | **Fixed** |
| QA-006 | Medium | Billing | Conversation quota not enforced | **Fixed** — assertWithinConversationQuota |
| QA-007 | Medium | Billing | Asaas checkout untested live | EXT — needs ASAAS_API_KEY |
| QA-008 | Low | Ops | Redis degraded without Redis | By design |
| QA-009 | Low | Smoke | requires2fa breaks smoke | **Fixed** — QA_BYPASS_2FA dev only |
| QA-010 | Low | Commercial | No /landing | **Fixed** |

**Open for production:** QA-004 (deploy), QA-007 (Asaas key), QA-003 (owner OTP in prod).
