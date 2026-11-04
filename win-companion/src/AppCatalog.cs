using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

namespace FocusDock.Companion
{
    internal sealed class AppEntry
    {
        public string Id;
        public string Name;
        public string TargetPath;
        public string Sha256;

        public override string ToString()
        {
            return Name;
        }
    }

    internal static class AppCatalog
    {
        public static List<AppEntry> Load()
        {
            List<AppEntry> apps = new List<AppEntry>();
            HashSet<string> seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            string[] roots = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonStartMenu), "Programs"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs")
            };

            foreach (string root in roots)
            {
                if (!Directory.Exists(root)) continue;
                string[] files;
                try
                {
                    files = Directory.GetFiles(root, "*.lnk", SearchOption.AllDirectories);
                }
                catch
                {
                    continue;
                }
                foreach (string shortcut in files)
                {
                    string target;
                    if (!TryResolveShortcut(shortcut, out target)) continue;
                    if (!IsSafeTarget(target)) continue;
                    string key = Path.GetFullPath(target).ToLowerInvariant();
                    if (!seen.Add(key)) continue;
                    string name = Path.GetFileNameWithoutExtension(shortcut);
                    if (string.IsNullOrWhiteSpace(name)) name = Path.GetFileNameWithoutExtension(target);
                    AppEntry entry = new AppEntry();
                    entry.Name = name;
                    entry.TargetPath = Path.GetFullPath(target);
                    entry.Id = StableId(entry.Name, entry.TargetPath);
                    apps.Add(entry);
                }
            }

            apps.Sort(delegate(AppEntry a, AppEntry b)
            {
                return string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase);
            });
            return apps;
        }

        public static bool TryResolveShortcut(string shortcut, out string target)
        {
            target = null;
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType == null) return false;
                object shell = Activator.CreateInstance(shellType);
                object link = shellType.InvokeMember(
                    "CreateShortcut",
                    BindingFlags.InvokeMethod,
                    null,
                    shell,
                    new object[] { shortcut });
                if (link == null) return false;
                object value = link.GetType().InvokeMember(
                    "TargetPath",
                    BindingFlags.GetProperty,
                    null,
                    link,
                    null);
                target = value as string;
                return !string.IsNullOrWhiteSpace(target);
            }
            catch
            {
                return false;
            }
        }

        public static string StableId(string name, string path)
        {
            string slug = (name ?? "app").ToLowerInvariant();
            StringBuilder clean = new StringBuilder(slug.Length);
            foreach (char c in slug)
            {
                if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) clean.Append(c);
                else if (clean.Length > 0 && clean[clean.Length - 1] != '-') clean.Append('-');
            }
            slug = clean.ToString().Trim('-');
            if (slug.Length == 0) slug = "app";
            if (slug.Length > 24) slug = slug.Substring(0, 24);

            using (SHA256 sha = SHA256.Create())
            {
                byte[] hash = sha.ComputeHash(Encoding.UTF8.GetBytes(Path.GetFullPath(path).ToLowerInvariant()));
                StringBuilder hex = new StringBuilder(hash.Length * 2);
                foreach (byte b in hash) hex.Append(b.ToString("x2"));
                return slug + "-" + hex.ToString().Substring(0, 8);
            }
        }

        public static AppEntry FindById(List<AppEntry> apps, string id)
        {
            if (apps == null || string.IsNullOrEmpty(id)) return null;
            foreach (AppEntry entry in apps)
            {
                if (string.Equals(entry.Id, id, StringComparison.OrdinalIgnoreCase)) return entry;
            }
            return null;
        }

        public static bool IsSafeTarget(string path)
        {
            if (string.IsNullOrWhiteSpace(path)) return false;
            if (!string.Equals(Path.GetExtension(path), ".exe", StringComparison.OrdinalIgnoreCase)) return false;
            return File.Exists(path);
        }

        public static byte[] IconPng(AppEntry entry)
        {
            if (entry == null || !IsSafeTarget(entry.TargetPath)) return null;
            try
            {
                using (Icon icon = Icon.ExtractAssociatedIcon(entry.TargetPath))
                {
                    if (icon == null) return null;
                    using (Bitmap bitmap = icon.ToBitmap())
                    using (MemoryStream stream = new MemoryStream())
                    {
                        bitmap.Save(stream, ImageFormat.Png);
                        return stream.ToArray();
                    }
                }
            }
            catch
            {
                return null;
            }
        }

        public static string HashFile(string path)
        {
            using (SHA256 sha = SHA256.Create())
            using (FileStream stream = File.OpenRead(path))
            {
                byte[] hash = sha.ComputeHash(stream);
                StringBuilder text = new StringBuilder(hash.Length * 2);
                foreach (byte b in hash) text.Append(b.ToString("x2"));
                return text.ToString();
            }
        }

        [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);
        [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr window, int command);

        public static bool Launch(AppEntry entry, string auditFile, out string detail)
        {
            detail = "";
            if (entry == null)
            {
                detail = "no app selected";
                return false;
            }
            if (!IsSafeTarget(entry.TargetPath))
            {
                detail = "target is not an existing .exe";
                Audit(auditFile, "reject", entry, detail);
                return false;
            }

            try
            {
                string hash = HashFile(entry.TargetPath);
                if (!string.IsNullOrEmpty(entry.Sha256) &&
                    !string.Equals(hash, entry.Sha256, StringComparison.OrdinalIgnoreCase))
                {
                    detail = "target changed since it was selected";
                    Audit(auditFile, "reject", entry, detail);
                    return false;
                }
                entry.Sha256 = hash;

                foreach (Process running in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(entry.TargetPath)))
                {
                    using (running)
                    {
                        try
                        {
                            if (running.MainWindowHandle == IntPtr.Zero ||
                                !string.Equals(running.MainModule.FileName, entry.TargetPath, StringComparison.OrdinalIgnoreCase)) continue;
                            ShowWindow(running.MainWindowHandle, 9);
                            if (SetForegroundWindow(running.MainWindowHandle))
                            {
                                detail = "activated " + entry.Name + " sha256=" + hash;
                                Audit(auditFile, "activate", entry, detail);
                                return true;
                            }
                        }
                        catch { /* Windows may deny inspection or foreground activation. */ }
                    }
                }
                ProcessStartInfo info = new ProcessStartInfo(entry.TargetPath);
                info.UseShellExecute = true;
                info.WorkingDirectory = Path.GetDirectoryName(entry.TargetPath);
                Process.Start(info);
                detail = "launched " + entry.Name + " sha256=" + hash;
                Audit(auditFile, "launch", entry, detail);
                return true;
            }
            catch (Exception ex)
            {
                detail = ex.Message;
                Audit(auditFile, "error", entry, detail);
                return false;
            }
        }

        public static void AuditRejection(string file, string detail)
        {
            Audit(file, "reject", null, detail);
        }

        private static void Audit(string file, string action, AppEntry entry, string detail)
        {
            try
            {
                string line = DateTime.UtcNow.ToString("o") + "\t" + action + "\t" +
                    (entry == null ? "-" : entry.Name) + "\t" +
                    (entry == null ? "-" : entry.TargetPath) + "\t" + detail + "\r\n";
                File.AppendAllText(file, line);
            }
            catch
            {
                // Audit is best effort; launch behavior must not depend on it.
            }
        }
    }
}
