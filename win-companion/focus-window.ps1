param([string]$ProcessName, [string]$FilePath)

$ErrorActionPreference = "Stop"
if ($FilePath) { Start-Process -FilePath $FilePath }

Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class FdFocus {
    public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int n);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint flags, UIntPtr extra);
    public static List<IntPtr> ForPid(uint targetPid) {
        var found = new List<IntPtr>();
        EnumWindows((h, l) => {
            uint pid; GetWindowThreadProcessId(h, out pid);
            if (pid == targetPid && IsWindowVisible(h) && h != IntPtr.Zero) found.Add(h);
            return true;
        }, IntPtr.Zero);
        return found;
    }
}
"@

Start-Sleep -Milliseconds 600
$procs = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -or $true }
foreach ($p in $procs) {
    $handles = [FdFocus]::ForPid([uint32]$p.Id)
    foreach ($h in $handles) {
        [FdFocus]::ShowWindow($h, 9) | Out-Null      # SW_RESTORE
        [FdFocus]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)  # press ALT
        [FdFocus]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)  # release ALT
        if ([FdFocus]::SetForegroundWindow($h)) { Write-Output ("focused hwnd=" + $h + " pid=" + $p.Id); exit 0 }
    }
}
Write-Output "NO-WINDOW-FOUND for $ProcessName"
exit 1
