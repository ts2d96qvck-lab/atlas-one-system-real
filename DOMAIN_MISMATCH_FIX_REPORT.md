# Domain Mismatch Fix Report

**Date:** 2026-05-27  
**Scope:** Align production domain references to `app.atlasone.app.br` (real zone: `atlasone.app.br`)

---

## Problem

Production configs and docs used **`app.atlasone.com.br`** (old/wrong TLD) while the active production intent is:

| Role | Domain |
|------|--------|
| Real domain (zone) | `atlasone.app.br` |
| App / API / webhooks | `app.atlasone.app.br` |

This caused nginx, Docker defaults, env templates, and deploy docs to disagree with the generated `.env`.

---

## Domain mapping applied

| Old value | New value |
|-----------|-----------|
| `app.atlasone.com.br` | `app.atlasone.app.br` |
| `*.atlasone.com.br` | `*.atlasone.app.br` |
| `atlasone.com.br` (apex in prod tunnel scripts) | `atlasone.app.br` |
| `status.atlasone.com.br` (status page docs) | `status.atlasone.app.br` |
| `https://atlasone.app.br` (root `.env` app URLs) | `https://app.atlasone.app.br` |
| `app.seudominio.com.br` (`.env.production.example` placeholders) | `app.atlasone.app.br` |

**Not changed (intentionally):**

- `localhost`, `127.0.0.1`, `app.atlasone.local.gd`, trycloudflare URLs
- `infra/nginx/atlas-local.conf` (local dev nginx)
- Demo/support **email** addresses (`demo@atlasone.com.br`, `admin@atlasone.com.br`, etc.)
- Historical audit reports (`DEPLOYMENT_BLOCKERS_REPORT.md`, `DOCKER_BUILD_FIX_REPORT.md`)

---

## Files changed

| File | Change |
|------|--------|
| `infra/nginx/atlas-prod.conf` | `server_name app.atlasone.app.br *.atlasone.app.br` |
| `docker-compose.prod.yml` | Default `NEXT_PUBLIC_*` → `https://app.atlasone.app.br` |
| `apps/web/Dockerfile` | Build ARG defaults → `app.atlasone.app.br` |
| `.env.production.example` | All production URL examples → `app.atlasone.app.br` |
| `.env.example` | Production URL section → `app.atlasone.app.br` |
| `.env` | Active prod URLs aligned to `app.atlasone.app.br` |
| `infra/cloudflared/config.yml` | `app.atlasone.app.br`, apex `atlasone.app.br` |
| `scripts/configurar-dominio-fixo.ps1` | Domain + Cloudflare/tunnel hostnames |
| `configurar-dominio-fixo.ps1` | Comment updated |
| `apps/server/src/lib/security/validate-env.ts` | CORS example string only |
| `DEPLOY.md` | All production domain examples |
| `API.md` | Production base URL examples |
| `BACKUP_RESTORE.md` | Health check URL |
| `PAYMENTS.md` | Webhook URL example |
| `SSO_PLAN.md` | OIDC redirect example |
| `SLA_TEMPLATE.md` | Monitor URL |
| `STATUS_PAGE_PLAN.md` | App + status subdomain examples |

---

## Commands run

```powershell
cd C:\Users\vinic\Downloads\atlas-one-system-real\atlas-one-system-real

docker compose -f docker-compose.prod.yml config --quiet
node scripts/validate-docker-compose.mjs
docker compose -f docker-compose.prod.yml config | Select-String atlasone
```

---

## Final result

| Check | Result |
|-------|--------|
| `docker compose -f docker-compose.prod.yml config` | **PASS** |
| `node scripts/validate-docker-compose.mjs` | **PASS** (`status: PASS`, 13 services) |
| Remaining `app.atlasone.com.br` in prod paths | **None** (only local dev nginx + old audit docs) |

Compose now resolves defaults such as:

- `NEXT_PUBLIC_API_URL=https://app.atlasone.app.br`
- `NEXT_PUBLIC_WS_URL=https://app.atlasone.app.br`

---

## Remaining risks

| Risk | Notes |
|------|-------|
| **DNS not verified live** | `app.atlasone.app.br` A/CNAME must point to VPS or Cloudflare before go-live |
| **TLS not configured in compose** | Still requires Cloudflare Full (strict) or certbot on port 443 |
| **Rebuild web image if baked URLs matter** | Re-run `docker compose -f docker-compose.prod.yml build atlas-web` after changing `NEXT_PUBLIC_*` defaults |
| **Regenerate `.env` on server** | Run `node scripts/generate-staging-env.mjs app.atlasone.app.br` on VPS if starting fresh |
| **Local dev nginx** | `atlas-local.conf` still lists old `.com.br` names for local testing only |
| **Demo emails unchanged** | `demo@atlasone.com.br` in seed/tests is separate from hostname config |

---

## Summary

Production hostname references are now aligned on **`https://app.atlasone.app.br`** across nginx, Docker prod defaults, env templates, active `.env`, and deploy/ops documentation. No deploy was performed.
