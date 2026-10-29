# Architecture

The binding decision record is [ADR-001](ADR-001-ARCHITECTURE.md). This page is
the implementation map.

## Runtime

```
Browser (React 19 + Vite build)
  │  same-origin HTTP + WebSocket, HttpOnly session, CSRF header
  ▼
Fastify 5 on 127.0.0.1:<port>
  ├── security.ts     Host/Origin/session/CSRF/token/rate-limit
  ├── store.ts        SQLite (node:sqlite), migrations, modes, events, versions, audit
  ├── domain/rules.ts deterministic activity + notification classification
  ├── domain/proposals.ts  patch validation, diff, transaction apply, offline NL parser
  ├── ai/providers.ts      rules · Ollama · OpenAI-compatible, timeout + fallback
  └── server.ts       routes, WebSocket hub, static shell
  ▲
  │  loopback HTTP, scoped Bearer token
Optional Swift bridge (NSPanel + WKWebView + NSWorkspace)
```

## Data model

| Table | Purpose |
|---|---|
| `schema_migrations` | applied migration versions |
| `modes` | current mode config (JSON columns) + version counter |
| `mode_versions` | immutable snapshots per version, source and note |
| `events` | activity/notification decisions, unique `dedupe_key` |
| `notifications` | in-product queue with `ready_at` for the cool-down |
| `proposals` | prompt, patch, diff, status, applied mode ids |
| `settings` | `app` (settings JSON) and `runtime` (active mode, lock, last suggestion) |
| `audit_log` | last 2,000 product actions |

SQLite runs in WAL mode with a 3 s busy timeout. Every mutation that touches
multiple rows (imports, proposal apply, reset) is wrapped in a transaction.

## Activity pipeline

1. Input (demo panel or bridge) is schema-validated.
2. `classifyActivity` finds a mode by exact allowlist, then keyword. It returns
   `stay`, `hold`, `suggest_switch`, or `auto_switch` with confidence, reason and
   matched rule.
3. Dwell (max of the two modes, default 15 s) and cooldown (default 60 s) prevent
   flapping. `runtime.manual_lock` forces suggestions only.
4. The event is persisted with `actual_action`; the runtime suggestion timestamp
   is stored; WebSocket clients refresh.

## Notification pipeline

1. Urgent keyword or `time_sensitive` → `time_sensitive`, wait 0.
2. Social source during a non-Social mode → `defer` with `suggested_mode=social`
   (unless the mode shows everything).
3. Mode keyword match → `show`; otherwise the mode's `default` policy decides.
4. Deferred/shown events get a queue row. `ready_at = created_at + wait`.
5. `go_social` is rejected with `409` until `ready_at`, then activates the
   suggested mode with manual lock. `Later` only closes the card.

## Proposal pipeline

1. Provider (rules or model) returns `{summary, patch}`.
2. `validatePatch` checks path grammar, allowed mode, allowed field, and value
   schema. Unknown fields, traversal and out-of-range values are rejected.
3. `computeDiff` renders before/after without touching the database.
4. The proposal is stored as `proposed`.
5. On explicit apply, `applyOps` validates again, groups operations per mode,
   and applies them in one transaction, creating one new version per mode.
6. Rollback restores a stored snapshot as a *new* version (history is never
   rewritten).

## Security boundaries

See `THREAT_MODEL.md`. The key invariants are enforced in one `onRequest` hook,
not scattered per route: host, session/token, origin, CSRF, content type. The
WebSocket upgrade repeats the host/origin/session checks because it bypasses the
hook.

## Failure behaviour

| Failure | Behaviour |
|---|---|
| Port busy | next port in 4317–4327, or a clear error with `FOCUSDOCK_PORT_STRICT=1` |
| No network / no key | rules engine and all P0 flows work |
| Model timeout / invalid JSON | 422 or rules fallback; no partial apply |
| Bridge absent | `not_connected`; web app unaffected |
| Accessibility denied | bridge sends bundle ids only |
| Database migration error | rollback and refuse to start |
| Web assets missing | `503` page telling you to run `npm run build` |

## Front end

One React app, five views (Focus, Timeline, Modes, AI Studio, Settings) plus
Permissions. The dock is a fixed capsule and is also served at `/dock` for the
WKWebView. State comes from `/api/state`; a WebSocket event triggers a debounced
refresh. Styling is hand-written CSS with mode color tokens; no UI framework.
