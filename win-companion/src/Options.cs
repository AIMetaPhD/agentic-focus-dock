using System;
using System.IO;

namespace FocusDock.Companion
{
    internal sealed class Options
    {
        public string Backend = "http://127.0.0.1:4317";
        public string TokenFile;
        public string AuditFile;
        public string LogFile;
        public bool IncludeTitles;
        public bool SelfTest;
        public bool ShowStatus;
        public bool ShowAppNames;
        public int ExitAfterSeconds;
        public int ControlPort = 4318;
        public string LaunchName;

        public static Options Parse(string[] args)
        {
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            Options o = new Options();
            o.TokenFile = Path.Combine(local, "FocusDock", "runtime", "bridge-token");
            o.AuditFile = Path.Combine(local, "FocusDock", "win-companion-audit.log");
            o.LogFile = Path.Combine(local, "FocusDock", "win-companion.log");

            for (int i = 0; i < args.Length; i++)
            {
                string arg = args[i] ?? "";
                if (arg == "--backend" && i + 1 < args.Length)
                {
                    o.Backend = args[++i];
                }
                else if (arg == "--token-file" && i + 1 < args.Length)
                {
                    o.TokenFile = args[++i];
                }
                else if (arg == "--audit-file" && i + 1 < args.Length)
                {
                    o.AuditFile = args[++i];
                }
                else if (arg == "--log-file" && i + 1 < args.Length)
                {
                    o.LogFile = args[++i];
                }
                else if (arg == "--titles")
                {
                    o.IncludeTitles = true;
                }
                else if (arg == "--self-test")
                {
                    o.SelfTest = true;
                }
                else if (arg == "--show-status")
                {
                    o.ShowStatus = true;
                }
                else if (arg == "--show-app-names")
                {
                    o.ShowAppNames = true;
                }
                else if (arg == "--launch" && i + 1 < args.Length)
                {
                    o.LaunchName = args[++i];
                }
                else if (arg == "--exit-after" && i + 1 < args.Length)
                {
                    int seconds;
                    if (int.TryParse(args[++i], out seconds) && seconds > 0) o.ExitAfterSeconds = seconds;
                }
                else if (arg == "--control-port" && i + 1 < args.Length)
                {
                    int controlPort;
                    if (int.TryParse(args[++i], out controlPort) && controlPort > 0 && controlPort < 65536)
                    {
                        o.ControlPort = controlPort;
                    }
                }
                else if (arg == "--help" || arg == "-h")
                {
                    PrintHelp();
                    Environment.Exit(0);
                }
            }

            o.Backend = o.Backend.TrimEnd('/');
            return o;
        }

        private static void PrintHelp()
        {
            Console.WriteLine("FocusDock Native Companion (Windows)");
            Console.WriteLine("  --backend <url>       default http://127.0.0.1:4317");
            Console.WriteLine("  --token-file <path>   default %LOCALAPPDATA%\\FocusDock\\runtime\\bridge-token");
            Console.WriteLine("  --audit-file <path>   launch audit log");
            Console.WriteLine("  --log-file <path>     companion log");
            Console.WriteLine("  --titles              include window titles (off by default)");
            Console.WriteLine("  --show-status         show the status window at startup");
            Console.WriteLine("  --show-app-names      show foreground app names in the status window");
            Console.WriteLine("  --launch <name>       launch a resolved Start Menu app by display name");
            Console.WriteLine("  --exit-after <sec>    test graceful teardown after N seconds");
            Console.WriteLine("  --control-port <n>    loopback web-launch endpoint, default 4318");
            Console.WriteLine("  --self-test           run local JSON/allowlist tests and exit");
        }
    }
}
