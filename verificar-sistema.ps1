# Atlas One - verificacao rapida de saude
$root = $PSScriptRoot
$appUrl = "http://127.0.0.1"
$publicUrlFile = Join-Path $root "acesso-publico.url"
$publicUrl = $null
if (Test-Path $publicUrlFile) {
  $publicUrl = (Get-Content $publicUrlFile -Raw -ErrorAction SilentlyContinue).Trim()
}
$ok = $true

Write-Host ""
Write-Host "Verificando Atlas One..." -ForegroundColor Cyan
Write-Host ""

function Test-Endpoint($name, $url) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 8
    Write-Host "[OK] $name ($($r.StatusCode))" -ForegroundColor Green
    return $true
  } catch {
    Write-Host "[FALHA] $name - $($_.Exception.Message)" -ForegroundColor Red
    return $false
  }
}

if (!(Test-Endpoint "Web" $appUrl)) { $ok = $false }
if (!(Test-Endpoint "API /health" "$appUrl/health")) { $ok = $false }
if (!(Test-Endpoint "API /ready" "$appUrl/ready")) { $ok = $false }

if ($publicUrl) {
  if (!(Test-Endpoint "HTTPS publico" $publicUrl)) { $ok = $false }
  if (!(Test-Endpoint "HTTPS /health" "$publicUrl/health")) { $ok = $false }
} else {
  Write-Host "[AVISO] Link publico nao gerado. Execute: .\apresentar-atlas.ps1" -ForegroundColor Yellow
}

try {
  Invoke-WebRequest -Uri "http://localhost:8080" -UseBasicParsing -TimeoutSec 5 | Out-Null
  Write-Host "[OK] Evolution API (:8080)" -ForegroundColor Green
} catch {
  Write-Host "[AVISO] Evolution API (:8080) offline" -ForegroundColor Yellow
}

try {
  docker ps --format "{{.Names}}" 2>&1 | Out-Null
  $containers = docker ps --format "{{.Names}}" 2>&1
  if ($containers -match "atlas_one_postgres") {
    Write-Host "[OK] PostgreSQL (Docker)" -ForegroundColor Green
  } else {
    Write-Host "[AVISO] PostgreSQL nao detectado" -ForegroundColor Yellow
  }
  if ($containers -match "atlas_one_proxy") {
    Write-Host "[OK] Proxy nginx (Docker)" -ForegroundColor Green
  } else {
    Write-Host "[AVISO] Proxy nginx nao detectado" -ForegroundColor Yellow
  }
} catch {
  Write-Host "[AVISO] Docker nao disponivel" -ForegroundColor Yellow
}

Write-Host ""
if ($ok) {
  Write-Host "Sistema operacional." -ForegroundColor Green
  if ($publicUrl) {
    Write-Host "Link comercial (envie ao cliente): $publicUrl" -ForegroundColor Cyan
  } else {
    Write-Host "Acesso local: $appUrl" -ForegroundColor Green
    Write-Host "Para link publico: .\apresentar-atlas.ps1" -ForegroundColor Yellow
  }
} else {
  Write-Host "Problemas detectados. Execute: .\start-atlas-completo.ps1" -ForegroundColor Red
}
Write-Host ""
