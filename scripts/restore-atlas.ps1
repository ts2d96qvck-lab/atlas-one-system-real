# Restore Atlas One from backup directory — DESTRUCTIVE
param(
  [Parameter(Mandatory = $true)][string]$BackupDir
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot | Split-Path -Parent
$target = if (Test-Path $BackupDir) { $BackupDir } else { Join-Path $root $BackupDir }

if (!(Test-Path (Join-Path $target "database.dump"))) {
  throw "database.dump not found in $target"
}

$docker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
$pgContainer = if ($env:ATLAS_PG_CONTAINER) { $env:ATLAS_PG_CONTAINER } else { "atlas_prod_postgres" }
$apiContainer = if ($env:ATLAS_API_CONTAINER) { $env:ATLAS_API_CONTAINER } else { "atlas_prod_api" }
$pgUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "atlas" }
$pgDb = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "atlas_one" }

Write-Host "WARNING: restore will REPLACE $pgDb. Waiting 5 seconds..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

& $docker cp (Join-Path $target "database.dump") "${pgContainer}:/tmp/restore.dump"
& $docker exec $pgContainer pg_restore -U $pgUser -d $pgDb -c --if-exists /tmp/restore.dump
& $docker exec $pgContainer rm -f /tmp/restore.dump
Write-Host "[restore] database OK" -ForegroundColor Green

$uploadsBackup = Join-Path $target "uploads"
if (Test-Path $uploadsBackup) {
  & $docker cp "$uploadsBackup/." "${apiContainer}:/app/uploads/" 2>$null
  if ($LASTEXITCODE -ne 0) {
    Copy-Item -Recurse -Force $uploadsBackup (Join-Path $root "apps\server\uploads")
  }
  Write-Host "[restore] uploads OK" -ForegroundColor Green
}

Write-Host "[restore] completed from $target" -ForegroundColor Green
