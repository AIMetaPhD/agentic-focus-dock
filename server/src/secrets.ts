import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * Minimal secret store. The cloud API key never enters SQLite, the web UI,
 * localStorage, git, or logs. It lives in a user-profile file with 0600
 * permissions (best-effort ACL on Windows) or in FOCUSDOCK_AI_KEY.
 */
export function secretsPath(dataDir: string): string {
  return path.join(dataDir, "secrets.json");
}

function harden(file: string): void {
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* best effort on filesystems without POSIX modes */
  }
  if (process.platform === "win32" && process.env.USERNAME) {
    try {
      execFileSync(
        "icacls",
        [file, "/inheritance:r", "/grant:r", `${process.env.USERNAME}:F`],
        { stdio: "ignore", windowsHide: true },
      );
    } catch {
      /* keep the file usable even if ACL hardening is unavailable */
    }
  }
}

export function readApiKey(dataDir: string): string | null {
  const env = process.env.FOCUSDOCK_AI_KEY;
  if (env && env.trim()) return env.trim();
  try {
    const raw = fs.readFileSync(secretsPath(dataDir), "utf8");
    const parsed = JSON.parse(raw) as { openai_api_key?: unknown };
    return typeof parsed.openai_api_key === "string" && parsed.openai_api_key.trim()
      ? parsed.openai_api_key.trim()
      : null;
  } catch {
    return null;
  }
}

export function writeApiKey(dataDir: string, key: string | null): void {
  const file = secretsPath(dataDir);
  if (!key) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {
      /* ignore */
    }
    return;
  }
  fs.writeFileSync(file, JSON.stringify({ openai_api_key: key }, null, 2), { mode: 0o600 });
  harden(file);
}

export function hasApiKey(dataDir: string): boolean {
  return readApiKey(dataDir) !== null;
}
