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
        private readonly TextBox search;
        private readonly Label detail;
        private readonly Button launchButton;
        private readonly string auditFile;
        private List<AppEntry> apps;

        public AppPickerForm(string auditFile)
        {
            this.auditFile = auditFile;
            Text = "Choose an app — FocusDock / 选择应用";
            ClientSize = new Size(560, 450);
            StartPosition = FormStartPosition.CenterParent;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            ShowInTaskbar = false;

            Label hint = new Label();
            hint.Text = "This is a Windows diagnostic picker. Search and select the app you want; nothing launches until you press Launch. Access is just one installed Microsoft app, not a FocusDock requirement.";
            hint.SetBounds(16, 12, 520, 48);
            Controls.Add(hint);

            search = new TextBox();
            search.SetBounds(16, 66, 528, 28);
            search.TextChanged += delegate { FilterApps(); };
            Controls.Add(search);

            list = new ListBox();
            list.SetBounds(16, 104, 528, 230);
            list.DoubleClick += delegate { LaunchSelected(); };
            list.SelectedIndexChanged += delegate { ShowDetail(); };
            Controls.Add(list);

            detail = new Label();
            detail.SetBounds(16, 344, 528, 40);
            detail.ForeColor = Color.DimGray;
            Controls.Add(detail);

            launchButton = new Button();
            launchButton.Text = "Launch / 启动";
            launchButton.SetBounds(300, 400, 110, 32);
            launchButton.Enabled = false;
            launchButton.Click += delegate { LaunchSelected(); };
            Controls.Add(launchButton);

            Button cancel = new Button();
            cancel.Text = "Cancel / 取消";
            cancel.SetBounds(420, 400, 110, 32);
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
                FilterApps();
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

        private void FilterApps()
        {
            if (apps == null) return;
            string query = search.Text.Trim();
            list.BeginUpdate();
            list.Items.Clear();
            foreach (AppEntry entry in apps)
            {
                if (query.Length == 0 || entry.Name.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    list.Items.Add(entry);
                }
            }
            list.EndUpdate();
            list.SelectedIndex = -1;
            launchButton.Enabled = false;
            detail.Text = list.Items.Count == 0
                ? "No matches. Clear the search or try another name."
                : list.Items.Count + " matches. Select one explicitly; nothing is launched automatically.";
        }

        private void ShowDetail()
        {
            AppEntry entry = list.SelectedItem as AppEntry;
            launchButton.Enabled = entry != null;
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
