import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "qa", "e2e-data");
fs.rmSync(dataDir, { recursive: true, force: true });

const build = spawnSync(
  process.execPath,
  [path.join(root, "node_modules", "vite", "bin", "vite.js"), "build", "web"],
  { cwd: root, stdio: "inherit" },
);
if (build.status !== 0) process.exit(build.status ?? 1);

const child = spawn(
  process.execPath,
  [path.join(root, "node_modules", "tsx", "dist", "cli.mjs"), "server/src/index.ts", "--no-open"],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      FOCUSDOCK_DATA_DIR: dataDir,
      FOCUSDOCK_PORT: "4317",
      FOCUSDOCK_PORT_STRICT: "1",
      FOCUSDOCK_NO_OPEN: "1",
    },
  },
);

child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
