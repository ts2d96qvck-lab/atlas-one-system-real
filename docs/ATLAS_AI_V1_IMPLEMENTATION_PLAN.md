# Atlas AI V1 — Implementation plan

## Phase 1 — Foundation (this delivery)

- [x] Prisma `AtlasAiUsageLog` + migration SQL
- [x] Provider abstraction (`AiProvider`, OpenAI, OpenRouter, noop)
- [x] Centralized prompts (`prompts.ts`)
- [x] `atlas-ai.service.ts` — six features + context builders
- [x] `ai.routes.ts` — permissions + validation
- [x] Web `atlas-ai.ts` client + `AtlasAiPanel`
- [x] Inbox drawer tab **Atlas AI**
- [x] CRM edit modal panel
- [x] Campaigns create form panel

## Phase 2 — Operations (follow-up)

- [ ] Run migration on each environment: `pnpm db:push` or deploy migration
- [ ] Configure `OPENAI_API_KEY` or `OPENROUTER_API_KEY` on server
- [ ] Grant `ai:use` to roles in Admin → Usuários (owners already have `*`)
- [ ] Admin UI: add `ai:use` to permission picker list
- [ ] Optional: tenant-level AI enable flag in `Tenant.settings`
- [ ] Optional: monthly token budget per tenant

## Phase 3 — Product depth (later)

- [ ] Streaming responses in Inbox composer
- [ ] Automations AI assist
- [ ] Dashboard insights
- [ ] Usage report in Admin (aggregate `AtlasAiUsageLog`)
- [ ] Additional providers (Anthropic, Azure OpenAI) via same interface

## Deploy checklist

1. Apply DB migration `20260603180000_atlas_ai_usage_log`
2. Set env vars on API container
3. Deploy API + web (no push/deploy in this task)
4. Smoke: `GET /ai/status` with owner token
5. Smoke: summary on a conversation with messages

## Files changed (V1)

### Server

- `apps/server/prisma/schema.prisma`
- `apps/server/prisma/migrations/20260603180000_atlas_ai_usage_log/migration.sql`
- `apps/server/src/config/env.ts`
- `apps/server/src/routes/index.ts`
- `apps/server/src/routes/ai.routes.ts`
- `apps/server/src/services/ai/*` (provider, prompts, service, usage log)

### Web

- `apps/web/src/lib/atlas-ai.ts`
- `apps/web/src/components/atlas-ai-panel.tsx`
- `apps/web/src/components/conversation-drawer.tsx`
- `apps/web/src/components/atlas-app.tsx`
- `apps/web/src/components/crm-view.tsx`
- `apps/web/src/components/campaigns-view.tsx`
- `apps/web/src/components/atlas-shell.tsx`

### Docs

- `docs/ATLAS_AI_V1_ARCHITECTURE.md`
- `docs/ATLAS_AI_V1_IMPLEMENTATION_PLAN.md`
