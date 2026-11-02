$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (!(Test-Path $csc)) {
    throw "C# compiler not found: $csc"
}

$outDir = Join-Path $root "bin"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$sources = Get-ChildItem -Path (Join-Path $root "src") -Filter *.cs | Sort-Object Name | ForEach-Object { $_.FullName }
$base = @(
    "/nologo",
    "/codepage:65001",
    "/r:System.dll",
    "/r:System.Core.dll",
    "/r:System.Security.dll",
    "/r:System.Windows.Forms.dll",
    "/r:System.Drawing.dll"
)

$tray = @("/target:winexe", "/out:$outDir\FocusDockCompanion.exe") + $base + $sources
& $csc $tray
if ($LASTEXITCODE -ne 0) { throw "tray build failed with exit code $LASTEXITCODE" }

$cli = @("/target:exe", "/out:$outDir\FocusDockCompanionCli.exe") + $base + $sources
& $csc $cli
if ($LASTEXITCODE -ne 0) { throw "cli build failed with exit code $LASTEXITCODE" }

Write-Host "Built:"
Write-Host "  $outDir\FocusDockCompanion.exe"
Write-Host "  $outDir\FocusDockCompanionCli.exe"
