using System;
using System.Diagnostics;
using System.Drawing;
using System.Threading;
using System.Windows.Forms;

namespace FocusDock.Companion
{
    internal sealed class TrayContext : ApplicationContext
    {
        private readonly NotifyIcon icon;
        private readonly ForegroundMonitor monitor;
        private readonly BridgeClient client;
        private readonly Options options;
        private readonly System.Threading.Timer heartbeat;
        private readonly System.Windows.Forms.Timer showTimer;
        private readonly System.Windows.Forms.Timer exitTimer;
        private StatusForm status;
        private bool exiting;

        public TrayContext(BridgeClient client, ForegroundMonitor monitor, Options options)
        {
            this.client = client;
            this.monitor = monitor;
            this.options = options;

            ContextMenuStrip menu = new ContextMenuStrip();
            menu.Items.Add("Show status / 显示状态", null, delegate { ShowStatus(); });
            menu.Items.Add("Launch app… / 启动应用…", null, delegate { LaunchApp(); });
            menu.Items.Add("Open dashboard / 打开面板", null, delegate { OpenDashboard(); });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Exit / 退出", null, delegate { Exit(); });

            icon = new NotifyIcon();
            icon.Icon = SystemIcons.Application;
            icon.Text = "FocusDock Native Companion";
            icon.ContextMenuStrip = menu;
            icon.Visible = true;
            icon.DoubleClick += delegate { ShowStatus(); };

            monitor.ActivitySent += delegate(string message)
            {
                if (status != null) status.AddEvent(message);
            };
            monitor.Error += delegate(string message)
            {
                if (status != null) status.SetError(message);
            };
            monitor.ForegroundChanged += delegate(string app)
            {
                if (status != null) status.SetCurrent(app);
            };

            heartbeat = new System.Threading.Timer(Heartbeat, null, 0, 10000);
            if (options.ShowStatus)
            {
                showTimer = new System.Windows.Forms.Timer();
                showTimer.Interval = 500;
                showTimer.Tick += delegate
                {
                    showTimer.Stop();
                    ShowStatus();
                };
                showTimer.Start();
            }
            if (options.ExitAfterSeconds > 0)
            {
                exitTimer = new System.Windows.Forms.Timer();
                exitTimer.Interval = options.ExitAfterSeconds * 1000;
                exitTimer.Tick += delegate
                {
                    exitTimer.Stop();
                    Exit();
                };
                exitTimer.Start();
            }
        }

        public void ShowStatus()
        {
            if (status == null || status.IsDisposed)
            {
                status = new StatusForm(options.Backend, options.ShowAppNames);
                status.LaunchRequested += delegate { LaunchApp(); };
                status.DashboardRequested += delegate { OpenDashboard(); };
                status.HideRequested += delegate { status.Hide(); };
            }
            status.Show();
            status.Activate();
        }

        private void LaunchApp()
        {
            using (AppPickerForm picker = new AppPickerForm(options.AuditFile))
            {
                picker.ShowDialog();
            }
            bool ok = client.Heartbeat();
            if (status != null) status.SetConnected(ok, client.LastError);
        }

        private void OpenDashboard()
        {
            try
            {
                Process.Start(options.Backend);
            }
            catch (Exception ex)
            {
                if (status != null) status.SetError(ex.Message);
            }
        }

        private void Heartbeat(object ignored)
        {
            bool ok = client.Heartbeat();
            if (status != null)
            {
                status.SetConnected(ok, client.LastError);
            }
        }

        private void Exit()
        {
            if (exiting) return;
            exiting = true;
            if (showTimer != null) showTimer.Stop();
            if (exitTimer != null) exitTimer.Stop();
            heartbeat.Dispose();
            monitor.Dispose();
            client.Disconnect();
            icon.Visible = false;
            icon.Dispose();
            if (status != null)
            {
                status.AllowClose = true;
                status.Close();
                status.Dispose();
                status = null;
            }
            ExitThread();
        }
    }
}
