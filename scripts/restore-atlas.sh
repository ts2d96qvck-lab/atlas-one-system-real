#!/usr/bin/env bash
# Atlas One restore — USE WITH CAUTION (overwrites current database)
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-directory>"
  echo "Example: $0 backups/20260525-120000"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$1"
if [[ ! -d "$BACKUP_DIR" ]]; then
  BACKUP_DIR="$ROOT/$1"
fi
if [[ ! -f "$BACKUP_DIR/database.dump" ]]; then
  echo "ERROR: database.dump not found in $BACKUP_DIR"
  exit 1
fi

PG_CONTAINER="${ATLAS_PG_CONTAINER:-atlas_prod_postgres}"
API_CONTAINER="${ATLAS_API_CONTAINER:-atlas_prod_api}"
PG_USER="${POSTGRES_USER:-atlas}"
PG_DB="${POSTGRES_DB:-atlas_one}"

echo "WARNING: This will REPLACE database $PG_DB. Continue in 5s (Ctrl+C to abort)..."
sleep 5

if docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  docker cp "$BACKUP_DIR/database.dump" "${PG_CONTAINER}:/tmp/restore.dump"
  docker exec "$PG_CONTAINER" pg_restore -U "$PG_USER" -d "$PG_DB" -c --if-exists /tmp/restore.dump
  docker exec "$PG_CONTAINER" rm -f /tmp/restore.dump
  echo "[restore] database OK"
else
  echo "ERROR: postgres container $PG_CONTAINER not running"
  exit 1
fi

if [[ -d "$BACKUP_DIR/uploads" ]]; then
  if docker ps --format '{{.Names}}' | grep -qx "$API_CONTAINER"; then
    docker cp "$BACKUP_DIR/uploads/." "${API_CONTAINER}:/app/uploads/"
    echo "[restore] uploads OK (container)"
  else
    mkdir -p "$ROOT/apps/server/uploads"
    cp -a "$BACKUP_DIR/uploads/." "$ROOT/apps/server/uploads/"
    echo "[restore] uploads OK (local path)"
  fi
fi

echo "[restore] completed from $BACKUP_DIR"
