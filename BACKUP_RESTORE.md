# Atlas One — Backup & Restore

Operational guide for database and media backups.

## What is backed up

| Item | Path / source |
|------|----------------|
| PostgreSQL | Full dump (`pg_dump -F c`) |
| Media files | `apps/server/uploads/` or Docker volume `/app/uploads` |
| Manifest | `manifest.json` (timestamp, hostname) |

Retention: **30 days** (older folders auto-deleted).

---

## Manual backup

### Linux / VPS (production)

```bash
chmod +x scripts/backup-atlas.sh scripts/restore-atlas.sh
./scripts/backup-atlas.sh
```

Output: `backups/YYYYMMDD-HHMMSS/`

Environment overrides:

```bash
export ATLAS_PG_CONTAINER=atlas_prod_postgres
export ATLAS_API_CONTAINER=atlas_prod_api
export ATLAS_BACKUP_DIR=/var/backups/atlas-one
./scripts/backup-atlas.sh
```

### Windows (local / dev)

```powershell
.\scripts\backup-atlas.ps1
```

---

## Automated backup

### Windows — Task Scheduler (daily 02:00)

```powershell
# Run as Administrator
.\scripts\schedule-backup.ps1
```

### Linux — cron

```bash
crontab -e
```

Add:

```cron
0 2 * * * cd /opt/atlas-one && ATLAS_BACKUP_DIR=/var/backups/atlas-one ./scripts/backup-atlas.sh >> /var/log/atlas-backup.log 2>&1
```

### Docker production (host cron)

Run backup script on the VPS host (not inside app container). Ensure Docker socket access and container names match `docker-compose.prod.yml`:

- Postgres: `atlas_prod_postgres`
- API: `atlas_prod_api`

---

## Restore

**Warning:** Restore **replaces** the current database. Stop traffic or put app in maintenance mode first.

### Linux

```bash
./scripts/restore-atlas.sh backups/20260525-020000
```

### Windows

```powershell
.\scripts\restore-atlas.ps1 -BackupDir backups\20260525-020000
```

### Verify after restore

```bash
curl -s https://app.atlasone.com.br/api/ready
docker compose -f docker-compose.prod.yml logs atlas-server --tail 50
```

---

## Offsite backup (recommended)

Copy `backups/` to external storage:

- AWS S3 / Azure Blob / Backblaze B2
- Encrypted disk on separate provider
- Minimum: weekly offsite copy

Example (S3):

```bash
aws s3 sync backups/ s3://your-bucket/atlas-one-backups/ --storage-class STANDARD_IA
```

---

## Restore test schedule

| Frequency | Action |
|-----------|--------|
| Monthly | Restore latest backup to staging DB and verify login + inbox |
| Quarterly | Full DR drill documented |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Container not found | Set `ATLAS_PG_CONTAINER` to running container name (`docker ps`) |
| Empty uploads folder | Ensure API container has media at `/app/uploads` |
| pg_restore errors | Use matching Postgres major version (16) |
| Permission denied | Run backup as user with Docker access |

---

## Acceptance criteria (Phase 2)

- [x] Functional backup script (sh + ps1)
- [x] Restore script documented and available
- [x] Automated routine documented (cron + Task Scheduler)
- [x] 30-day retention
