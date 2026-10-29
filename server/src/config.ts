import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const APP_NAME = "FocusDock";
export const APP_VERSION = "0.1.0";
export const PROTOCOL_VERSION = 1;
export const DEFAULT_PORT = 4317;
export const MAX_PORT_TRIES = 11;

export function defaultDataDir(): string {
  if (process.env.FOCUSDOCK_DATA_DIR) return path.resolve(process.env.FOCUSDOCK_DATA_DIR);
  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    return path.join(base, APP_NAME);
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", APP_NAME);
  }
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"), "focusdock");
}

export type AppConfig = {
  dataDir: string;
  dbPath: string;
  runtimeDir: string;
  webDist: string;
  port: number;
  strictPort: boolean;
  openBrowser: boolean;
  allowedOrigins: (port: number) => string[];
};

export function loadConfig(): AppConfig {
  const dataDir = defaultDataDir();
  const runtimeDir = path.join(dataDir, "runtime");
  fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });

  return {
    dataDir,
    dbPath: path.join(dataDir, "focusdock.db"),
    runtimeDir,
    webDist: path.resolve(process.cwd(), "web", "dist"),
    port: Number(process.env.FOCUSDOCK_PORT || DEFAULT_PORT),
    strictPort: process.env.FOCUSDOCK_PORT_STRICT === "1",
    openBrowser: process.env.FOCUSDOCK_NO_OPEN !== "1",
    allowedOrigins: (port: number) => [
      `http://127.0.0.1:${port}`,
      `http://localhost:${port}`,
    ],
  };
}

export function isAllowedHost(host: string | undefined, port: number): boolean {
  if (!host) return false;
  const trimmed = host.trim().toLowerCase();
  return (
    trimmed === `127.0.0.1:${port}` ||
    trimmed === `localhost:${port}` ||
    trimmed === `[::1]:${port}`
  );
}

export function isAllowedOrigin(
  origin: string | undefined,
  port: number,
  requireOrigin: boolean,
): boolean {
  if (origin === undefined) return !requireOrigin;
  const trimmed = origin.trim().toLowerCase();
  return (
    trimmed === `http://127.0.0.1:${port}` ||
    trimmed === `http://localhost:${port}` ||
    trimmed === `http://[::1]:${port}`
  );
}
