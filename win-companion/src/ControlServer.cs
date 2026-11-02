using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

namespace FocusDock.Companion
{
    /// <summary>
    /// Loopback-only command endpoint for the web UI. It never accepts an
    /// arbitrary path or command line; launch requests carry a catalog id.
    /// </summary>
    internal sealed class ControlServer : IDisposable
    {
        private readonly string token;
        private readonly int port;
        private readonly string auditFile;
        private readonly Action<string> log;
        private readonly object cacheLock = new object();
        private readonly Dictionary<string, byte[]> icons = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);
        private List<AppEntry> apps;
        private TcpListener listener;
        private Thread thread;
        private volatile bool running;

        public ControlServer(string token, int port, string auditFile, Action<string> log)
        {
            this.token = token;
            this.port = port;
            this.auditFile = auditFile;
            this.log = log;
        }

        public void Start()
        {
            listener = new TcpListener(IPAddress.Loopback, port);
            listener.Start();
            running = true;
            thread = new Thread(AcceptLoop);
            thread.IsBackground = true;
            thread.Start();
            log("control server listening on 127.0.0.1:" + port);
        }

        private void AcceptLoop()
        {
            while (running)
            {
                try
                {
                    TcpClient client = listener.AcceptTcpClient();
                    ThreadPool.QueueUserWorkItem(HandleClient, client);
                }
                catch
                {
                    if (running) log("control accept error");
                }
            }
        }

        private void HandleClient(object state)
        {
            TcpClient client = state as TcpClient;
            if (client == null) return;
            try
            {
                using (client)
                {
                    client.ReceiveTimeout = 5000;
                    using (NetworkStream stream = client.GetStream())
                    using (StreamReader reader = new StreamReader(stream, Encoding.UTF8, false, 1024, true))
                    {
                        string requestLine = reader.ReadLine();
                        if (string.IsNullOrEmpty(requestLine)) return;
                        string[] request = requestLine.Split(' ');
                        if (request.Length < 2) return;
                        string method = request[0];
                        string path = request[1];
                        Dictionary<string, string> headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                        string line;
                        while (!string.IsNullOrEmpty(line = reader.ReadLine()))
                        {
                            int colon = line.IndexOf(':');
                            if (colon > 0) headers[line.Substring(0, colon).Trim()] = line.Substring(colon + 1).Trim();
                        }

                        if (headers.ContainsKey("Origin"))
                        {
                            WriteJson(stream, 403, "Forbidden", "{\"error\":\"origin_not_allowed\"}");
                            return;
                        }
                        string auth;
                        if (!headers.TryGetValue("Authorization", out auth) ||
                            !string.Equals(auth, "Bearer " + token, StringComparison.Ordinal))
                        {
                            WriteJson(stream, 401, "Unauthorized", "{\"error\":\"unauthorized\"}");
                            return;
                        }

                        int length = 0;
                        string contentLength;
                        if (headers.TryGetValue("Content-Length", out contentLength)) int.TryParse(contentLength, out length);
                        if (length < 0 || length > 8192)
                        {
                            WriteJson(stream, 413, "Payload Too Large", "{\"error\":\"payload_too_large\"}");
                            return;
                        }
                        char[] buffer = new char[length];
                        int read = 0;
                        while (read < length)
                        {
                            int count = reader.Read(buffer, read, length - read);
                            if (count <= 0) break;
                            read += count;
                        }
                        string body = new string(buffer, 0, read);

                        if (method == "GET" && path == "/apps")
                        {
                            WriteJson(stream, 200, "OK", AppsJson());
                        }
                        else if (method == "GET" && (path == "/icon" || path.StartsWith("/icon?")))
                        {
                            string iconId = QueryValue(path, "id");
                            AppEntry iconEntry = AppCatalog.FindById(GetApps(), iconId);
                            byte[] icon = iconEntry == null ? null : GetIcon(iconEntry);
                            if (icon == null)
                            {
                                WriteJson(stream, 404, "Not Found", "{\"error\":\"icon_not_found\"}");
                            }
                            else
                            {
                                WriteBinary(stream, 200, "OK", "image/png", icon);
                            }
                        }
                        else if (method == "POST" && path == "/launch")
                        {
                            Match match = Regex.Match(body, "\"id\"\\s*:\\s*\"([^\"]{1,128})\"");
                            if (!match.Success)
                            {
                                WriteJson(stream, 400, "Bad Request", "{\"error\":\"missing_id\"}");
                                return;
                            }
                            AppEntry entry = AppCatalog.FindById(GetApps(), match.Groups[1].Value);
                            if (entry == null)
                            {
                                WriteJson(stream, 404, "Not Found", "{\"error\":\"unknown_app\"}");
                                return;
                            }
                            string detail;
                            bool ok = AppCatalog.Launch(entry, auditFile, out detail);
                            string response = "{\"ok\":" + (ok ? "true" : "false") + ",\"detail\":" + Json.Quote(detail) + "}";
                            WriteJson(stream, ok ? 200 : 500, ok ? "OK" : "Internal Server Error", response);
                        }
                        else
                        {
                            WriteJson(stream, 404, "Not Found", "{\"error\":\"not_found\"}");
                        }
                    }
                }
            }
            catch
            {
                // A malformed client must not stop the listener.
            }
        }

