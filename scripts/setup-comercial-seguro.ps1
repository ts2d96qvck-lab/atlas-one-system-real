# Atlas One - modo comercial enterprise (seguranca maxima)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot | Split-Path -Parent

function New-RandomSecret([int]$bytes = 32) {
  $buffer = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return [Convert]::ToBase64String($buffer).Replace("+", "x").Replace("/", "y").Replace("=", "")
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Atlas One - Setup Comercial Seguro" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$jwt = New-RandomSecret 48
$webhook = New-RandomSecret 32
$payments = New-RandomSecret 32
$setup = New-RandomSecret 24

$serverEnv = Join-Path $root "apps\server\.env"
$rootEnv = Join-Path $root ".env"
$webEnv = Join-Path $root "apps\web\.env.local"

$evolutionKey = ""
if (Test-Path $serverEnv) {
  $existing = Get-Content $serverEnv -Raw
  if ($existing -match 'EVOLUTION_API_KEY=(.+)') { $evolutionKey = $Matches[1].Trim() }
}
if (!$evolutionKey) { $evolutionKey = New-RandomSecret 48 }

$serverContent = @"
DATABASE_URL=postgresql://atlas:atlas@localhost:5432/atlas_one
REDIS_URL=redis://localhost:6379
JWT_SECRET=$jwt
EVOLUTION_URL=http://localhost:8080
EVOLUTION_API_KEY=$evolutionKey
EVOLUTION_DEFAULT_INSTANCE=atlas-one-comercial
WEBHOOK_PUBLIC_URL=http://app.atlasone.local.gd
WEBHOOK_SECRET=$webhook
PAYMENTS_WEBHOOK_SECRET=$payments
PLATFORM_ADMIN_EMAILS=viniciusseverino0688@icloud.com
CORS_ORIGINS=http://app.atlasone.local.gd
SETUP_TOKEN=$setup
ALLOW_PUBLIC_BOOTSTRAP=false
ATLAS_ENTERPRISE_MODE=true
ATLAS_ALLOW_LOCAL_SMS=true
SMS_PROVIDER=console
PORT=4000
"@

$rootContent = @"
DATABASE_URL=postgresql://atlas:atlas@localhost:5432/atlas_one
REDIS_URL=redis://localhost:6379
JWT_SECRET=$jwt
EVOLUTION_URL=http://localhost:8080
EVOLUTION_API_KEY=$evolutionKey
WEBHOOK_PUBLIC_URL=http://app.atlasone.local.gd
WEBHOOK_SECRET=$webhook
PAYMENTS_WEBHOOK_SECRET=$payments
"@

$webContent = @"
NEXT_PUBLIC_API_URL=http://app.atlasone.local.gd
NEXT_PUBLIC_WS_URL=http://app.atlasone.local.gd
NEXT_PUBLIC_ATLAS_ENTERPRISE_MODE=true
"@

Set-Content -Path $serverEnv -Value $serverContent -Encoding UTF8
Set-Content -Path $rootEnv -Value $rootContent -Encoding UTF8
Set-Content -Path $webEnv -Value $webContent -Encoding UTF8

Write-Host "[OK] Segredos gerados e salvos em apps/server/.env" -ForegroundColor Green
Write-Host "[OK] Modo enterprise ativado (ATLAS_ENTERPRISE_MODE=true)" -ForegroundColor Green
Write-Host "[OK] Cadastro publico desabilitado" -ForegroundColor Green
Write-Host "[OK] Webhooks protegidos por segredo" -ForegroundColor Green
Write-Host ""
Write-Host "SMS local: codigos aparecem no terminal da API (servidor)." -ForegroundColor Yellow
Write-Host "Producao: configure SMS_PROVIDER=twilio no .env" -ForegroundColor Yellow
Write-Host ""

# Backup diario
$backupScript = Join-Path $root "scripts\backup-atlas.ps1"
$taskName = "AtlasOneBackupDiario"
try {
  schtasks /Query /TN $taskName 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    schtasks /Create /TN $taskName /TR "powershell -ExecutionPolicy Bypass -File `"$backupScript`"" /SC DAILY /ST 02:00 /F 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Write-Host "[OK] Backup diario agendado as 02:00" -ForegroundColor Green
    } else {
      Write-Host "[AVISO] Agende manualmente: scripts\backup-atlas.ps1" -ForegroundColor Yellow
    }
  } else {
    Write-Host "[OK] Backup diario ja agendado" -ForegroundColor Green
  }
} catch {
  Write-Host "[AVISO] Agende manualmente: scripts\backup-atlas.ps1" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Iniciando ambiente completo..." -ForegroundColor Cyan
& (Join-Path $root "start-atlas-completo.ps1")
