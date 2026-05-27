# Manual Testing Checklist — Atlas One

Use before first paying customer. Mark each after **actual** test.

## Public / Commercial
- [x] `/` loads login (desktop)
- [ ] `/` loads login (mobile 375px)
- [x] `/status` shows components
- [x] `/pricing` exists — **PASS**
- [x] `/terms` exists — **PASS**
- [x] `/privacy` exists — **PASS**

## Auth
- [x] Invalid login shows error
- [x] Demo agent login works (dev QA bypass)
- [ ] Owner login with 2FA OTP delivery (production config)
- [x] Logout invalidates session
- [ ] Password reset flow (SMS)

## Roles (QA tenant)
- [x] Admin → billing overview
- [x] Supervisor → SLA ops
- [x] Agent → inbox, blocked from admin
- [x] Owner → login (dev QA bypass)

## Inbox / CRM
- [x] List conversations
- [x] List leads (10)
- [ ] Send message (Evolution live E2E)
- [ ] Transfer conversation (UI)
- [ ] Close conversation

## Billing
- [x] Plans API returns starter/pro/enterprise
- [x] Subscription webhook updates status
- [ ] Asaas checkout button → payment URL
- [ ] Seat limit blocks 11th user

## Integrations
- [x] Create API key
- [x] Call /v1/leads with key
- [ ] Create webhook endpoint
- [ ] Receive webhook delivery

## Ops
- [x] /api/health
- [x] /api/ready
- [ ] Backup script run
- [ ] Restore dry-run

**Completed in QA run:** 18/35 · **Blocked:** 2 · **Not tested:** 15
