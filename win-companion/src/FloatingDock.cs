using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace FocusDock.Companion
{
    internal sealed class FloatingDock : Form
    {
        private readonly WebView2 view = new WebView2();
        private readonly string backend;
        private readonly string dataDir;
        public bool AllowClose;
        protected override bool ShowWithoutActivation { get { return true; } }

        public FloatingDock(string backend, string dataDir)
        {
            this.backend = backend;
            this.dataDir = dataDir;
            Text = "FocusDock — Windows trial / 试用浮动条";
            FormBorderStyle = FormBorderStyle.FixedToolWindow;
            ShowInTaskbar = false;
            TopMost = true;
            StartPosition = FormStartPosition.Manual;
            Rectangle work = Screen.PrimaryScreen.WorkingArea;
            ClientSize = new Size(Math.Min(1080, work.Width - 32), 180);
            Location = new Point(work.Left + (work.Width - Width) / 2, work.Bottom - Height - 12);
            BackColor = Color.FromArgb(13, 15, 20);
            view.Dock = DockStyle.Fill;
            Controls.Add(view);
            Shown += async delegate
            {
                if (view.CoreWebView2 != null) return;
                try
                {
                    CoreWebView2Environment environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(dataDir, "webview"));
                    await view.EnsureCoreWebView2Async(environment);
                    view.CoreWebView2.Settings.AreDevToolsEnabled = false;
                    view.CoreWebView2.Settings.IsWebMessageEnabled = false;
                    view.CoreWebView2.PermissionRequested += delegate(object sender, CoreWebView2PermissionRequestedEventArgs args)
                    { args.State = CoreWebView2PermissionState.Deny; };
                    view.CoreWebView2.NavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs args)
                    {
                        Uri uri;
                        if (!Uri.TryCreate(args.Uri, UriKind.Absolute, out uri) || uri.GetLeftPart(UriPartial.Authority) != backend)
                            args.Cancel = true;
                    };
                    view.CoreWebView2.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs args)
                    {
                        args.Handled = true;
                        Uri uri;
                        if (Uri.TryCreate(args.Uri, UriKind.Absolute, out uri) && (uri.Scheme == "https" || uri.GetLeftPart(UriPartial.Authority) == backend))
                            System.Diagnostics.Process.Start(uri.AbsoluteUri);
                    };
                    view.Source = new Uri(backend + "/dock");
                }
                catch (Exception ex)
                {
                    try
                    {
                        string dir = Path.Combine(dataDir, "runtime");
                        Directory.CreateDirectory(dir);
                        File.WriteAllText(Path.Combine(dir, "floating-dock-error.log"), DateTime.Now.ToString("o") + Environment.NewLine + ex);
                    }
                    catch { /* diagnostics are best effort */ }
                    MessageBox.Show("浮动 Dock 无法加载 WebView2。\n" + ex.Message + "\n\n请确认已安装微软 WebView2 Evergreen Runtime；暂时可从托盘打开面板。", "FocusDock", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    Hide();
                }
            };
            FormClosing += delegate(object sender, FormClosingEventArgs args)
            {
                if (!AllowClose) { args.Cancel = true; Hide(); }
            };
        }
    }
}
