param([int]$ProcessId)
$ErrorActionPreference = "Stop"
Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class FdDiag {
    public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int n);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder sb, int n);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    public struct RECT { public int Left, Top, Right, Bottom; }
    public static List<string> Dump(uint targetPid) {
        var rows = new List<string>();
        EnumWindows((h, l) => {
            uint pid; GetWindowThreadProcessId(h, out pid);
            if (pid != targetPid) return true;
            var t = new StringBuilder(512); GetWindowText(h, t, t.Capacity);
            var c = new StringBuilder(256); GetClassName(h, c, c.Capacity);
            RECT r; GetWindowRect(h, out r);
            rows.Add(string.Format("hwnd={0} visible={1} class={2} title={3} rect={4},{5},{6},{7}",
                h, IsWindowVisible(h), c, t, r.Left, r.Top, r.Right, r.Bottom));
            return true;
        }, IntPtr.Zero);
        return rows;
    }
}
"@
$rows = [FdDiag]::Dump([uint32]$ProcessId)
if ($rows.Count -eq 0) { Write-Host "NO TOP-LEVEL WINDOWS for PID $ProcessId" } else { $rows | ForEach-Object { Write-Host $_ } }
