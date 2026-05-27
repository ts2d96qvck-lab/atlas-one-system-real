# Coloca atalho na pasta Inicializar do Windows (nao precisa ser admin)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot | Split-Path -Parent
$bat = Join-Path $root "INICIAR-ATLAS.bat"
$startup = [Environment]::GetFolderPath("Startup")
$lnk = Join-Path $startup "Atlas One.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnk)
$shortcut.TargetPath = $bat
$shortcut.WorkingDirectory = $root
$shortcut.WindowStyle = 7
$shortcut.Description = "Inicia Atlas One automaticamente"
$shortcut.Save()

Write-Host "[OK] Atlas One vai iniciar ao ligar o PC" -ForegroundColor Green
Write-Host "  Atalho: $lnk" -ForegroundColor DarkGray
