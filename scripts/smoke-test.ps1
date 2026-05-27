# Smoke Test — Atlas One
# Valida se o sistema está pronto para uso

$ErrorActionPreference = "Continue"
$appUrl = "http://app.atlasone.local.gd"
$passed = 0
$failed = 0

function Test-Endpoint($name, $url, $expectJson) {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -ne 200) {
      Write-Host "[FALHA] $name — HTTP $($response.StatusCode)" -ForegroundColor Red
      $script:failed++
      return
    }
    if ($expectJson) {
      $json = $response.Content | ConvertFrom-Json
      if (-not $json.ok) {
        Write-Host "[FALHA] $name — ok=false" -ForegroundColor Red
        $script:failed++
        return
      }
    }
    Write-Host "[OK] $name" -ForegroundColor Green
    $script:passed++
  } catch {
    Write-Host "[FALHA] $name — $($_.Exception.Message)" -ForegroundColor Red
    $script:failed++
  }
}

Write-Host ""
Write-Host "Atlas One — Smoke Test" -ForegroundColor Cyan
Write-Host "URL: $appUrl" -ForegroundColor Gray
Write-Host ""

Test-Endpoint "Frontend (Web)" $appUrl $false
Test-Endpoint "API /health" "$appUrl/health" $true
Test-Endpoint "API /ready" "$appUrl/ready" $true
Test-Endpoint "Favicon" "$appUrl/favicon.svg" $false

Write-Host ""
if ($failed -eq 0) {
  Write-Host "Resultado: $passed/$($passed + $failed) testes passaram — SISTEMA PRONTO" -ForegroundColor Green
  exit 0
} else {
  Write-Host "Resultado: $passed passaram, $failed falharam — execute .\start-enterprise.ps1" -ForegroundColor Yellow
  exit 1
}
