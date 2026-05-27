# Atlas One - SOBE TUDO e mantem online
$ErrorActionPreference = "Continue"
$root = $PSScriptRoot | Split-Path -Parent
$docker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
$lib = Join-Path $PSScriptRoot "lib\acesso-publico.ps1"
$urlFile = Join-Path $root "acesso-publico.url"
$logDir = Join-Path $root "logs"

. $lib
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Write-Step($msg) { Write-Host "[Atlas] $msg" -ForegroundColor Cyan }

function Ensure-Docker {
  if (!(Test-Path $docker)) { throw "Docker Desktop nao instalado." }
  $desktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  if (Test-Path $desktop) { Start-Process $desktop -ErrorAction SilentlyContinue }
  for ($i = 1; $i -le 50; $i++) {
    & $docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { return }
    Start-Sleep -Seconds 3
  }
  throw "Docker nao ficou online. Abra o Docker Desktop manualmente."
}

function Ensure-Pm2 {
  $pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
  if ($pm2) { return $pm2.Source }
  Write-Step "Instalando PM2 (gerenciador de processos)..."
  npm install -g pm2 2>&1 | Out-Null
  return (Get-Command pm2 -ErrorAction SilentlyContinue).Source
}

function Start-NodeApps {
  $pm2Path = Ensure-Pm2
  if (!$pm2Path) { throw "Nao foi possivel instalar PM2." }

  # Libera portas se processos antigos (terminais fechados) ainda estiverem presos
  foreach ($port in @(4000, 3001)) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
      $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
      if ($proc -and $proc.ProcessName -eq "node") {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
      }
    }
  }

  Push-Location $root
  & $pm2Path resurrect 2>$null | Out-Null
  & $pm2Path delete atlas-api 2>$null | Out-Null
  & $pm2Path delete atlas-web 2>$null | Out-Null
  & $pm2Path start ecosystem.config.cjs 2>&1 | Out-String | Write-Host
  Start-Sleep -Seconds 5
  & $pm2Path save 2>$null | Out-Null
  Pop-Location

  $listOut = & $pm2Path list 2>&1 | Out-String
  if ($listOut -notmatch "online") {
    Write-Step "PM2 falhou - iniciando processos direto..."
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$root\scripts\run-api.cmd`"" -WindowStyle Hidden -WorkingDirectory $root
    Start-Sleep -Seconds 3
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$root\scripts\run-web.cmd`"" -WindowStyle Hidden -WorkingDirectory $root
  }
}

function Wait-Health {
  for ($i = 1; $i -le 60; $i++) {
    try {
      $h = Invoke-RestMethod -Uri "http://127.0.0.1/health" -TimeoutSec 5
      if ($h.ok) { return $true }
    } catch {}
    Start-Sleep -Seconds 3
  }
  return $false
}

function Get-TunnelUrl {
  for ($i = 1; $i -le 40; $i++) {
    try {
      $logs = & $docker logs atlas_one_tunnel 2>&1 | Out-String
      if ($logs -match '(https://[a-z0-9-]+\.trycloudflare\.com)') {
        return $Matches[1]
      }
    } catch {}
    Start-Sleep -Seconds 2
  }
  if (Test-Path $urlFile) {
    $old = (Get-Content $urlFile -Raw -ErrorAction SilentlyContinue).Trim()
    if ($old) { return $old }
  }
  return $null
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  ATLAS ONE - INICIANDO SISTEMA COMPLETO" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

try {
  Write-Step "Docker..."
  Ensure-Docker

  Write-Step "Host local (app.atlasone.local.gd)..."
  try { & (Join-Path $PSScriptRoot "configurar-hosts.ps1") } catch {
    Write-Host "  (hosts: execute como admin se quiser URL local bonita)" -ForegroundColor DarkGray
  }

  Write-Step "Banco, Evolution, Nginx, Tunel..."
  Push-Location $root
  & $docker compose -f "docker-compose.atlas-stack.yml" up -d 2>&1 | Out-Null
  Pop-Location

  Write-Step "Aguardando PostgreSQL..."
  for ($i = 1; $i -le 30; $i++) {
    & $docker exec atlas_one_postgres pg_isready -U atlas -d atlas_one 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 2
  }

  Write-Step "API + Web (PM2 - reinicia automatico)..."
  Start-NodeApps

  Write-Step "Aguardando site responder..."
  $ok = Wait-Health

  Write-Step "Link publico HTTPS..."
  Start-Sleep -Seconds 8
  $publicUrl = Get-TunnelUrl
  if ($publicUrl) {
    Set-Content -Path $urlFile -Value $publicUrl -Encoding UTF8
    Update-PublicUrlInEnv -Root $root -PublicUrl $publicUrl
    Sync-EvolutionWebhook -Root $root -PublicUrl $publicUrl | Out-Null
  }

  Write-Host ""
  Write-Host "============================================" -ForegroundColor Green
  if ($ok) {
    Write-Host "  SISTEMA ONLINE" -ForegroundColor Green
  } else {
    Write-Host "  PARCIAL - aguarde 30s e atualize a pagina" -ForegroundColor Yellow
  }
  Write-Host "============================================" -ForegroundColor Green
  Write-Host ""
  Write-Host "  Acesso neste PC:     http://127.0.0.1" -ForegroundColor White
  Write-Host "  Acesso local bonito: http://app.atlasone.local.gd" -ForegroundColor White
  $lanIp = (
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.PrefixOrigin -ne 'WellKnown' } |
      Select-Object -First 1 -ExpandProperty IPAddress
  )
  if ($lanIp) {
    Write-Host "  Outros PCs na rede:  http://$lanIp" -ForegroundColor Yellow
    Write-Host "  (nao use 127.0.0.1 em outro computador — use o IP acima)" -ForegroundColor DarkGray
    if (!$publicUrl) {
      Update-PublicUrlInEnv -Root $root -PublicUrl "http://$lanIp"
    }
  }
  if ($publicUrl) {
    Write-Host "  Link para clientes:  $publicUrl" -ForegroundColor Cyan
    try { Set-Clipboard -Value $publicUrl } catch {}
  }
  Write-Host ""
  Write-Host "  Demo: demo@atlasone.com.br / Atlas2026!" -ForegroundColor DarkGray
  Write-Host ""

  if ($ok -and $publicUrl) { Start-Process $publicUrl }
  elseif ($ok) { Start-Process "http://127.0.0.1" }
} catch {
  Write-Host "[ERRO] $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
