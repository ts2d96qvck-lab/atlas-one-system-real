# Instala Atlas One para iniciar com o Windows e verificar a cada 5 minutos
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot | Split-Path -Parent
$upScript = Join-Path $root "scripts\atlas-up.ps1"
$watchScript = Join-Path $root "scripts\atlas-watchdog.ps1"

$actionUp = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$upScript`""
$triggerUp = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "AtlasOne-Iniciar" -Action $actionUp -Trigger $triggerUp -Settings $settings -Force | Out-Null

$actionWatch = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$watchScript`""
$triggerWatch = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration ([TimeSpan]::MaxValue)

Register-ScheduledTask -TaskName "AtlasOne-Watchdog" -Action $actionWatch -Trigger $triggerWatch -Settings $settings -Force | Out-Null

Write-Host "[OK] Atlas One configurado para:" -ForegroundColor Green
Write-Host "  - Iniciar ao ligar o PC" -ForegroundColor White
Write-Host "  - Verificar a cada 5 minutos e religar se cair" -ForegroundColor White
