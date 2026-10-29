# ADR-001 — Architecture

Status: accepted, 2026-10-30.

## Decision

One local Node.js process serves both the API and the built React app on
`127.0.0.1`. SQLite is accessed through Node's built-in `node:sqlite`. The optional
macOS companion is a separate Swift package that loads the same `/dock` route in a
`WKWebView` inside an `NSPanel` and talks to the server over loopback with a scoped
Bearer token.

```
┌────────────────────────────── browser (any OS) ──────────────────────────────┐
│  React 19 + TS + Vite build  ──  /            dashboard                      │
│                              ──  /dock        shared dock surface (also WKWebView) │
└───────────────────────────────┬──────────────────────────────────────────────┘
                    same-origin HTTP + WS (HttpOnly session cookie,
                    CSRF double-submit, Origin/Host allowlist)
┌───────────────────────────────▼──────────────────────────────────────────────┐
│  Fastify 5 on 127.0.0.1:<port>                                                │
│   domain: modes · versions · rules · events · notifications · proposals       │
│   storage: SQLite (WAL) + migrations · audit log · settings                   │
│   adapters: RulesEngine (always) · Ollama · OpenAI-compatible (opt-in)        │
└───────────────────────────────┬──────────────────────────────────────────────┘
                    loopback HTTP, Bearer bridge token (0600, per-run)
┌───────────────────────────────▼──────────────────────────────────────────────┐
│  optional macOS Swift bridge (NSPanel + WKWebView + NSWorkspace)              │
│   capabilities reported honestly; AX is opt-in and degrades to bundle id      │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Why Node/TypeScript instead of FastAPI + SQLite

The plan allowed an equivalent stack with justification. Reasons:

1. **One runtime for the end user.** `npm install && npm start` needs only Node.
   FastAPI would require a second runtime (Python + venv) on every user machine,
   doubling install failure modes on Windows.
2. **One language across server, UI, and tests**, so the mode schema, proposal patch
   types, and event contracts are defined once (`server/src/domain/schemas.ts`).
3. **No native build step.** `node:sqlite` is built into Node 24; no `better-sqlite3`
   compilation, no Visual Studio Build Tools on Windows, no Xcode CLT on macOS.
4. Fastify 5, `ws`, React, and Vite are all MIT and mature; nothing here is exotic.

Trade-off accepted: `node:sqlite` is still marked experimental (it prints a warning
on Node 24). It is isolated behind `server/src/db.ts` so it can be swapped for
`better-sqlite3` without touching domain code.

## Security architecture

- Bind `127.0.0.1` only. Refuse to start on `0.0.0.0`.
- `Host` allowlist on every request; exact `Origin` allowlist for mutations and WS.
- Session cookie: `HttpOnly; SameSite=Strict; Path=/`; CSRF double-submit header for
  every non-GET request.
- Bridge token: separate secret, `0600` file, `Authorization: Bearer`, scope-limited
  to `/api/bridge/*`, rotated every server start.
- No permissive CORS. No token in URLs. No secrets in logs.
- AI output is untrusted: constrained JSON Patch, schema validation, user confirm,
  versioned apply, rollback.

## API contract

See `docs/API.md`. Version prefix `/api`, protocol version `1`. The bridge uses
`POST /api/bridge/events`, `POST /api/bridge/heartbeat`, and
`GET /api/bridge/status`; the web UI never sees the bridge token.

## Front-end

A single React app with five views (Focus, Timeline, Modes, AI Studio, Settings) plus
a permission/capabilities panel. The dock is a fixed bottom capsule rendered by
`web/src/components/Dock.tsx`; `/dock` renders it alone for the WKWebView. Styling is
hand-written CSS (design tokens in `web/src/styles.css`) to keep the dependency
surface small.

## Failure behaviour

| Failure | Behaviour |
|---|---|
| No network / no API key | Rules engine and all P0 flows work; AI panel shows "rules only" |
| Ollama/cloud timeout or invalid JSON | Proposal rejected with a reason; no partial apply; rules remain active |
| Bridge absent or crashed | UI shows `mac_bridge: not_connected`; web app unaffected |
| Accessibility denied | Bridge reports `accessibility: denied` and emits bundle-id-only events |
| Port busy | Tries the next port in 4317–4327 and prints the actual URL |
| DB migration failure | Transaction rollback, server refuses to start with a clear message |
