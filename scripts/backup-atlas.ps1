# Atlas One backup — PostgreSQL + uploads (retention 30 days)
# Works with local stack (atlas_one_postgres) and production (atlas_prod_postgres)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot | Split-Path -Parent
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = if ($env:ATLAS_BACKUP_DIR) { $env:ATLAS_BACKUP_DIR } else { Join-Path $root "backups" }
$backupDir = Join-Path $backupRoot $stamp
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$pgContainer = if ($env:ATLAS_PG_CONTAINER) { $env:ATLAS_PG_CONTAINER } else { "atlas_prod_postgres" }
$apiContainer = if ($env:ATLAS_API_CONTAINER) { $env:ATLAS_API_CONTAINER } else { "atlas_prod_api" }
$pgUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "atlas" }
$pgDb = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "atlas_one" }

Write-Host "[backup] Atlas One -> $backupDir" -ForegroundColor Cyan

$docker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
$pgNames = @($pgContainer, "atlas_one_postgres", "atlas-postgres-1")
$resolvedPg = $null

if (Test-Path $docker) {
  foreach ($name in $pgNames) {
    $running = & $docker ps --format "{{.Names}}" 2>$null | Select-String -Pattern "^$([regex]::Escape($name))$" -Quiet
    if ($running) { $resolvedPg = $name; break }
  }
}

if ($resolvedPg) {
  & $docker exec $resolvedPg pg_dump -U $pgUser -d $pgDb -F c -f "/tmp/atlas_$stamp.dump"
  & $docker cp "${resolvedPg}:/tmp/atlas_$stamp.dump" (Join-Path $backupDir "database.dump")
  & $docker exec $resolvedPg rm -f "/tmp/atlas_$stamp.dump"
  Write-Host "[backup] database OK ($resolvedPg)" -ForegroundColor Green
} else {
  Write-Host "[backup] WARN: postgres container not running" -ForegroundColor Yellow
}

$uploads = Join-Path $root "apps\server\uploads"
if (Test-Path $uploads) {
  Copy-Item -Recurse -Force $uploads (Join-Path $backupDir "uploads")
  Write-Host "[backup] uploads OK (local)" -ForegroundColor Green
} elseif (Test-Path $docker) {
  $apiNames = @($apiContainer, "atlas_prod_api", "atlas-api-1")
  foreach ($name in $apiNames) {
    $running = & $docker ps --format "{{.Names}}" 2>$null | Select-String -Pattern "^$([regex]::Escape($name))$" -Quiet
    if ($running) {
      & $docker cp "${name}:/app/uploads" (Join-Path $backupDir "uploads") 2>$null
      Write-Host "[backup] uploads OK ($name)" -ForegroundColor Green
      break
    }
  }
}

$meta = @{
  createdAt = (Get-Date).ToString("o")
  hostname  = $env:COMPUTERNAME
  version   = "atlas-one-saas"
  pgContainer = $resolvedPg
} | ConvertTo-Json
Set-Content -Path (Join-Path $backupDir "manifest.json") -Value $meta -Encoding UTF8

if (Test-Path $backupRoot) {
  Get-ChildItem $backupRoot -Directory | Sort-Object Name -Descending | Select-Object -Skip 30 | ForEach-Object {
    Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Write-Host ""
Write-Host "[backup] done: $backupDir" -ForegroundColor Green
