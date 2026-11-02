$ErrorActionPreference = "Stop"

$wsh = New-Object -ComObject WScript.Shell
$started = @()

function Activate-Process($process, $label) {
    Start-Sleep -Seconds 1
    $ok = $wsh.AppActivate($process.Id)
    if (-not $ok) {
        $term = Get-Process WindowsTerminal -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($term) { $ok = $wsh.AppActivate($term.Id) }
    }
    Write-Host "activated $label pid=$($process.Id) ok=$ok"
}

try {
    $cmd = Start-Process cmd.exe -PassThru
    $started += $cmd.Id
    Start-Sleep -Seconds 2
    Activate-Process $cmd "cmd"
    Start-Sleep -Seconds 5

    $ps = Start-Process powershell.exe -PassThru
    $started += $ps.Id
    Start-Sleep -Seconds 2
    Activate-Process $ps "PowerShell"
    Start-Sleep -Seconds 20

    $charmap = Start-Process charmap.exe -PassThru
    $started += $charmap.Id
    Start-Sleep -Seconds 2
    Activate-Process $charmap "Character Map"
    Start-Sleep -Seconds 5
}
finally {
    foreach ($id in $started) {
        Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "smoke drive complete"
}
