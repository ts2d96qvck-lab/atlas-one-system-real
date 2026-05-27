# Atlas One - dominio fixo comercial: https://app.atlasone.app.br
$ErrorActionPreference = "Continue"
$root = $PSScriptRoot | Split-Path -Parent
$domain = "app.atlasone.app.br"
$publicUrl = "https://$domain"
$tunnelName = "atlas-one"
$cfDir = Join-Path $root "infra\cloudflared"
$urlFile = Join-Path $root "acesso-publico.url"
$publicLib = Join-Path $root "scripts\lib\acesso-publico.ps1"
. $publicLib

function Get-CloudflaredPath {
  $candidates = @(
    "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe",
    "$env:ProgramFiles\Cloudflare\cloudflared\cloudflared.exe",
    (Get-Command cloudflared -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)
  ) | Where-Object { $_ -and (Test-Path $_) }
  return $candidates | Select-Object -First 1
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  ATLAS ONE - DOMINIO FIXO COMERCIAL" -ForegroundColor Cyan
Write-Host "  $publicUrl" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

$cf = Get-CloudflaredPath
if (!$cf) {
  Write-Host "Instalando cloudflared..." -ForegroundColor Yellow
  winget install Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements | Out-Null
  $cf = Get-CloudflaredPath
}
if (!$cf) {
  Write-Host "[FALHA] cloudflared nao encontrado." -ForegroundColor Red
  exit 1
}

New-Item -ItemType Directory -Force -Path $cfDir | Out-Null
$userCf = Join-Path $env:USERPROFILE ".cloudflared"
$certFile = Join-Path $userCf "cert.pem"

if (!(Test-Path $certFile)) {
  Write-Host "Passo 1/5 - Login Cloudflare (abre o navegador)..." -ForegroundColor Yellow
  Write-Host "Selecione o dominio atlasone.app.br na tela do Cloudflare." -ForegroundColor Gray
  Start-Process $cf -ArgumentList "tunnel","login" -Wait
}

if (!(Test-Path $certFile)) {
  Write-Host "[FALHA] Login Cloudflare nao concluido." -ForegroundColor Red
  Write-Host "Execute novamente e autorize no navegador." -ForegroundColor Yellow
  exit 1
}
Write-Host "[OK] Login Cloudflare" -ForegroundColor Green

Write-Host "Passo 2/5 - Criando tunel '$tunnelName'..." -ForegroundColor Gray
$credDest = Join-Path $cfDir "$tunnelName.json"
if (!(Test-Path $credDest)) {
  $createOut = & $cf tunnel create $tunnelName 2>&1 | Out-String
  Write-Host $createOut
  $credSource = Get-ChildItem $userCf -Filter "*.json" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne "config.json" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($credSource) {
    Copy-Item $credSource.FullName $credDest -Force
  }
}

if (!(Test-Path $credDest)) {
  Write-Host "[FALHA] Credenciais do tunel nao encontradas em $cfDir" -ForegroundColor Red
  exit 1
}
Write-Host "[OK] Tunel criado" -ForegroundColor Green

Write-Host "Passo 3/5 - DNS ($domain)..." -ForegroundColor Gray
$dnsOut = & $cf tunnel route dns $tunnelName $domain 2>&1 | Out-String
Write-Host $dnsOut
if ($dnsOut -match "already exists|Added CNAME|Successfully") {
  Write-Host "[OK] DNS configurado no Cloudflare" -ForegroundColor Green
} else {
  $tunnelId = ""
  $listOut = & $cf tunnel list 2>&1 | Out-String
  if ($listOut -match "$tunnelName\s+([0-9a-f-]{36})") {
    $tunnelId = $Matches[1]
  }
  Write-Host "[AVISO] Configure DNS manualmente se o dominio nao estiver no Cloudflare:" -ForegroundColor Yellow
  if ($tunnelId) {
    Write-Host "  CNAME app -> $tunnelId.cfargotunnel.com" -ForegroundColor White
  } else {
    Write-Host "  CNAME app -> <tunnel-id>.cfargotunnel.com" -ForegroundColor White
  }
}

$configPath = Join-Path $cfDir "config.yml"
@"
tunnel: $tunnelName
credentials-file: /etc/cloudflared/$tunnelName.json

ingress:
  - hostname: $domain
    service: http://host.docker.internal:80
  - hostname: atlasone.app.br
    service: http://host.docker.internal:80
  - service: http_status:404
"@ | Set-Content -Path $configPath -Encoding UTF8

Write-Host "Passo 4/5 - Subindo tunel fixo..." -ForegroundColor Gray
$docker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
if (!(Test-Path $docker)) {
  Write-Host "[FALHA] Docker necessario." -ForegroundColor Red
  exit 1
}

& $docker rm -f atlas_one_tunnel 2>$null | Out-Null
Push-Location $root
& $docker compose -f "docker-compose.tunnel-fixo.yml" up -d
Pop-Location
Start-Sleep -Seconds 5

Write-Host "Passo 5/5 - Atualizando sistema..." -ForegroundColor Gray
Set-Content -Path $urlFile -Value $publicUrl -Encoding UTF8
Update-PublicUrlInEnv -Root $root -PublicUrl $publicUrl
Sync-EvolutionWebhook -Root $root -PublicUrl $publicUrl | Out-Null

& $docker exec atlas_one_proxy nginx -s reload 2>$null | Out-Null

$online = $false
for ($i = 1; $i -le 30; $i++) {
  try {
    $code = (Invoke-WebRequest -Uri $publicUrl -UseBasicParsing -TimeoutSec 15).StatusCode
    if ($code -ge 200 -and $code -lt 500) { $online = $true; break }
  } catch { Start-Sleep -Seconds 4 }
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  LINK COMERCIAL FIXO" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  $publicUrl" -ForegroundColor Cyan
Write-Host ""

if ($online) {
  Write-Host "[OK] Dominio respondendo online." -ForegroundColor Green
  try { Set-Clipboard -Value $publicUrl } catch {}
  Start-Process $publicUrl
} else {
  Write-Host "[AVISO] DNS pode levar ate 10 minutos para propagar." -ForegroundColor Yellow
  Write-Host "Enquanto isso use: .\apresentar-atlas.ps1 (link temporario HTTPS)" -ForegroundColor Yellow
}

Write-Host ""
