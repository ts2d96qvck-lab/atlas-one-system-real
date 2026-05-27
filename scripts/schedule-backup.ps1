# Schedule daily Atlas backup at 02:00 (Windows Task Scheduler)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot | Split-Path -Parent
$backupScript = Join-Path $root "scripts\backup-atlas.ps1"

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$backupScript`""
$trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "AtlasOne-Backup-Diario" -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

Write-Host "[OK] Backup diario agendado as 02:00" -ForegroundColor Green
Write-Host "  Script: $backupScript" -ForegroundColor DarkGray
Write-Host "  Retencao: 30 dias em backups/" -ForegroundColor DarkGray