        private List<AppEntry> GetApps()
        {
            lock (cacheLock)
            {
                if (apps == null) apps = AppCatalog.Load();
                return apps;
            }
        }

        private byte[] GetIcon(AppEntry entry)
        {
            lock (cacheLock)
            {
                byte[] icon;
                if (icons.TryGetValue(entry.Id, out icon)) return icon;
                icon = AppCatalog.IconPng(entry);
                if (icon != null) icons[entry.Id] = icon;
                return icon;
            }
        }

        private static string QueryValue(string path, string key)
        {
            int question = path.IndexOf('?');
            if (question < 0) return null;
            string query = path.Substring(question + 1);
            string[] parts = query.Split('&');
            foreach (string part in parts)
            {
                int equals = part.IndexOf('=');
                if (equals <= 0) continue;
                if (!string.Equals(part.Substring(0, equals), key, StringComparison.OrdinalIgnoreCase)) continue;
                return Uri.UnescapeDataString(part.Substring(equals + 1));
            }
            return null;
        }

        private string AppsJson()
        {
            List<AppEntry> list = GetApps();
            StringBuilder json = new StringBuilder();
            json.Append("{\"apps\":[");
            for (int i = 0; i < list.Count; i++)
            {
                if (i > 0) json.Append(',');
                json.Append("{\"id\":").Append(Json.Quote(list[i].Id));
                json.Append(",\"name\":").Append(Json.Quote(list[i].Name));
                json.Append('}');
            }
            json.Append("]}");
            return json.ToString();
        }

        private static void WriteJson(NetworkStream stream, int status, string reason, string json)
        {
            WriteBody(stream, status, reason, "application/json; charset=utf-8", Encoding.UTF8.GetBytes(json));
        }

        private static void WriteBinary(NetworkStream stream, int status, string reason, string contentType, byte[] payload)
        {
            WriteBody(stream, status, reason, contentType, payload);
        }

        private static void WriteBody(NetworkStream stream, int status, string reason, string contentType, byte[] payload)
        {
            string head = "HTTP/1.1 " + status + " " + reason + "\r\n" +
                "Content-Type: " + contentType + "\r\n" +
                "Content-Length: " + payload.Length + "\r\n" +
                "Cache-Control: private, max-age=300\r\n" +
                "Connection: close\r\n\r\n";
            byte[] headBytes = Encoding.ASCII.GetBytes(head);
            stream.Write(headBytes, 0, headBytes.Length);
            stream.Write(payload, 0, payload.Length);
            stream.Flush();
        }

        public void Dispose()
        {
            running = false;
            if (listener != null)
            {
                try { listener.Stop(); } catch { }
                listener = null;
            }
            if (thread != null)
            {
                try { thread.Join(1000); } catch { }
                thread = null;
            }
        }
    }
}
