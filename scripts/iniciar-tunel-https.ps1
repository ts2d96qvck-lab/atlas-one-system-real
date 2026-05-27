# Cloudflare Tunnel - HTTPS publico para Atlas One (link comercial)
$ErrorActionPreference = "Continue"
$root = $PSScriptRoot | Split-Path -Parent
$urlFile = Join-Path $root "acesso-publico.url"
$logFile = Join-Path $root "logs\tunnel.log"
$lib = Join-Path $PSScriptRoot "lib\acesso-publico.ps1"

New-Item -ItemType Directory -Force -Path (Join-Path $root "logs") | Out-Null
. $lib

Write-Host ""
Write-Host "Iniciando tunel HTTPS (Cloudflare)..." -ForegroundColor Cyan

$docker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
if (!(Test-Path $docker)) {
  Write-Host "[FALHA] Docker necessario para o tunel HTTPS" -ForegroundColor Red
  exit 1
}

$existingUrl = $null
if (Test-Path $urlFile) {
  $existingUrl = (Get-Content $urlFile -Raw -ErrorAction SilentlyContinue).Trim()
}

$running = docker ps --format "{{.Names}}" 2>$null | Select-String -Pattern "atlas_one_tunnel" -Quiet
if ($running -and $existingUrl) {
  Write-Host "[OK] Tunel ja ativo" -ForegroundColor Green
  Update-PublicUrlInEnv -Root $root -PublicUrl $existingUrl
  Sync-EvolutionWebhook -Root $root -PublicUrl $existingUrl | Out-Null
  Write-Host ""
  Write-Host "URL PUBLICA HTTPS:" -ForegroundColor Green
  Write-Host "  $existingUrl" -ForegroundColor White
  return $existingUrl
}

& $docker rm -f atlas_one_tunnel 2>$null | Out-Null
Remove-Item $logFile -Force -ErrorAction SilentlyContinue

$job = Start-Job -ScriptBlock {
  param($dockerPath, $log)
  & $dockerPath run --rm --name atlas_one_tunnel cloudflare/cloudflared:latest `
    tunnel --no-autoupdate --url http://host.docker.internal:80 2>&1 |
    Tee-Object -FilePath $log
} -ArgumentList $docker, $logFile

$tunnelUrl = $null
for ($i = 1; $i -le 60; $i++) {
  Start-Sleep -Seconds 2
  if (Test-Path $logFile) {
    $content = Get-Content $logFile -Raw -ErrorAction SilentlyContinue
    if ($content -match '(https://[a-z0-9-]+\.trycloudflare\.com)') {
      $tunnelUrl = $Matches[1]
      break
    }
  }
}

if ($tunnelUrl) {
  Set-Content -Path $urlFile -Value $tunnelUrl -Encoding UTF8
  Update-PublicUrlInEnv -Root $root -PublicUrl $tunnelUrl
  $webhookOk = Sync-EvolutionWebhook -Root $root -PublicUrl $tunnelUrl
  Write-Host ""
  Write-Host "URL PUBLICA HTTPS:" -ForegroundColor Green
  Write-Host "  $tunnelUrl" -ForegroundColor White
  Write-Host ""
  Write-Host "Funciona em qualquer celular, notebook ou PC (internet)." -ForegroundColor Gray
  if ($webhookOk) {
    Write-Host "[OK] Webhook WhatsApp sincronizado com a URL publica." -ForegroundColor Green
  } else {
    Write-Host "[AVISO] Reinicie a API para aplicar WEBHOOK_PUBLIC_URL." -ForegroundColor Yellow
  }
} else {
  Write-Host "[AVISO] Tunel ainda iniciando. Veja: $logFile" -ForegroundColor Yellow
}

return $tunnelUrl
