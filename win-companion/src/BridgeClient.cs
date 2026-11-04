using System;
using System.IO;
using System.Net;
using System.Text;

namespace FocusDock.Companion
{
    internal sealed class BridgeClient
    {
        private readonly string backend;
        private readonly string token;

        public string LastError { get; private set; }

        public BridgeClient(string backend, string token)
        {
            this.backend = backend;
            this.token = token;
        }

        public static string ReadToken(string path)
        {
            if (!File.Exists(path))
            {
                throw new FileNotFoundException("Bridge token file was not found.", path);
            }
            string value = File.ReadAllText(path).Trim();
            if (value.Length < 16)
            {
                throw new InvalidOperationException("Bridge token file is empty or invalid.");
            }
            return value;
        }

        public bool Heartbeat()
        {
            string body =
                "{\"bridge_version\":\"0.2.0-win\",\"capabilities\":{" +
                "\"platform\":\"windows\"," +
                "\"activity\":\"win32-foreground\"," +
                "\"launch\":\"allowlist\"," +
                "\"notifications\":\"unsupported\"," +
                "\"overlay\":\"tray\"}}";
            return Post("/api/bridge/heartbeat", body);
        }

        public bool Activity(string appId, string appName, string title, double stableSeconds, string dedupeKey)
        {
            StringBuilder payload = new StringBuilder();
            payload.Append("{");
            payload.Append("\"app_id\":").Append(Json.Quote(appId));
            payload.Append(",\"app_name\":").Append(Json.Quote(appName));
            payload.Append(",\"stable_seconds\":").Append(stableSeconds.ToString("0.###"));
            if (!string.IsNullOrEmpty(title))
            {
                payload.Append(",\"title\":").Append(Json.Quote(title));
            }
            payload.Append("}");

            StringBuilder body = new StringBuilder();
            body.Append("{");
            body.Append("\"kind\":\"activity\",");
            body.Append("\"source_app\":").Append(Json.Quote(appName)).Append(",");
            body.Append("\"dedupe_key\":").Append(Json.Quote(dedupeKey)).Append(",");
            body.Append("\"payload\":").Append(payload.ToString());
            body.Append("}");
            return Post("/api/bridge/events", body.ToString());
        }

        public bool Disconnect()
        {
            return Post("/api/bridge/disconnect", "{}");
        }

        private bool Post(string path, string json)
        {
            try
            {
                using (WebClient client = new WebClient())
                {
                    client.Proxy = null;
                    client.Encoding = Encoding.UTF8;
                    client.Headers[HttpRequestHeader.Authorization] = "Bearer " + token;
                    client.Headers[HttpRequestHeader.ContentType] = "application/json";
                    client.UploadString(backend + path, "POST", json);
                }
                LastError = null;
                return true;
            }
            catch (Exception ex)
            {
                LastError = ex.Message;
                return false;
            }
        }
    }
}
