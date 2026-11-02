$ErrorActionPreference = "Stop"

$charmap = Start-Process charmap.exe -PassThru
Start-Sleep -Seconds 2
$wsh = New-Object -ComObject WScript.Shell
$wsh.AppActivate($charmap.Id) | Out-Null
Start-Sleep -Seconds 2

& (Join-Path $PSScriptRoot "capture-window.ps1") -Out "qa/evidence/native/00-windows-companion.png"
Start-Sleep -Seconds 1
Stop-Process -Id $charmap.Id -Force -ErrorAction SilentlyContinue
Write-Host "controlled capture complete"
