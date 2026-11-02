using System;
using System.IO;
using System.Windows.Forms;

namespace FocusDock.Companion
{
    internal static class Program
    {
        private static readonly object LogLock = new object();
        private static Options options;

        [STAThread]
        private static void Main(string[] args)
        {
            options = Options.Parse(args);
            if (options.SelfTest)
            {
                Environment.Exit(SelfTest.Run());
                return;
            }

            if (!string.IsNullOrEmpty(options.LaunchName))
            {
                Environment.Exit(LaunchByName(options.LaunchName));
                return;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.ThreadException += delegate(object sender, System.Threading.ThreadExceptionEventArgs e)
            {
                Log("UI exception: " + e.Exception);
                MessageBox.Show("FocusDock companion error:\n" + e.Exception.Message, "FocusDock Native Companion", MessageBoxButtons.OK, MessageBoxIcon.Error);
            };
            AppDomain.CurrentDomain.UnhandledException += delegate(object sender, UnhandledExceptionEventArgs e)
            {
                Log("fatal exception: " + e.ExceptionObject);
            };

            string token;
            try
            {
                token = BridgeClient.ReadToken(options.TokenFile);
            }
            catch (Exception ex)
            {
                Log("token error: " + ex.Message);
                MessageBox.Show(
                    "FocusDock companion cannot read the bridge token:\n" + ex.Message +
                    "\n\nStart FocusDock first, or pass --token-file <path>.",
                    "FocusDock Native Companion",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                Environment.Exit(2);
                return;
            }

            BridgeClient client = new BridgeClient(options.Backend, token);
            ControlServer control = new ControlServer(token, options.ControlPort, options.AuditFile, Log);
            try
            {
                control.Start();
            }
            catch (Exception ex)
            {
                Log("control server error: " + ex.Message);
                MessageBox.Show(
                    "FocusDock companion could not listen on 127.0.0.1:" + options.ControlPort +
                    ".\n\nThe native tray and foreground events still work, but web-triggered launches are unavailable.\n\n" + ex.Message,
                    "FocusDock Native Companion",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
            }

            ForegroundMonitor monitor = new ForegroundMonitor(client, options.IncludeTitles, Log);
            try
            {
                monitor.Start();
            }
            catch (Exception ex)
            {
                Log("monitor error: " + ex.Message);
                MessageBox.Show("FocusDock companion could not start the foreground monitor:\n" + ex.Message, "FocusDock Native Companion", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Environment.Exit(3);
                return;
            }

            TrayContext tray = new TrayContext(client, monitor, control, options);
            Log("companion started; backend=" + options.Backend);
            Application.Run(tray);
        }

        private static int LaunchByName(string name)
        {
            System.Collections.Generic.List<AppEntry> apps = AppCatalog.Load();
            AppEntry match = null;
            foreach (AppEntry entry in apps)
            {
                if (string.Equals(entry.Name, name, StringComparison.OrdinalIgnoreCase))
                {
                    match = entry;
                    break;
                }
            }
            if (match == null)
            {
                foreach (AppEntry entry in apps)
                {
                    if (entry.Name.IndexOf(name, StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        match = entry;
                        break;
                    }
                }
            }
            if (match == null)
            {
                Console.WriteLine("LAUNCH REJECTED: no installed app matches '" + name + "'");
                return 4;
            }
            string detail;
            bool ok = AppCatalog.Launch(match, options.AuditFile, out detail);
            Console.WriteLine((ok ? "LAUNCH OK: " : "LAUNCH REJECTED: ") + detail);
            return ok ? 0 : 5;
        }

        private static void Log(string message)
        {
            string line = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + message;
            Console.WriteLine(line);
            try
            {
                string directory = Path.GetDirectoryName(options.LogFile);
                if (!string.IsNullOrEmpty(directory)) Directory.CreateDirectory(directory);
                lock (LogLock)
                {
                    File.AppendAllText(options.LogFile, line + "\r\n");
                }
            }
            catch
            {
                // Logging must never stop the companion.
            }
        }
    }
}
