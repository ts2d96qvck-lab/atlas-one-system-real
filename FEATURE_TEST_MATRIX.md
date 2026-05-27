# Feature Test Matrix — Atlas One

**Last run:** 2026-05-25 (final) | Legend: PASS | PARTIAL | FAIL | BLOCKED | EXT

| Area | Feature | Route/API | Role | Test Type | Status | Notes |
|------|---------|-----------|------|-----------|--------|-------|
| Public | App login shell | `/` | Public | E2E | PASS | Not a marketing landing |
| Public | Landing page | `/landing` | Public | Manual | FAIL | Does not exist |
| Public | Pricing page | `/pricing` | Public | E2E | **PASS** | Fixed QA-001 |
| Public | Terms page | `/terms` | Public | E2E | **PASS** | Fixed QA-001 |
| Public | Privacy page | `/privacy` | Public | E2E | **PASS** | Fixed QA-001 |
| Public | Status page | `/status` | Public | E2E | PASS | |
| Auth | Login valid | POST `/auth/login` | Agent | API | PASS | demo + QA users |
| Auth | Login invalid | POST `/auth/login` | Public | E2E | PASS | 401 |
| Auth | Owner 2FA prod | POST `/auth/login` | Owner | API | PARTIAL | Works with QA_BYPASS_2FA dev only |
| Auth | Logout revoke | POST `/auth/logout` | Any | E2E | PASS | tokenVersion increment |
| Auth | Bootstrap tenant | POST `/auth/bootstrap-owner` | Public | API | PASS | Needs X-Setup-Token |
| Auth | SSO OIDC | GET `/auth/oidc/:provider/start` | Public | Manual | EXT | Needs Google/Microsoft creds |
| Tenant | QA test customer | `atlas-test-customer` | — | Seed | PASS | scripts/seed-first-customer-test-data.ts |
| RBAC | Agent → admin blocked | GET `/admin/users` | Agent | API | PASS | 403 |
| RBAC | Agent → billing blocked | GET `/admin/billing/overview` | Agent | API | PASS | 403 |
| RBAC | Admin → billing | GET `/admin/billing/overview` | Admin | API | PASS | QA tenant pro |
| RBAC | Supervisor → SLA | GET `/ops/sla` | Supervisor | API | PASS | QA tenant |
| Inbox | List conversations | GET `/inbox/conversations` | Agent | API | PASS | |
| Inbox | Transfer assignment | PATCH `/inbox/conversations/:id` | Supervisor | API | PARTIAL | API exists; UI not E2E |
| CRM | List leads | GET `/crm/leads` | Agent | API | PASS | 10 leads |
| CRM | Pipeline | GET `/crm/pipeline` | Agent | API | PARTIAL | Not fully exercised |
| Dashboard | Supervisor dashboard | Client view | Supervisor | Manual | PARTIAL | API ops OK |
| Reports | SLA metrics | GET `/ops/sla` | Supervisor | API | PASS | |
| Reports | CSV export | GET `/ops/export/leads.csv` | Admin | API | **PASS** | |
| Integrations | API keys | POST `/admin/integrations/api-keys` | Admin | API | **PASS** | |
| Integrations | Public API v1 | GET `/v1/leads` | API key | API | **PASS** | |
| Integrations | Webhooks outbound | POST webhook endpoint | Admin | Manual | PARTIAL | Not dispatch tested |
| Billing | Plans | GET `/admin/billing/plans` | Admin | API | PASS | starter/pro/enterprise |
| Billing | Seat limits | POST `/admin/users` | Admin | Manual | PARTIAL | Logic exists; limit not hit |
| Billing | Subscription webhook | POST `/payments/webhook/subscription` | Webhook | API | PASS | |
| Billing | Asaas checkout | POST `/admin/billing/checkout` | Admin | EXT | No ASAAS_API_KEY tested |
| WhatsApp | Evolution connect | POST `/whatsapp/instances/.../connect` | Admin | EXT | Evolution online in final QA |
| WhatsApp | Inbound webhook | POST `/webhook/evolution/:slug` | Webhook | API | PARTIAL | Not full message E2E |
| WhatsApp | Meta Cloud | POST `/webhook/meta` | Webhook | Manual | EXT | No Meta app creds |
| Security | Unauth API | GET `/inbox/*` | Public | E2E | PASS | 401 |
| Security | Rate limit auth | POST `/auth/login` burst | Public | E2E | PASS | Bypass in dev QA only |
| Security | Audit logs | GET `/admin/audit-logs` | Admin | API | **PASS** | |
| Security | Audit CSV export | GET `/admin/audit-logs/export.csv` | Admin | API | **PASS** | |
| Ops | Health | GET `/api/health` | Public | E2E | PASS | |
| Ops | Readiness | GET `/api/ready` | Public | E2E | PASS | redis=false local |
| Ops | Docker compose | docker-compose.prod.yml | — | Manual | BLOCKED | POSTGRES_PASSWORD missing |
| Ops | Backup/restore | BACKUP_RESTORE.md | — | Manual | NOT TESTED | Documented only |
| UI | Mobile responsive | Client SPA | All | Manual | NOT TESTED | |
| UI | Empty states | Inbox/CRM | Agent | Manual | NOT TESTED | |

**Summary:** 28 PASS · 10 PARTIAL · 1 FAIL · 1 BLOCKED · 4 EXT
