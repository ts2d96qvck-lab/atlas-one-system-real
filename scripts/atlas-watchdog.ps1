# Verifica a cada execucao se Atlas caiu e religa
$ErrorActionPreference = "Continue"
$root = $PSScriptRoot | Split-Path -Parent
$docker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
$logFile = Join-Path $root "logs\watchdog.log"

function Log($msg) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
  Add-Content -Path $logFile -Value $line -Encoding UTF8
}

$healthy = $false
try {
  $r = Invoke-RestMethod -Uri "http://127.0.0.1/health" -TimeoutSec 8
  $healthy = [bool]$r.ok
} catch {}

if ($healthy) { exit 0 }

Log "Sistema offline - reiniciando..."
& (Join-Path $root "scripts\atlas-up.ps1") *>&1 | Out-Null
Log "Reinicio concluido"
