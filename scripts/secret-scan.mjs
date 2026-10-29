import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root })
  .toString("utf8")
  .split("\0")
  .filter(Boolean);

const patterns = [
  { name: "OpenAI-style key", re: /sk-[A-Za-z0-9_-]{24,}/g },
  { name: "GitHub token", re: /gh[pousr]_[A-Za-z0-9]{20,}/g },
  { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/g },
  { name: "Private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: "Assigned API key", re: /(?:API_KEY|SECRET_KEY|ACCESS_TOKEN)\s*=\s*["']?[A-Za-z0-9_-]{16,}/g },
];

const forbiddenNames = new Set([".env", "secrets.json", "bridge-token"]);
const skipExtensions = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".gz", ".woff", ".woff2",
]);
const skipFiles = new Set(["package-lock.json"]);

let failures = 0;
const report = (file, line, name, snippet) => {
  failures += 1;
  console.error(`${file}:${line}  ${name}  ${snippet.slice(0, 4)}***`);
};

for (const file of tracked) {
  if (forbiddenNames.has(path.basename(file))) {
    failures += 1;
    console.error(`${file}: forbidden secret file is tracked`);
    continue;
  }
  if (skipFiles.has(file) || skipExtensions.has(path.extname(file).toLowerCase())) continue;

  const absolute = path.join(root, file);
  let stat;
  try {
    stat = fs.statSync(absolute);
  } catch {
    continue;
  }
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) continue;

  const buffer = fs.readFileSync(absolute);
  if (buffer.includes(0)) continue;
  const text = buffer.toString("utf8");
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const { name, re } of patterns) {
      re.lastIndex = 0;
      const match = re.exec(line);
      if (!match) continue;
      // Allow the deliberately fake key used by the secret-storage test.
      if (match[0].startsWith("sk-test-1234567890")) continue;
      report(file, index + 1, name, match[0]);
    }
  }
}

if (failures > 0) {
  console.error(`\nSecret scan failed with ${failures} finding(s).`);
  process.exit(1);
}
console.log(`Secret scan clean: ${tracked.length} tracked files checked.`);
