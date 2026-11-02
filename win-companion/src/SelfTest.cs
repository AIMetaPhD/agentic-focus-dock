using System;
using System.IO;

namespace FocusDock.Companion
{
    internal static class SelfTest
    {
        public static int Run()
        {
            int failures = 0;
            Check("JSON quotes and control characters", Json.Quote("a\"b\\c\n").Equals("\"a\\\"b\\\\c\\n\""), ref failures);
            Check("accept existing .exe", AppCatalog.IsSafeTarget(Path.Combine(Environment.SystemDirectory, "notepad.exe")), ref failures);
            Check("reject .txt target", !AppCatalog.IsSafeTarget(Path.Combine(Path.GetTempPath(), "focusdock-not-an-app.txt")), ref failures);
            Check("reject missing .exe", !AppCatalog.IsSafeTarget(Path.Combine(Path.GetTempPath(), "focusdock-missing-app.exe")), ref failures);

            bool missingTokenRejected = false;
            try
            {
                BridgeClient.ReadToken(Path.Combine(Path.GetTempPath(), "focusdock-missing-token"));
            }
            catch
            {
                missingTokenRejected = true;
            }
            Check("reject missing bridge token", missingTokenRejected, ref failures);

            Console.WriteLine(failures == 0 ? "SELF-TEST PASS" : "SELF-TEST FAIL");
            return failures == 0 ? 0 : 1;
        }

        private static void Check(string name, bool ok, ref int failures)
        {
            Console.WriteLine((ok ? "PASS " : "FAIL ") + name);
            if (!ok) failures++;
        }
    }
}
