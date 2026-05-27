# Adiciona app.atlasone.local.gd -> 127.0.0.1 no arquivo hosts
$ErrorActionPreference = "Stop"
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$entry = "127.0.0.1 app.atlasone.local.gd"
$content = Get-Content $hostsPath -Raw -ErrorAction Stop

if ($content -match "app\.atlasone\.local\.gd") {
  Write-Host "[OK] Host ja configurado: app.atlasone.local.gd" -ForegroundColor Green
  exit 0
}

Add-Content -Path $hostsPath -Value "`n$entry" -Encoding ASCII
Write-Host "[OK] Host configurado: http://app.atlasone.local.gd" -ForegroundColor Green
