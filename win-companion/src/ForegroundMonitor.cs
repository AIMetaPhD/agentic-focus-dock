using System;
using System.Diagnostics;
using System.Text;
using System.Threading;

namespace FocusDock.Companion
{
    internal sealed class ForegroundMonitor : IDisposable
    {
        private sealed class DwellState
        {
            public uint Pid;
            public IntPtr Hwnd;
            public string AppId;
            public string AppName;
            public string Title;
            public string Observation;
            public DateTime StartedAt;
        }

        private readonly BridgeClient client;
        private readonly bool includeTitles;
        private readonly Action<string> log;
        private readonly object gate = new object();
        private NativeMethods.WinEventDelegate callback;
        private IntPtr hook;
        private Timer dwellTimer;
        private uint lastPid;
        private IntPtr lastHwnd;
        private bool disposed;

        public event Action<string> ActivitySent;
        public event Action<string> Error;
        public event Action<string> ForegroundChanged;

        public ForegroundMonitor(BridgeClient client, bool includeTitles, Action<string> log)
        {
            this.client = client;
            this.includeTitles = includeTitles;
            this.log = log;
        }

        public void Start()
        {
            callback = new NativeMethods.WinEventDelegate(OnWinEvent);
            hook = NativeMethods.SetWinEventHook(
                NativeMethods.EVENT_SYSTEM_FOREGROUND,
                NativeMethods.EVENT_SYSTEM_FOREGROUND,
                IntPtr.Zero,
                callback,
                0,
                0,
                NativeMethods.WINEVENT_OUTOFCONTEXT | NativeMethods.WINEVENT_SKIPOWNPROCESS);
            if (hook == IntPtr.Zero)
            {
                throw new InvalidOperationException("SetWinEventHook failed.");
            }
            log("foreground monitor started");
        }

        private void OnWinEvent(
            IntPtr hWinEventHook,
            uint eventType,
            IntPtr hwnd,
            int idObject,
            int idChild,
            uint dwEventThread,
            uint dwmsEventTime)
        {
            if (disposed || eventType != NativeMethods.EVENT_SYSTEM_FOREGROUND) return;
            if (hwnd == IntPtr.Zero) hwnd = NativeMethods.GetForegroundWindow();
            if (hwnd == IntPtr.Zero) return;
            Evaluate(hwnd);
        }

        private void Evaluate(IntPtr hwnd)
        {
            if (!NativeMethods.IsWindowVisible(hwnd)) return;
            uint pid;
            NativeMethods.GetWindowThreadProcessId(hwnd, out pid);
            if (pid == 0 || pid == (uint)Process.GetCurrentProcess().Id) return;

            string appId;
            string appName;
            if (!TryDescribeProcess(pid, out appId, out appName)) return;
            if (string.IsNullOrEmpty(appName)) return;
            if (appName.IndexOf("FocusDockCompanion", StringComparison.OrdinalIgnoreCase) >= 0) return;

            lock (gate)
            {
                if (pid == lastPid && hwnd == lastHwnd) return;
                lastPid = pid;
                lastHwnd = hwnd;
            }

            string title = includeTitles ? ReadTitle(hwnd) : null;
            log("foreground: " + appName + " pid=" + pid + " hwnd=" + hwnd);
            Action<string> changed = ForegroundChanged;
            if (changed != null) changed(appName);
            string observation = Guid.NewGuid().ToString("N");
            Send(appId, appName, title, 0, observation + "-0");
            RestartDwell(pid, hwnd, appId, appName, title, observation);
        }

        private bool TryDescribeProcess(uint pid, out string appId, out string appName)
        {
            appId = null;
            appName = null;
            try
            {
                using (Process process = Process.GetProcessById((int)pid))
                {
                    appName = process.ProcessName;
                    try
                    {
                        string file = process.MainModule.FileName;
                        if (!string.IsNullOrEmpty(file)) appId = file;
                        string description = process.MainModule.FileVersionInfo.FileDescription;
                        if (!string.IsNullOrWhiteSpace(description)) appName = description;
                    }
                    catch
                    {
                        // Elevated or protected processes may deny MainModule access.
                    }
                }
                if (string.IsNullOrEmpty(appId)) appId = appName;
                return !string.IsNullOrEmpty(appName);
            }
            catch
            {
                return false;
            }
        }

        private static string ReadTitle(IntPtr hwnd)
        {
            int length = NativeMethods.GetWindowTextLength(hwnd);
            if (length <= 0) return null;
            if (length > 2048) length = 2048;
            StringBuilder title = new StringBuilder(length + 1);
            NativeMethods.GetWindowText(hwnd, title, title.Capacity);
            return title.ToString();
        }

        private void RestartDwell(uint pid, IntPtr hwnd, string appId, string appName, string title, string observation)
        {
            DwellState state = new DwellState();
            state.Pid = pid;
            state.Hwnd = hwnd;
            state.AppId = appId;
            state.AppName = appName;
            state.Title = title;
            state.Observation = observation;
            state.StartedAt = DateTime.UtcNow;
            lock (gate)
            {
                if (dwellTimer != null)
                {
                    dwellTimer.Dispose();
                    dwellTimer = null;
                }
                dwellTimer = new Timer(DwellElapsed, state, 15000, 15000);
            }
        }

        private void DwellElapsed(object state)
        {
            DwellState dwell = state as DwellState;
            if (dwell == null) return;
            lock (gate)
            {
                if (disposed || dwell.Pid != lastPid || dwell.Hwnd != lastHwnd) return;
            }
            if (NativeMethods.GetForegroundWindow() != dwell.Hwnd) return;
            double seconds = Math.Floor((DateTime.UtcNow - dwell.StartedAt).TotalSeconds);
            Send(dwell.AppId, dwell.AppName, dwell.Title, seconds, dwell.Observation + "-" + seconds);
        }

        private void Send(string appId, string appName, string title, double stableSeconds, string dedupeKey)
        {
            string capturedId = appId;
            string capturedName = appName;
            string capturedTitle = title;
            double capturedStable = stableSeconds;
            string capturedKey = dedupeKey;
            ThreadPool.QueueUserWorkItem(delegate(object ignored)
            {
                bool ok = client.Activity(capturedId, capturedName, capturedTitle, capturedStable, capturedKey);
                if (ok)
                {
                    log("sent activity: " + capturedName + " stable=" + capturedStable + "s");
                    Action<string> handler = ActivitySent;
                    if (handler != null) handler(capturedName + " (" + capturedStable + "s)");
                }
                else
                {
                    log("send failed: " + client.LastError);
                    Action<string> handler = Error;
                    if (handler != null) handler(client.LastError);
                }
            });
        }

        public void Dispose()
        {
            lock (gate)
            {
                disposed = true;
                if (dwellTimer != null)
                {
                    dwellTimer.Dispose();
                    dwellTimer = null;
                }
            }
            if (hook != IntPtr.Zero)
            {
                NativeMethods.UnhookWinEvent(hook);
                hook = IntPtr.Zero;
            }
            log("foreground monitor stopped");
        }
    }
}
