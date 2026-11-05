param([string]$DataDir = "", [switch]$CaptureLogs)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
try {
    Set-Location $root
    if (!(Get-Command node -ErrorAction SilentlyContinue)) { throw "未找到 Node.js，请安装 Node 24 LTS 后重试。" }
    $version = & node -p "process.versions.node"
    if ([version]$version -lt [version]"22.5.0") { throw "Node.js 版本过低，请升级到 Node 24 LTS。" }
    foreach ($port in @(4317,4318)) {
        if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
            throw "端口 $port 已占用。请先从托盘退出已有 FocusDock，或关闭冲突程序后重试。"
        }
    }
    if (!(Test-Path "node_modules/tsx/dist/cli.mjs")) { throw "缺少依赖。请在项目目录运行 npm install，然后重新双击 Start-FocusDock.cmd。" }
    Write-Host "正在准备 Windows 本地试用版……"
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "前端构建失败。请根据上方错误修复依赖后重试。" }
    # Run the build in the current host instead of spawning another PowerShell.
    # This avoids the PowerShell 7.6 startup crash in ShowUpdateNotification.
    & (Join-Path $root "win-companion/build.ps1")
    if ($LASTEXITCODE -ne 0) { throw "原生组件构建失败。若旧版仍在运行，请先退出；首次构建需联网下载微软 WebView2 SDK。" }
    if (!$DataDir) { $DataDir = Join-Path $env:LOCALAPPDATA "FocusDock" }
    $arguments = '--trial-root "' + $root + '" --data-dir "' + $DataDir + '"'
    if ($CaptureLogs) { $arguments += ' --capture-logs' }
    Start-Process -FilePath (Join-Path $root "win-companion/bin/FocusDockCompanion.exe") -ArgumentList $arguments
    Write-Host "已启动：后端和原生浮动条由同一个托盘入口管理。右击托盘图标 → Exit / 退出可全部关闭。"
} catch {
    Write-Host ("启动失败：" + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
