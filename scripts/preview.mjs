import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const build = spawnSync(
  process.execPath,
  [path.join(root, "node_modules", "vite", "bin", "vite.js"), "build", "web"],
  { cwd: root, stdio: "inherit" },
);
if (build.status !== 0) process.exit(build.status ?? 1);

const child = spawn(
  process.execPath,
  [path.join(root, "node_modules", "tsx", "dist", "cli.mjs"), "server/src/index.ts", "--no-open"],
  { cwd: root, stdio: "inherit", env: { ...process.env, FOCUSDOCK_DATA_DIR: path.join(root, ".tmp-data", "trial-preview"), FOCUSDOCK_PORT_STRICT: "1", FOCUSDOCK_PORT: process.env.FOCUSDOCK_PORT ?? "4317" } },
);

child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
