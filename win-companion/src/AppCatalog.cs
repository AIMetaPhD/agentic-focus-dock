using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;

namespace FocusDock.Companion
{
    internal sealed class AppEntry
    {
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

        public static bool IsSafeTarget(string path)
        {
            if (string.IsNullOrWhiteSpace(path)) return false;
            if (!string.Equals(Path.GetExtension(path), ".exe", StringComparison.OrdinalIgnoreCase)) return false;
            return File.Exists(path);
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
