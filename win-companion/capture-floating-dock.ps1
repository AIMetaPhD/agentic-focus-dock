param(
    [int]$ProcessId,
    [string]$Out = "qa/evidence/native/10-windows-floating-dock.png"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class FdEnum {
    public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int n);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdc, uint flags);
    public struct RECT { public int Left, Top, Right, Bottom; }
    public static List<IntPtr> VisibleWindows(uint targetPid) {
        var found = new List<IntPtr>();
        EnumWindows((h, l) => {
            uint pid; GetWindowThreadProcessId(h, out pid);
            if (pid == targetPid && IsWindowVisible(h)) found.Add(h);
            return true;
        }, IntPtr.Zero);
        return found;
    }
    public static string Title(IntPtr hWnd) {
        var sb = new StringBuilder(512);
        GetWindowText(hWnd, sb, sb.Capacity);
        return sb.ToString();
    }
}
"@

$handles = [FdEnum]::VisibleWindows([uint32]$ProcessId)
if ($handles.Count -eq 0) { throw "No visible top-level window for PID $ProcessId" }

# The dock window title contains "Windows trial". Fall back to the largest visible window.
$chosen = $null
foreach ($h in $handles) {
    if ([FdEnum]::Title($h) -match "Windows trial") { $chosen = $h; break }
}
if (-not $chosen) {
    $bestArea = -1
    foreach ($h in $handles) {
        $r = New-Object FdEnum+RECT
        [FdEnum]::GetWindowRect($h, [ref]$r) | Out-Null
        $area = ($r.Right - $r.Left) * ($r.Bottom - $r.Top)
        if ($area -gt $bestArea) { $bestArea = $area; $chosen = $h }
    }
}

$rect = New-Object FdEnum+RECT
[FdEnum]::GetWindowRect($chosen, [ref]$rect) | Out-Null
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top
if ($width -le 0 -or $height -le 0) { throw "Chosen window has no size" }

$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$hdc = $graphics.GetHdc()
# PW_RENDERFULLCONTENT = 2 is required to capture GPU-composited WebView2 content.
$printed = [FdEnum]::PrintWindow($chosen, $hdc, 2)
$graphics.ReleaseHdc($hdc)
if (-not $printed) { $graphics.Dispose(); $bitmap.Dispose(); throw "PrintWindow failed for the floating dock window" }

$full = [System.IO.Path]::GetFullPath($Out)
$dir = [System.IO.Path]::GetDirectoryName($full)
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
$bitmap.Save($full, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
Write-Host "captured $full"
