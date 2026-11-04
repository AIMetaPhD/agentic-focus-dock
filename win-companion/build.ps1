$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (!(Test-Path $csc)) {
    throw "C# compiler not found: $csc"
}

$sdkVersion = "1.0.3650.58"
$sdk = Join-Path $root "obj\webview2-$sdkVersion"
if (!(Test-Path (Join-Path $sdk "lib\net462\Microsoft.Web.WebView2.Core.dll"))) {
    New-Item -ItemType Directory -Force -Path $sdk | Out-Null
    $package = Join-Path $sdk "sdk.nupkg"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -UseBasicParsing -Uri "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$sdkVersion/microsoft.web.webview2.$sdkVersion.nupkg" -OutFile $package
    if ((Get-FileHash $package -Algorithm SHA256).Hash -ne "911A472128C82AC8BAA0C486C23342CC9DD6E7DC50D754E676726642CA065C60") { throw "WebView2 SDK checksum mismatch" }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($package, $sdk)
    Remove-Item $package
}
$outDir = Join-Path $root "bin"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$sources = Get-ChildItem -Path (Join-Path $root "src") -Filter *.cs | Sort-Object Name | ForEach-Object { $_.FullName }
$base = @(
    "/nologo",
    "/platform:x64",
    "/codepage:65001",
    "/r:System.dll",
    "/r:System.Core.dll",
    "/r:System.Security.dll",
    "/r:System.Windows.Forms.dll",
    "/r:System.Drawing.dll",
    "/r:$sdk\lib\net462\Microsoft.Web.WebView2.Core.dll",
    "/r:$sdk\lib\net462\Microsoft.Web.WebView2.WinForms.dll"
)

$tray = @("/target:winexe", "/out:$outDir\FocusDockCompanion.exe") + $base + $sources
& $csc $tray
if ($LASTEXITCODE -ne 0) { throw "tray build failed with exit code $LASTEXITCODE" }

$cli = @("/target:exe", "/out:$outDir\FocusDockCompanionCli.exe") + $base + $sources
& $csc $cli
if ($LASTEXITCODE -ne 0) { throw "cli build failed with exit code $LASTEXITCODE" }

Copy-Item (Join-Path $sdk "lib\net462\Microsoft.Web.WebView2.Core.dll") $outDir -Force
Copy-Item (Join-Path $sdk "lib\net462\Microsoft.Web.WebView2.WinForms.dll") $outDir -Force
Copy-Item (Join-Path $sdk "runtimes\win-x64\native\WebView2Loader.dll") $outDir -Force

Write-Host "Built:"
Write-Host "  $outDir\FocusDockCompanion.exe"
Write-Host "  $outDir\FocusDockCompanionCli.exe"
