using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;

namespace FocusDock.Companion
{
    // Owns only the backend started by this launcher. Closing stdin also stops it
    // when the native process crashes, without killing unrelated Node processes.
    internal sealed class TrialSession : IDisposable
    {
        private Process server;
        public readonly string DataDir;
        public readonly string Backend = "http://127.0.0.1:4317";
        public string TokenFile { get { return Path.Combine(DataDir, "runtime", "bridge-token"); } }

        public TrialSession(string projectRoot, string dataDir)
        {
            DataDir = dataDir;
            CheckPort(4317);
            CheckPort(4318);
            string index = Path.Combine(projectRoot, "node_modules", "tsx", "dist", "loader.mjs");
            if (!File.Exists(index) || !File.Exists(Path.Combine(projectRoot, "web", "dist", "index.html")))
                throw new InvalidOperationException("缺少已构建的前端或依赖，请运行 Start-FocusDock.cmd；首次使用需先 npm install。");
            Directory.CreateDirectory(Path.Combine(DataDir, "runtime"));
            ProcessStartInfo info = new ProcessStartInfo("node", "--import " + Quote(new Uri(index).AbsoluteUri) + " server/src/index.ts --no-open");
            info.WorkingDirectory = projectRoot;
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.RedirectStandardInput = true;
            info.RedirectStandardOutput = true;
            info.RedirectStandardError = true;
            info.EnvironmentVariables["FOCUSDOCK_DATA_DIR"] = DataDir;
            info.EnvironmentVariables["FOCUSDOCK_NO_OPEN"] = "1";
            info.EnvironmentVariables["FOCUSDOCK_PORT_STRICT"] = "1";
            info.EnvironmentVariables["FOCUSDOCK_MANAGED"] = "1";
            server = new Process();
            server.StartInfo = info;
            // Consume output without persisting tokens, paths or private activity.
            server.OutputDataReceived += delegate { };
            server.ErrorDataReceived += delegate { };
            try
            {
                server.Start();
                server.BeginOutputReadLine();
                server.BeginErrorReadLine();
                DateTime deadline = DateTime.UtcNow.AddSeconds(25);
                while (DateTime.UtcNow < deadline)
                {
                    if (server.HasExited) throw new InvalidOperationException("后端启动失败。请检查 Node 版本（>=22.5）、数据目录权限和端口，然后重新运行启动脚本。");
                    try
                    {
                        HttpWebRequest request = (HttpWebRequest)WebRequest.Create(Backend + "/api/health");
                        request.Proxy = null;
                        request.Timeout = 500;
                        using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                        {
                            if (response.StatusCode == HttpStatusCode.OK && File.Exists(TokenFile)) return;
                        }
                    }
                    catch (WebException) { }
                    Thread.Sleep(150);
                }
                throw new InvalidOperationException("启动超过 25 秒。退出后检查数据目录权限，重新运行 Start-FocusDock.cmd。");
            }
            catch { Dispose(); throw; }
        }

        private static void CheckPort(int port)
        {
            System.Net.Sockets.TcpListener listener = new System.Net.Sockets.TcpListener(IPAddress.Loopback, port);
            try { listener.Start(); }
            catch { throw new InvalidOperationException("端口 " + port + " 已占用。请先从托盘退出已有 FocusDock；若是其他程序占用，请关闭冲突程序后重试。不会自动终止其他进程。"); }
            finally { listener.Stop(); }
        }

        private static string Quote(string value) { return "\"" + value + "\""; }

        public void Dispose()
        {
            if (server == null) return;
            try
            {
                if (!server.HasExited)
                {
                    server.StandardInput.WriteLine("stop");
                    server.StandardInput.Close();
                    if (!server.WaitForExit(5000)) server.Kill();
                }
            }
            catch { /* child may already have exited */ }
            server.Dispose();
            server = null;
        }
    }
}
