# Atlas AI V1.1 — Premium Product Feature Pass

## 1. Architecture summary

Atlas AI V1.1 keeps the V1 foundation (provider abstraction, tenant-scoped service, centralized PT-BR prompts, usage logging, `ai:use` + domain permissions) and adds **feature-specific structured outputs** with a **public API shape** that never exposes provider/model to the web client.

```
┌─────────────────────────────────────────────────────────────────┐
│  Web (V5 + atlas-ai-* panels)                                    │
│  Inbox │ CRM │ Campaigns │ Dashboard Ask │ Admin status badge   │
└────────────────────────────┬────────────────────────────────────┘
                             │ Bearer + permissions
┌────────────────────────────▼────────────────────────────────────┐
│  /ai/* routes (ai.routes.ts)                                     │
│  Zod validation → atlas-ai.service → prompts.ts → provider       │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   OpenAI            OpenRouter              noop/fallback
        └────────────────────┴────────────────────┘
                             │
                    AtlasAiUsageLog (Prisma)
```

**Inbox:** summary, suggested reply (6 tones), next action, transfer summary, message polish (6 modes).  
**CRM:** lead summary, close probability, next task, win/loss insight.  
**Campaigns:** improve message, variations (6 modes), compliance advisory.  
**Dashboard:** Ask Atlas — uses real dashboard metrics + open conversation count; labels “análise inicial” when data is thin; never invents numbers.  
**Admin:** lightweight `AdminAiStatus` calling `GET /ai/status` (configured vs awaiting server keys).

Friendly errors via `ai-errors.ts`; JSON parse fallbacks in service; context clipping and hidden-message sanitation unchanged from V1 hardening.

## 2. Files changed (V1.1 scope)

### Backend
| Path | Role |
|------|------|
| `apps/server/src/routes/ai.routes.ts` | All AI HTTP endpoints |
| `apps/server/src/services/ai/atlas-ai.service.ts` | Orchestration, context, `toPublicAiResponse` |
| `apps/server/src/services/ai/prompts.ts` | PT-BR JSON prompt templates |
| `apps/server/src/services/ai/ai-errors.ts` | User-safe errors + log categories |
| `apps/server/src/services/ai/ai.provider.ts` | Provider interface |
| `apps/server/src/services/ai/create-ai-provider.ts` | Factory |
| `apps/server/src/services/ai/openai-chat.provider.ts` | OpenAI |
| `apps/server/src/services/ai/openrouter-chat.provider.ts` | OpenRouter |
| `apps/server/src/services/ai/ai-usage-log.service.ts` | Usage logging |
| `apps/server/src/routes/index.ts` | Registers `/ai` |
| `apps/server/src/config/env.ts` | AI env vars |
| `apps/server/prisma/schema.prisma` | `AtlasAiUsageLog` |
| `apps/server/prisma/migrations/20260603180000_atlas_ai_usage_log/` | Migration |

### Frontend
| Path | Role |
|------|------|
| `apps/web/src/lib/atlas-ai.ts` | API client, tones, polish modes |
| `apps/web/src/components/atlas-ai/atlas-ai-shared.tsx` | Shell, cards, pills, empty states |
| `apps/web/src/components/atlas-ai/atlas-ai-inbox-panel.tsx` | Inbox AI |
| `apps/web/src/components/atlas-ai/atlas-ai-crm-panel.tsx` | CRM AI |
| `apps/web/src/components/atlas-ai/atlas-ai-campaigns-panel.tsx` | Campaigns AI |
| `apps/web/src/components/atlas-ai/atlas-ai-ask-panel.tsx` | Dashboard Ask Atlas |
| `apps/web/src/components/admin-ai-status.tsx` | Admin readiness |
| `apps/web/src/app/globals.css` | `.atlas-ai-*` premium styles |
| `apps/web/src/components/conversation-drawer.tsx` | AI tab + composer hooks |
| `apps/web/src/components/crm-view.tsx` | CRM panel |
| `apps/web/src/components/campaigns-view.tsx` | Campaigns panel |
| `apps/web/src/components/dashboard-view.tsx` | Ask Atlas |
| `apps/web/src/components/admin-view.tsx` | Admin AI badge |
| `apps/web/src/components/atlas-app.tsx` | Composer draft to drawer |
| `apps/web/src/components/atlas-shell.tsx` | `user` prop wiring |

