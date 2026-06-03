# Atlas One V5 — Unified Design System Audit

Visual-only pass. No backend, database, or business-logic changes.

## Reference bar

Linear · Stripe · Intercom · Apple HIG — calm hierarchy, glass surfaces, consistent density, one modal language.

## Before (V4.3 baseline)

| Area | Issue |
|------|--------|
| Inbox | Premium glass shell (`inbox-v42/43`), modern density |
| Dashboard / CRM / Admin / Campaigns / Automations | Mixed `border-white/70`, narrow `max-w-3xl/5xl`, flat white cards, ad-hoc modals |
| Shared primitives | `<Card>` without unified surface; headers per-module styles |

**Scores (QA visual, owner session):** Inbox ~7/10 · Product overall ~7/10 — modules felt like different products.

## Ten systems (V5)

| # | System | Implementation |
|---|--------|----------------|
| 1 | Cards | `.atlas-v5-card`, `.atlas-v5-card-pad`, `.atlas-v5-card-pad-sm`; `Card` primitive defaults to `atlas-v5-card` |
| 2 | Spacing | `--atlas-v5-gap-section`, `--atlas-v5-gap-card`; `.atlas-v5-stack`, `.atlas-v5-module-shell` |
| 3 | Typography | `.atlas-v5-kicker`, `.atlas-v5-title`, `.atlas-v5-subtitle` via `AtlasViewHeader` |
| 4 | Buttons | Existing `@atlas-one/ui` `Button` variants; primary utility `.atlas-v5-btn-primary` in CSS |
| 5 | Modals | `.atlas-v5-modal-backdrop`, `.atlas-v5-modal-panel` (CRM, Inbox modals) |
| 6 | Glass | `.atlas-v5-glass`, unified `.glass-panel` / `.atlas-glass` aliases |
| 7 | Color | Existing Atlas tokens; V5 surfaces use shared white/slate glass ramps |
| 8 | Shadows | `--atlas-v5-shadow-card`, `--atlas-v5-shadow-modal` |
| 9 | Empty states | `.atlas-v5-empty`, `.atlas-v5-empty-icon` in `EmptyState` |
| 10 | Tables / lists | `.atlas-v5-list-row`, `.atlas-v5-table-wrap`, menus `.atlas-v5-menu` |

## Files changed

- `apps/web/src/app/globals.css` — V5 tokens and utility classes
- `apps/web/src/lib/atlas-v5.ts` — class name constants
- `packages/ui/src/primitives/card.tsx` — base `atlas-v5-card`
- `apps/web/src/components/atlas-view-header.tsx`
- `apps/web/src/components/empty-state.tsx`
- `apps/web/src/components/atlas-app.tsx` — Inbox shell + modals
- `apps/web/src/components/dashboard-view.tsx`
- `apps/web/src/components/crm-view.tsx`
- `apps/web/src/components/admin-view.tsx`
- `apps/web/src/components/campaigns-view.tsx`
- `apps/web/src/components/automations-view.tsx`

## After

All six modules use `atlas-v5-module-shell` + `atlas-v5-stack` inside `atlas-page-inner` (full width). Section headers share `AtlasViewHeader`. Cards, modals, list rows, toolbar chips, and empty states pull from the same CSS layer as Inbox.

**Scores (post-V5 target):** Inbox ~8/10 · Product overall ~8.5/10 — single team, single product feel.

## Screenshots

See `docs/qa-visual-v5/` (desktop captures per module).

## Verification (2026-06-03)

| Check | Result |
|-------|--------|
| `build:packages` | OK |
| `build:web` | OK |
| `lint` | OK |

```bash
corepack pnpm run build:packages
corepack pnpm run build:web
corepack pnpm run lint
node scripts/capture-v5-screenshots.mjs
```
