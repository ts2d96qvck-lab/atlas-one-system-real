# Docker Build Fix Report

**Date:** 2026-05-27  
**Scope:** Production Docker image build failures only (no business/UI/WhatsApp/billing changes)

---

## What was broken

Production Docker builds failed because **pnpm workspace dependencies are hoisted to the repo root**, while Dockerfiles ran install/build steps as if binaries lived under each app’s local `node_modules`:

| Image | Error |
|-------|-------|
| `atlas-server` | `Cannot find module '/app/apps/server/node_modules/prisma/build/index.js'` |
| `atlas-web` | `Cannot find module '/app/apps/web/node_modules/next/dist/bin/next'` |

Root causes:

1. **`pnpm exec` / npm scripts from app subdirectories** resolved `prisma` and `next` under `apps/*/node_modules`, which do not exist in a hoisted monorepo layout.
2. **Split `deps` + `build` stages** ran `pnpm install` before copying source, then `COPY packages/*` conflicted with generated `node_modules` paths during web build.
3. **`prisma` was a devDependency** — unavailable in production-only installs and required at runtime for `prisma migrate deploy` in the entrypoint.
4. **No `.dockerignore`** — risk of copying host `node_modules` into the build context.

Local `pnpm build` worked because the host uses the normal pnpm workspace layout with correct bin shims from the repo root.

---

## Files changed

| File | Change |
|------|--------|
| `apps/server/Dockerfile` | Hoisted install + explicit root bin paths for Prisma/tsc/bundle |
| `apps/web/Dockerfile` | Copy source before install; hoisted install; run Next from root `node_modules` |
| `apps/server/package.json` | Moved `prisma` from `devDependencies` → `dependencies` (runtime migrations) |
| `pnpm-lock.yaml` | Updated after `prisma` dependency move |
| `.dockerignore` | Exclude `node_modules`, `.next`, secrets, artifacts from build context |

**Not changed:** application source, UI, WhatsApp, billing logic.

---

## Exact fix applied

### 1. `.dockerignore`
Exclude local `node_modules`, build outputs, env secrets, and artifacts from Docker context.

### 2. `node-linker=hoisted` in Docker builds
Written to `.npmrc` inside the image before `pnpm install` so binaries land in `/app/node_modules/.bin`.

### 3. Install workspace subset with pnpm filter
```dockerfile
ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile --filter @atlas-one/server...
# or --filter @atlas-one/web...
```

### 4. Copy source **before** install (single build stage)
Avoids overlay conflicts when copying `packages/ui` over paths created by a prior install layer.

### 5. Invoke CLIs from hoisted root bins (not app-level `pnpm exec`)
**Server:**
```dockerfile
RUN ./node_modules/.bin/prisma generate --schema=./apps/server/prisma/schema.prisma
RUN ./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit && node scripts/bundle-server.js
```

**Web:**
```dockerfile
WORKDIR /app/apps/web
RUN ../../node_modules/.bin/next build
```

### 6. Runtime `node_modules` from build stage
Server runner copies `/app/node_modules` from the **build** stage (includes generated Prisma client + Prisma CLI for entrypoint migrations).

### 7. `prisma` as production dependency
Ensures Prisma CLI is present for `docker-entrypoint.sh` → `npx prisma migrate deploy`.

---

## Commands run

```powershell
cd C:\Users\vinic\Downloads\atlas-one-system-real\atlas-one-system-real

# Update lockfile after prisma dependency move
corepack pnpm install

# Build custom production images
docker compose -f docker-compose.prod.yml build atlas-server atlas-web

# Full compose build (pull + custom images)
docker compose -f docker-compose.prod.yml build

# Validate rendered compose
docker compose -f docker-compose.prod.yml config --quiet

# Existing compose validator
node scripts/validate-docker-compose.mjs
```

---

## Final result

| Check | Result |
|-------|--------|
| `docker compose -f docker-compose.prod.yml build atlas-server` | **PASS** |
| `docker compose -f docker-compose.prod.yml build atlas-web` | **PASS** |
| `docker compose -f docker-compose.prod.yml build` | **PASS** |
| `docker compose -f docker-compose.prod.yml config` | **PASS** |
| `node scripts/validate-docker-compose.mjs` | **PASS** |

Built images:

| Image | Tag | Size |
|-------|-----|------|
| `atlas-one-system-real-atlas-server` | `latest` | ~1.44 GB |
| `atlas-one-system-real-atlas-web` | `latest` | ~225 MB |

---

## Remaining blockers (not in scope of this fix)

These were **not** addressed — VPS deploy was explicitly out of scope:

| Severity | Blocker |
|----------|---------|
| CRITICAL | No VPS provisioned |
| CRITICAL | No live DNS + HTTPS domain |
| HIGH | Domain mismatch: nginx `app.atlasone.com.br` vs `.env` `atlasone.app.br` |
| HIGH | `SMS_WEBHOOK_URL` empty for production 2FA |
| HIGH | `PLATFORM_ADMIN_EMAILS` placeholder in generated `.env` |
| MEDIUM | Prod stack `docker compose up` not yet run end-to-end on a server |
| MEDIUM | Port 443 not exposed in compose (use Cloudflare/certbot) |
| MEDIUM | Manual post-deploy: Evolution QR, webhook sync, owner bootstrap |

---

## Summary

Docker production **build** is fixed. The monorepo now installs and builds correctly inside Docker using hoisted pnpm layout and root-level CLI paths. Deploying to a VPS still requires infrastructure, secrets, and first-run operational steps listed above.
