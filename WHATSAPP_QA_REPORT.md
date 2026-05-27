# WhatsApp QA Report

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1 | Evolution env vars present | PASS | EVOLUTION_URL, EVOLUTION_API_KEY in .env |
| 2 | Channel config UI/API | PARTIAL | GET /whatsapp/instances |
| 3 | Tenant configure provider | PARTIAL | Instance seeded qa-comercial |
| 4 | Inbound message | EXT | Evolution offline during part of QA |
| 5 | Outbound message | EXT | Requires Evolution open instance |
| 6 | Tenant isolation on webhook | PARTIAL | /webhook/evolution/:tenantSlug |
| 7 | Conversation created from webhook | PARTIAL | atlas-one webhooks returned 200 |
| 8 | Queue assignment | PARTIAL | teamId on conversation |
| 9 | Agent reply | EXT | |
| 10 | Transfer keeps history | PARTIAL | PATCH conversation API |
| 11 | Error logging | NOT TESTED | |
| 12 | Disconnect/reconnect docs | PASS | WHATSAPP_PROVIDERS.md |
| 13 | Meta Cloud structure | PASS | parser + HMAC code exists |
| 14 | Meta Cloud production | EXT | No Meta app creds |

**Verdict:** WhatsApp **cannot be sold as fully operational** until Evolution 24/7 or Meta Cloud configured.
