$ErrorActionPreference = "Stop"

$Project = Split-Path -Parent $MyInvocation.MyCommand.Path
$DockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
$Docker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"

Write-Host "Atlas One - iniciando ambiente real..." -ForegroundColor Cyan

if (!(Test-Path $Docker)) {
  throw "Docker nao encontrado. Instale o Docker Desktop antes de continuar."
}

if (Test-Path $DockerDesktop) {
  Start-Process -FilePath $DockerDesktop -ErrorAction SilentlyContinue
}

Write-Host "Aguardando Docker ficar online..."
$ready = $false
for ($i = 1; $i -le 60; $i++) {
  & $Docker info *> $null
  if ($LASTEXITCODE -eq 0) {
    $ready = $true
    break
  }
  Start-Sleep -Seconds 5
}

if (!$ready) {
  throw "Docker ainda nao ficou online. Abra o Docker Desktop e confira se ele terminou de iniciar."
}

Write-Host "Subindo Evolution API, Postgres e Redis..."
& $Docker compose -f (Join-Path $Project "docker-compose.evolution.yml") up -d

Write-Host "Subindo banco de dados proprio do Atlas One..."
& $Docker compose -f (Join-Path $Project "docker-compose.atlas-db.yml") up -d

Write-Host "Subindo dominio local premium..."
& $Docker compose -f (Join-Path $Project "docker-compose.local-domain.yml") up -d

Write-Host "Subindo link publico temporario..."
& $Docker compose -f (Join-Path $Project "docker-compose.public-tunnel.yml") up -d

Write-Host "Reiniciando Atlas One..."
$processes = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
  Where-Object {
    $_.CommandLine -like "*$Project*" -or
    $_.CommandLine -like "*npm-cli.js* run dev*" -or
    $_.CommandLine -like "*node  server.js*"
  }

$processes | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 2
Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory $Project -WindowStyle Hidden -RedirectStandardOutput (Join-Path $Project "atlas-one-dev.out.log") -RedirectStandardError (Join-Path $Project "atlas-one-dev.err.log")
Start-Process -FilePath "npx.cmd" -ArgumentList "pnpm@9.15.4 --filter @atlas-one/server start" -WorkingDirectory $Project -WindowStyle Hidden -RedirectStandardOutput (Join-Path $Project "atlas-enterprise-server.out.log") -RedirectStandardError (Join-Path $Project "atlas-enterprise-server.err.log")

Start-Sleep -Seconds 4
$health = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -TimeoutSec 10
$serverHealth = Invoke-RestMethod -Uri "http://localhost:4000/health" -TimeoutSec 10

Write-Host ""
Write-Host "Atlas One pronto em: http://app.atlasone.local.gd" -ForegroundColor Green
Write-Host "Backend: http://app.atlasone.local.gd/health ($($serverHealth.ok))" -ForegroundColor Green
Write-Host "Evolution API: $($health.whatsapp.apiUrl)" -ForegroundColor Green
Write-Host "Instancia padrao: $($health.whatsapp.defaultInstance)" -ForegroundColor Green

$tunnelLogs = & $Docker logs atlas_one_tunnel 2>&1
$publicUrl = ($tunnelLogs | Select-String -Pattern "https://[-a-z0-9]+\.trycloudflare\.com" | Select-Object -Last 1).Matches.Value
if ($publicUrl) {
  Write-Host "URL publica temporaria: $publicUrl" -ForegroundColor Yellow
}
