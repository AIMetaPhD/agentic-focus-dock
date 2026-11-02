# Scope — P0 / P1 / Later

Locked after G0. Gemini's blockers are incorporated: no global notification
interception, loopback hardening, GPL isolation, Jev removed from the critical path.

## P0 — must be real in this release

- Local web app starts with one command on Windows 11 and macOS (browser core).
- Bottom capsule dock: Writing (amber), Building (blue), Research, Meeting, Break;
  click to switch; pinned apps; running indicators; responsive and keyboard accessible.
- Mode CRUD: create, edit, delete, reorder, duplicate, export/import, restore defaults;
  every change persists in SQLite and survives restart.
- Deterministic rules engine: app mapping, keywords, time windows, allowlist,
  15 s dwell, hysteresis/cooldown, manual lock; works offline with no API key.
- Notification flow: simulated non-urgent social notification → defer → `Stay` /
  `Later` / `Go to Social (30 s wait)`; visible cancellable countdown; explicit
  `simulated` provenance; urgent notifications surface immediately.
- Activity timeline: source, classification, confidence, reason, engine, executed vs
  suggested, dedupe.
- AI mode proposals: natural language → schema-validated JSON Patch → visual diff →
  explicit apply → version bump → rollback; deterministic offline proposer; optional
  Ollama / OpenAI-compatible adapters with timeout and fallback.
- Privacy: metadata-only storage, retention, per-app exclusion, clear-all, export.
- Capability panel that states honestly what is and is not supported.
- Security: loopback bind, Host/Origin allowlists, HttpOnly session, CSRF
  double-submit, scoped rotating bridge token, body limits, rate limits.
- macOS Swift bridge source: NSPanel + WKWebView `/dock`, NSWorkspace observer,
  optional AX, future action allowlist (no launch API in v0.1.0), graceful teardown.

**v0.1.0 delivery note (2026-11-02):** the bridge observes the frontmost app and
renders `/dock`; it does **not** implement app launch. Pinned tiles are
labels/bookmarks. A separate unreleased Windows companion spike on `main`
implements a Start Menu picker and allowlisted `.exe` launch; that is not part of
the v0.1.0 Release or the web dock.

## P1 — implemented in this release where cheap, otherwise documented

- Accessibility (AX) window titles, opt-in with bundle-id fallback (Swift source only).
- Multi-display positioning and full-screen behaviour (Swift source only).
- i18n: English + Simplified Chinese UI.

## Later — explicitly not in v1

- Third-party connectors (Slack OAuth, GitHub webhooks) and any claim of global
  notification suppression.
- Global hotkeys, Spaces/multi-display auto-follow algorithms beyond basic behaviour.
- Arbitrary shell/AppleScript execution by the agent.
- Signed/notarized macOS binary and auto-update.

## Non-negotiables

- No `killall Dock`, no `com.apple.dock` writes, no SIP changes, no private APIs.
- No copying GPL-3.0 or all-rights-reserved code/assets.
- No cloud AI by default; no activity contents leave the machine unless opted in.
- Public release and the profile README PR required the user's explicit approval;
  both were approved on 2026-11-01.
