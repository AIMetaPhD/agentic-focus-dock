using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace FocusDock.Companion
{
    internal sealed class AppPickerForm : Form
    {
        private readonly ListBox list;
        private readonly Label detail;
        private readonly string auditFile;
        private List<AppEntry> apps;

        public AppPickerForm(string auditFile)
        {
            this.auditFile = auditFile;
            Text = "Installed apps — FocusDock / 已安装应用";
            ClientSize = new Size(560, 420);
            StartPosition = FormStartPosition.CenterParent;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            ShowInTaskbar = false;

            Label hint = new Label();
            hint.Text = "Start Menu shortcuts resolved to existing .exe targets. No free-form command line.";
            hint.SetBounds(16, 12, 520, 36);
            Controls.Add(hint);

            list = new ListBox();
            list.SetBounds(16, 52, 528, 270);
            list.DisplayMember = "Name";
            list.DoubleClick += delegate { LaunchSelected(); };
            list.SelectedIndexChanged += delegate { ShowDetail(); };
            Controls.Add(list);

            detail = new Label();
            detail.SetBounds(16, 330, 528, 40);
            detail.ForeColor = Color.DimGray;
            Controls.Add(detail);

            Button launch = new Button();
            launch.Text = "Launch / 启动";
            launch.SetBounds(300, 376, 110, 32);
            launch.Click += delegate { LaunchSelected(); };
            Controls.Add(launch);

            Button cancel = new Button();
            cancel.Text = "Cancel / 取消";
            cancel.SetBounds(420, 376, 110, 32);
            cancel.DialogResult = DialogResult.Cancel;
            Controls.Add(cancel);

            Shown += delegate { LoadApps(); };
        }

        private void LoadApps()
        {
            Cursor = Cursors.WaitCursor;
            try
            {
                apps = AppCatalog.Load();
                list.DataSource = apps;
                detail.Text = apps.Count + " apps found. Only resolved .exe targets can be launched.";
                if (apps.Count > 0) list.SelectedIndex = 0;
            }
            catch (Exception ex)
            {
                detail.Text = "Could not enumerate installed apps: " + ex.Message;
            }
            finally
            {
                Cursor = Cursors.Default;
            }
        }

        private void ShowDetail()
        {
            AppEntry entry = list.SelectedItem as AppEntry;
            if (entry == null)
            {
                detail.Text = "";
                return;
            }
            detail.Text = entry.Name + "  ·  " + Path.GetFileName(entry.TargetPath);
        }

        private void LaunchSelected()
        {
            AppEntry entry = list.SelectedItem as AppEntry;
            if (entry == null)
            {
                MessageBox.Show("Select an installed app first.", "FocusDock", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }
            string detailText;
            bool ok = AppCatalog.Launch(entry, auditFile, out detailText);
            if (ok)
            {
                MessageBox.Show("Launched " + entry.Name + ".", "FocusDock", MessageBoxButtons.OK, MessageBoxIcon.Information);
                Close();
            }
            else
            {
                MessageBox.Show("Launch rejected: " + detailText, "FocusDock", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }
    }
}
