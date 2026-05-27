# Atlas One - iniciar sistema completo (link oficial unico)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$appUrl = "http://app.atlasone.local.gd"

Write-Host ""
Write-Host "Atlas One - subindo ambiente..." -ForegroundColor Cyan

$docker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
if (Test-Path $docker) {
  & $docker compose -f (Join-Path $root "docker-compose.atlas-db.yml") up -d | Out-Null
  & $docker compose -f (Join-Path $root "docker-compose.local-domain.yml") up -d atlas-one-proxy | Out-Null
  Write-Host "Proxy oficial: $appUrl" -ForegroundColor Green
} else {
  Write-Host "Docker nao encontrado. Proxy local nao iniciado." -ForegroundColor Yellow
}

function Stop-Port($port) {
  $ids = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($id in $ids) {
    if ($id -gt 0) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
  }
}

Stop-Port 4000
Stop-Port 3001
Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\apps\server'; npx pnpm dev"
Start-Sleep -Seconds 3
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\apps\web'; npx pnpm dev"

Write-Host "Aguardando servicos..." -ForegroundColor Gray
$ready = $false
for ($i = 1; $i -le 30; $i++) {
  try {
    $health = Invoke-RestMethod -Uri "$appUrl/health" -TimeoutSec 3
    $web = Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec 3
    if ($health.ok -and $web.StatusCode -eq 200) {
      $ready = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 2
  }
}

Write-Host ""
if ($ready) {
  Write-Host "Atlas One pronto!" -ForegroundColor Green
  Write-Host "Acesse: $appUrl" -ForegroundColor Green
  Start-Process $appUrl
} else {
  Write-Host "Servicos iniciando. Abra em instantes: $appUrl" -ForegroundColor Yellow
  Start-Process $appUrl
}
