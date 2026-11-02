using System;
using System.Drawing;
using System.Windows.Forms;

namespace FocusDock.Companion
{
    internal sealed class StatusForm : Form
    {
        private readonly Label nativeLabel;
        private readonly Label currentLabel;
        private readonly Label eventsLabel;
        private readonly Label errorLabel;
        private readonly bool showAppNames;
        private int events;

        public bool AllowClose;

        public event EventHandler LaunchRequested;
        public event EventHandler DashboardRequested;
        public event EventHandler HideRequested;

        public StatusForm(string backend, bool showAppNames)
        {
            this.showAppNames = showAppNames;
            Text = "FocusDock Native Companion — Windows / 原生伴生程序";
            ClientSize = new Size(640, 330);
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            ShowInTaskbar = true;

            Label title = new Label();
            title.Text = "FocusDock Native Companion";
            title.Font = new Font(Font.FontFamily, 15f, FontStyle.Bold);
            title.SetBounds(18, 14, 600, 30);
            Controls.Add(title);

            Label subtitle = new Label();
            subtitle.Text = "Windows user-session agent · foreground app monitor · allowlisted launch";
            subtitle.ForeColor = Color.DimGray;
            subtitle.SetBounds(18, 46, 600, 22);
            Controls.Add(subtitle);

            Label backendLabel = new Label();
            backendLabel.Text = "Backend / 本地服务: " + backend;
            backendLabel.SetBounds(18, 78, 600, 22);
            Controls.Add(backendLabel);

            nativeLabel = new Label();
            nativeLabel.Text = "Native status / 原生状态: connecting…";
            nativeLabel.SetBounds(18, 106, 600, 22);
            Controls.Add(nativeLabel);

            currentLabel = new Label();
            currentLabel.Text = "Foreground / 前台应用: —";
            currentLabel.SetBounds(18, 134, 600, 22);
            Controls.Add(currentLabel);

            eventsLabel = new Label();
            eventsLabel.Text = "Events sent / 已发送事件: 0";
            eventsLabel.SetBounds(18, 162, 600, 22);
            Controls.Add(eventsLabel);

            errorLabel = new Label();
            errorLabel.Text = "Last error / 最近错误: —";
            errorLabel.ForeColor = Color.Firebrick;
            errorLabel.SetBounds(18, 190, 600, 40);
            Controls.Add(errorLabel);

            Button launch = new Button();
            launch.Text = "Diagnostic launch… / 诊断启动…";
            launch.SetBounds(18, 250, 170, 34);
            launch.Click += delegate { EventHandler handler = LaunchRequested; if (handler != null) handler(this, EventArgs.Empty); };
            Controls.Add(launch);

            Button dashboard = new Button();
            dashboard.Text = "Open dashboard / 打开面板";
            dashboard.SetBounds(200, 250, 180, 34);
            dashboard.Click += delegate { EventHandler handler = DashboardRequested; if (handler != null) handler(this, EventArgs.Empty); };
            Controls.Add(dashboard);

            Button hide = new Button();
            hide.Text = "Hide / 隐藏";
            hide.SetBounds(392, 250, 100, 34);
            hide.Click += delegate { EventHandler handler = HideRequested; if (handler != null) handler(this, EventArgs.Empty); };
            Controls.Add(hide);

            Label note = new Label();
            note.Text = "Normal flow: use the web dock + Add app. This raw launcher is diagnostic only.";
            note.ForeColor = Color.DimGray;
            note.SetBounds(18, 294, 600, 22);
            Controls.Add(note);
        }

        public void SetConnected(bool connected, string error)
        {
            RunOnUi(delegate
            {
                nativeLabel.Text = connected
                    ? "Native status / 原生状态: Windows — connected"
                    : "Native status / 原生状态: Web-only — no native access";
                if (!string.IsNullOrEmpty(error)) SetError(error);
            });
        }

        public void SetCurrent(string app)
        {
            RunOnUi(delegate
            {
                currentLabel.Text = "Foreground / 前台应用: " +
                    (showAppNames ? app : "native app detected");
            });
        }

        public void AddEvent(string message)
        {
            RunOnUi(delegate
            {
                events++;
                eventsLabel.Text = "Events sent / 已发送事件: " + events +
                    " · " + (showAppNames ? message : "native event");
            });
        }

        public void SetError(string error)
        {
            RunOnUi(delegate { errorLabel.Text = "Last error / 最近错误: " + error; });
        }

        private void RunOnUi(MethodInvoker action)
        {
            if (IsDisposed) return;
            if (InvokeRequired)
            {
                try { BeginInvoke(action); }
                catch { }
            }
            else
            {
                action();
            }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (!AllowClose)
            {
                e.Cancel = true;
                Hide();
                return;
            }
            base.OnFormClosing(e);
        }
    }
}
