# FocusDock AI v0.1.0

**A local-first, AI-native focus dock with customizable modes and an optional macOS companion.**

This is the first public release. It is a real, runnable local web app — not a
mockup. Everything runs on `127.0.0.1`; there is no account, no telemetry, and
no cloud key requirement.

## What works

- Bottom capsule dock with six editable modes, pinned apps, colors and manual lock.
- Deterministic offline rules: allowlists, keywords, 15 s dwell, cooldown, hysteresis.
- Notification queue with a 30 s switch cool-down and `Stay` / `Later` /
  `Go to Social`; `Later` never launches an app.
- AI Studio: natural-language instruction → validated JSON Patch → visible diff →
  explicit apply → versioned rollback. Rules provider works offline; Ollama and
  OpenAI-compatible adapters are opt-in.
- SQLite persistence, export/import, restore defaults, timeline and audit log.
- English / 简体中文 UI, including an honest capability panel.
- Loopback security: Host/Origin allowlists, HttpOnly session, CSRF double-submit,
  WebSocket origin checks, scoped rotating bridge token, 64 KB body limit,
  rate limits, no CORS.
- Optional Swift `NSPanel` + `WKWebView` bridge source, compiled and unit-tested
  on a macOS 14 CI runner.

## Verified

- Windows 11: `npm ci`, typecheck, lint, 56 unit/integration tests, build and
  13 Playwright tests pass.
- CI run `40957464211` on commit `ea3ef86`: Ubuntu web tests, macOS 14 Swift
  build/tests, secret scan and runtime audit all green.
- A fresh-context Claude sub-agent independently re-ran the suite and black-box
  probes B1–B15 in an isolated worktree; no Sev0/Sev1 finding.

## Not verified — read before relying on it

- **macOS floating panel / Accessibility runtime is NOT VERIFIED.** The Swift
  source and macOS CI compile are present, but no Apple Silicon device was
  available. Do not treat the bridge as production-ready.
- **Live Ollama / OpenAI-compatible endpoints were not exercised.** Only the
  rules provider and synthetic malicious-output rejection were tested.
- **Muse independent QA is NOT VERIFIED.** Three Muse dispatches were blocked by
  the Muse VM/harness (repository access, then an opaque-snapshot rejection); no
  Muse test executed. The product owner accepted the sub-agent verification as
  supplementary evidence and explicitly authorized this public release on
  2026-11-01. **This is not a Muse sign-off.**
- Global system-notification interception is unsupported by public Apple APIs
  and is not claimed.
- No signed/notarized `.app` and no auto-update.

## Install

```bash
git clone https://github.com/AIMetaPhD/agentic-focus-dock.git
cd agentic-focus-dock
npm install
npm start
```

Node.js 22.5+ (Node 24 recommended). The server listens on
`http://127.0.0.1:4317` and tries 4318–4327 if the port is busy.

## License

MIT. See `LICENSE` and `NOTICE.md`.