**Removed:** `apps/web/src/components/atlas-ai-panel.tsx` (superseded by domain panels; was breaking types).

### Docs / scripts
| Path | Role |
|------|------|
| `docs/ATLAS_AI_V1_ARCHITECTURE.md` | V1 baseline |
| `docs/ATLAS_AI_V1_IMPLEMENTATION_PLAN.md` | V1 plan |
| `docs/ATLAS_AI_V1.1_PREMIUM.md` | This deliverable |
| `scripts/capture-v11-ai-screenshots.mjs` | Playwright captures → `docs/qa-visual-v11/` |

## 3. Schema changed?

**No new migration for V1.1.** Uses existing `AtlasAiUsageLog` from V1 (`20260603180000_atlas_ai_usage_log`). Apply on deploy:

```bash
npm run db:push
# or migrate deploy in production
```

## 4. Environment variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI provider |
| `OPENROUTER_API_KEY` | OpenRouter provider |
| `ATLAS_AI_PROVIDER` | `openai` \| `openrouter` \| empty (auto) |
| `ATLAS_AI_MODEL` | Optional model override |
| `ATLAS_AI_APP_NAME` | OpenRouter HTTP-Referer title |
| `ATLAS_AI_APP_URL` | OpenRouter HTTP-Referer URL |

Without keys, `GET /ai/status` returns `configured: false` and UI shows the configuration empty state.

## 5. Screenshots path

Target directory: **`docs/qa-visual-v11/`**

Expected files (after running web on `:3001` + `node scripts/capture-v11-ai-screenshots.mjs` with `.qa-session.json`):

- `v11-inbox-ai-panel.png`
- `v11-inbox-tone-selector.png`
- `v11-crm-ai-card.png`
- `v11-campaigns-ai.png`
- `v11-dashboard-ask-atlas.png`

**Status:** Captures require a running stack and QA session; run locally before demo/commit if images are required in-repo.

## 6. Build results

| Command | Result |
|---------|--------|
| `npm run build:server` | OK |
| `npm run build:web` | OK |
| `npm run lint` | OK (`[lint] OK`) |

## 7. Lint result

All workspaces (`lib`, `ui`, `server`, `web`) pass `tsc --noEmit`.

## 8. Endpoint smoke (`GET /ai/status`)

Requires authenticated user with `ai:use`:

```http
GET /ai/status
Authorization: Bearer <token>
```

Response shape (public): `{ configured: boolean, message?: string }` — no provider name in payload.

Manual: `npm run test:smoke` or curl against running server on port 4000.

## 9. Risks

- **Provider cost/latency:** Long conversations clipped; very large contexts may still hit model limits.
- **Ask Atlas:** Answers depend on dashboard API freshness; thin tenants get “análise inicial” not full analytics.
- **CRM “Criar tarefa”:** Suggests task copy only — does not create CRM task entities yet.
- **Windows Prisma generate:** Occasional EPERM on `node_modules`; re-run `npm run db:generate` if client stale.
- **Mixed local changes:** Repo may contain unrelated modified files (security docs, webhook diagnostics); keep AI commit scoped.

## 10. Intentionally not done

- Push / deploy
- Billing, WhatsApp/Evolution changes
- Full AI analytics engine for Ask Atlas
- Persistent CRM task creation from AI
- Provider names in end-user UI
- Blocking campaign send on compliance warnings (advisory only)
- Raw JSON or provider errors in UI

## 11. Safe to commit?

**Yes**, for an Atlas AI V1.1-focused commit after you:

1. Exclude unrelated hunks (`SEGURANCA-ENTERPRISE.md`, webhook diagnostics, `.qa-session.json`, qa screenshot dirs unless desired).
2. Include migration + `schema.prisma` if not already on main.
3. Run `GET /ai/status` smoke with real keys in staging.
4. Capture `docs/qa-visual-v11/` if screenshots are part of your release checklist.

Suggested message:

```
feat(ai): Atlas AI V1.1 premium panels across inbox, CRM, campaigns and dashboard
```

## V1 endpoint compatibility

All V1 routes remain registered with the same paths; `suggested-reply` accepts optional `{ tone }`. New routes are additive only.
