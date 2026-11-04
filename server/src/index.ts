import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { loadConfig, MAX_PORT_TRIES, PROTOCOL_VERSION } from "./config";
import { openStore } from "./store";
import { removeBridgeToken, startServer } from "./server";
import { writeSecretFile } from "./security";

function canListen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

async function findPort(start: number, strict: boolean): Promise<number> {
  for (let i = 0; i < (strict ? 1 : MAX_PORT_TRIES); i += 1) {
    const port = start + i;
    if (await canListen(port)) return port;
  }
  if (strict) throw new Error(`Port ${start} is busy and FOCUSDOCK_PORT_STRICT=1.`);
  throw new Error(`No free port in ${start}–${start + MAX_PORT_TRIES - 1}.`);
}

function openBrowser(url: string): void {
  try {
    const command =
      process.platform === "win32"
        ? { file: "cmd", args: ["/c", "start", "", url] }
        : process.platform === "darwin"
          ? { file: "open", args: [url] }
          : { file: "xdg-open", args: [url] };
    const child = spawn(command.file, command.args, { detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
  } catch {
    /* opening a browser is best effort */
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  if (process.argv.includes("--no-open")) config.openBrowser = false;
  fs.mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });

  const store = openStore(config.dbPath);
  store.prune(store.getSettings().privacy.retention_days);

  const port = await findPort(config.port, config.strictPort);
  const tokenPath = path.join(config.runtimeDir, "bridge-token");
  const token = crypto.randomBytes(32).toString("base64url");
  writeSecretFile(tokenPath, `${token}\n`);

  const { app, url } = await startServer({
    dataDir: config.dataDir,
    store,
    webDist: config.webDist,
    port,
    bridgeToken: token,
    bridgeTokenPath: tokenPath,
  });

  const cleanup = async () => {
    removeBridgeToken(tokenPath);
    try {
      await app.close();
    } catch {
      /* ignore */
    }
    try {
      store.close();
    } catch {
      /* ignore */
    }
  };

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const forceExit = setTimeout(() => process.exit(0), 3000);
    void cleanup().finally(() => {
      clearTimeout(forceExit);
      process.exit(0);
    });
  };

  if (process.env.FOCUSDOCK_MANAGED === "1") {
    process.stdin.resume();
    process.stdin.on("data", (data) => {
      if (String(data).trim() === "stop") shutdown();
    });
    process.stdin.on("end", shutdown);
  }

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  console.log("");
  console.log("  FocusDock AI — local-first focus dock");
  console.log(`  ➜  ${url}`);
  console.log(`  data:     ${config.dataDir}`);
  console.log(`  protocol: ${PROTOCOL_VERSION}   pid: ${process.pid}`);
  const bridgeLabel =
    process.platform === "darwin"
      ? "macOS companion"
      : process.platform === "win32"
        ? "Windows companion"
        : "no native companion";
  console.log(`  bridge:   ${bridgeLabel} · token file ${tokenPath}`);
  console.log("  system notifications: not intercepted (public-API limit)");
  console.log("  press Ctrl+C to stop");
  console.log("");

  if (config.openBrowser) openBrowser(url);
}

main().catch((error) => {
  console.error(`[focusdock] failed to start: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
