# Security Policy

## Supported versions

Only the latest `0.1.x` line receives security fixes while the project is in
pre-release.

## Reporting a vulnerability

Please use GitHub's **private vulnerability reporting** on
`AIMetaPhD/agentic-focus-dock` (Security → Report a vulnerability). Do not open a
public issue for a suspected vulnerability. Include reproduction steps, the
version/commit, and the observed impact. We aim to acknowledge within 5 working
days.

## Security design

FocusDock is a loopback-only application. The full threat model is in
[`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).

- **Network**: binds `127.0.0.1` only. No `0.0.0.0`, no LAN access.
- **Host**: every request must carry a loopback `Host` header, which blocks
  DNS-rebinding pages.
- **Origin**: mutations and WebSocket upgrades require an exact
  `http://127.0.0.1:<port>` or `http://localhost:<port>` origin.
- **Session**: a random per-run session id in an `HttpOnly; SameSite=Strict`
  cookie. The CSRF token is a separate double-submit cookie read by the UI and
  sent as `X-FocusDock-CSRF`; cross-origin pages can do neither.
- **No CORS**: no `Access-Control-Allow-Origin` is emitted, so cross-origin
  reads are blocked by the browser.
- **Bridge**: a separate 32-byte token, scoped to `/api/bridge/*`, written to
  `runtime/bridge-token` with best-effort `0600` permissions, rotated on every
  server start and deleted on clean shutdown. A browser `Origin` on a bridge
  request is rejected.
- **Secrets**: the cloud API key lives in `secrets.json` outside SQLite, is
  never returned by the API, and is excluded from logs and exports.
- **AI output**: model responses are untrusted. They are parsed as a
  constrained JSON Patch over `/modes/*`, validated for path, field, type and
  range, then shown to the user for explicit confirmation. No shell, AppleScript,
  network, or OS action is ever generated or executed.
- **Desktop**: the Swift bridge may only navigate its WebView to the local dock
  shell and assets. It cannot launch arbitrary apps, and it does not touch the
  system Dock, SIP, or other apps' notification databases.

## What is explicitly out of scope

- A local process running as the same user can read the SQLite file and the
  bridge token file. This is inherent to a local-first desktop app and is
  documented rather than mitigated with elevated privileges.
- Another app's notifications, keystrokes, clipboard, screen contents, and
  browser history are never collected.
- A user who enables a cloud provider is choosing to send their prompt (and,
  only if they opt in, recent activity summaries) to that endpoint.

## If you think a token leaked

1. Stop the server (`Ctrl+C`). The bridge token is invalidated and its file
   removed.
2. Restart. A new session and bridge token are generated.
3. If you saved a cloud API key, rotate it at the provider and re-enter it in
   Settings.

## Repository hygiene

CI runs `node scripts/secret-scan.mjs` over every tracked file, plus
`npm audit --omit=dev --audit-level=high`. Screenshots used in documentation are
generated from synthetic demo data; no private paths, keys or personal activity
are included.
