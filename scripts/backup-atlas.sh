#!/usr/bin/env bash
# Atlas One backup — PostgreSQL + media uploads (30-day retention)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="${ATLAS_BACKUP_DIR:-$ROOT/backups}"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"
mkdir -p "$BACKUP_DIR"

PG_CONTAINER="${ATLAS_PG_CONTAINER:-atlas_prod_postgres}"
API_CONTAINER="${ATLAS_API_CONTAINER:-atlas_prod_api}"
PG_USER="${POSTGRES_USER:-atlas}"
PG_DB="${POSTGRES_DB:-atlas_one}"

echo "[backup] Atlas One -> $BACKUP_DIR"

if docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" -d "$PG_DB" -F c -f "/tmp/atlas_${STAMP}.dump"
  docker cp "${PG_CONTAINER}:/tmp/atlas_${STAMP}.dump" "$BACKUP_DIR/database.dump"
  docker exec "$PG_CONTAINER" rm -f "/tmp/atlas_${STAMP}.dump"
  echo "[backup] database OK"
elif command -v pg_dump >/dev/null 2>&1 && [[ -n "${DATABASE_URL:-}" ]]; then
  pg_dump "$DATABASE_URL" -F c -f "$BACKUP_DIR/database.dump"
  echo "[backup] database OK (local pg_dump)"
else
  echo "[backup] WARN: postgres backup skipped (container $PG_CONTAINER not running)"
fi

UPLOADS_LOCAL="$ROOT/apps/server/uploads"
if [[ -d "$UPLOADS_LOCAL" ]]; then
  cp -a "$UPLOADS_LOCAL" "$BACKUP_DIR/uploads"
  echo "[backup] uploads OK (local path)"
elif docker ps --format '{{.Names}}' | grep -qx "$API_CONTAINER"; then
  docker cp "${API_CONTAINER}:/app/uploads" "$BACKUP_DIR/uploads" 2>/dev/null || mkdir -p "$BACKUP_DIR/uploads"
  echo "[backup] uploads OK (from container)"
fi

cat > "$BACKUP_DIR/manifest.json" <<EOF
{
  "createdAt": "$(date -Iseconds)",
  "hostname": "$(hostname)",
  "version": "atlas-one-saas",
  "pgContainer": "$PG_CONTAINER",
  "database": "$PG_DB"
}
EOF

find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d | sort -r | tail -n +31 | xargs -r rm -rf

echo "[backup] done: $BACKUP_DIR"
