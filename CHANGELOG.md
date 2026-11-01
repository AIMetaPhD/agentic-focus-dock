# Changelog

## 0.1.0 — 2026-11-01

First public release (private RC on 2026-10-30).

### Added

- Local-first Fastify + SQLite server on `127.0.0.1`, with one-command startup
  on Windows 11 and macOS.
- React dashboard: bottom dock, Writing/Building/Research/Meeting/Break/Social
  modes, pinned apps, manual lock, mode suggestion banner.
- Mode CRUD, reorder, export/import, restore defaults, version history and
  one-click rollback.
- Deterministic rules engine: allowlists, keywords, 15 s dwell, cooldown,
  manual lock; works offline with no API key.
- Notification queue: urgent surfacing, social deferral, `Stay` / `Later` /
  `Go to Social` with a server-enforced 30 s cool-down.
- AI Studio: natural-language → validated JSON Patch → visual diff → explicit
  apply → versioned rollback. Rules proposer plus Ollama and OpenAI-compatible
  adapters (opt-in, 20 s timeout, rules fallback).
- Activity timeline with source, decision, reason, confidence, engine, action.
- Settings: English/简体中文, AI provider, API key, retention, excluded apps,
  export/import, clear events, full reset.
- Capability panel with the honest macOS/notification limits and bridge token
  rotation.
- Security: Host/Origin allowlists, HttpOnly session, CSRF double-submit,
  WebSocket origin checks, scoped rotating bridge token, 64 KB body limit,
  rate limits, secret scan.
- Optional Swift `NSPanel` + `WKWebView` bridge source, `NSWorkspace` observer,
  Accessibility opt-in with bundle-id fallback, navigation allowlist, graceful
  teardown, macOS CI compile job.
- 69 automated tests (52 server, 4 web, 13 Playwright), evidence screenshots,
  architecture/API/threat-model/QA documentation.

### Known limitations

- macOS overlay runtime is **NOT VERIFIED** on real hardware.
- Global notification interception is unsupported by design.
- Ollama and cloud providers are implemented but not exercised against a live
  endpoint in this environment.
- No signed/notarized `.app`, no auto-update.
- Muse independent QA is **NOT VERIFIED**; the sub-agent report is supplementary
  evidence, not a Muse PASS. The owner explicitly authorized the public release
  on 2026-11-01.
- The profile README PR is merged.
