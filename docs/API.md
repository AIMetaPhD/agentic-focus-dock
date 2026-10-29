# Local API (protocol 1)

Base URL: `http://127.0.0.1:<port>` (default 4317). All bodies are JSON, max 64 KB.
The server binds loopback only.

## Authentication

Two independent schemes:

| Caller | Credential | Scope |
|---|---|---|
| Browser UI | `fd_session` cookie (`HttpOnly; SameSite=Strict`) issued by `GET /` or `GET /dock` | all `/api/*` except `/api/bridge/*` |
| macOS bridge | `Authorization: Bearer <bridge token>` from `runtime/bridge-token` | `/api/bridge/*` only |

Browser mutations additionally require:

```
Origin: http://127.0.0.1:<port>
X-FocusDock-CSRF: <value of the fd_csrf cookie>
Content-Type: application/json
```

Rejections: `401 unauthenticated`, `403 bad_origin`, `403 bad_csrf`,
`403 bridge_origin`, `421 bad_host`, `415 json_required`.

There is no CORS header. A cross-origin page cannot read responses and cannot
send the custom CSRF header without a successful preflight (which never
succeeds).

## Health

`GET /api/health` — public.

```json
{ "status": "ok", "version": "0.1.0", "protocol": 1, "time": "2026-10-30T..." }
```

## State

`GET /api/state` returns:

```json
{
  "protocol": 1,
  "version": "0.1.0",
  "modes": [Mode],
  "runtime": { "active_mode": "writing", "manual_lock": true,
               "last_suggestion_at": null, "last_suggested_mode": null },
  "pending_notifications": [PendingNotification],
  "settings": Settings,
  "bridge": { "connected": false, "last_seen": null, "token_path": "..." },
  "capabilities": Capabilities,
  "counts": { "events": 12, "modes": 6 }
}
```

`GET /api/capabilities` returns the honest platform matrix (notifications are
`supported: false`).

## Modes

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/api/modes` | — | `Mode[]` |
| POST | `/api/modes` | `ModeConfig` | `201 Mode` |
| GET | `/api/modes/:id` | — | `Mode` |
| PUT | `/api/modes/:id` | partial `ModeConfig` | updated `Mode` (version + 1) |
| DELETE | `/api/modes/:id` | — | `{ok:true}`; refuses the last mode |
| POST | `/api/modes/reorder` | `{ids:string[]}` | `Mode[]` |
| POST | `/api/modes/:id/activate` | `{lock?:boolean}` | `{mode, runtime}` |
| POST | `/api/runtime/lock` | `{locked:boolean}` | `runtime` |
| POST | `/api/modes/restore-defaults` | — | `Mode[]` |
| GET | `/api/modes/:id/versions` | — | `ModeVersion[]` |
| POST | `/api/modes/:id/rollback` | `{version:number}` | `Mode` |

`ModeConfig`:

```json
{
  "name": "Writing",
  "color": "amber",
  "icon": "✍",
  "pinned_items": [{ "id":"notes","label":"Notes","icon":"📝","kind":"app","bundle_id":"com.apple.Notes" }],
  "activity_app_allowlist": ["com.apple.Notes"],
  "keywords": ["write","写作"],
  "transition": { "manual_immediate":true, "auto_suggest_only":true,
                  "dwell_seconds":15, "cooldown_seconds":60 },
  "notifications": { "default":"defer", "time_sensitive":"show",
                     "switch_wait_seconds":30, "social_switch_enabled":true },
  "sort_order": 0
}
```

Colors: `amber, blue, violet, teal, rose, pink, lime, slate`.
Notification defaults: `show, defer, ignore`.

## Events and demo

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/api/events?limit=100&kind=activity\|notification` | — | `ActivityEvent[]` |
| GET | `/api/notifications?status=pending` | — | `PendingNotification[]` |
| POST | `/api/demo/activity` | `{app_name, app_id?, stable_seconds?}` | `201 ActivityEvent` |
| POST | `/api/demo/notification` | `{source_app?, title?, body?, time_sensitive?, dedupe_key?}` | `201 {event, notification}` |
| POST | `/api/demo/burst` | `{count:1..100}` | `{created, urgent, deferred}` |
| POST | `/api/notifications/:id/decision` | `{action:"stay"\|"later"\|"dismiss"\|"go_social"}` | `{notification, runtime}` |

Demo events are always stored with `source: "simulated"` and
`payload.simulated: true`. `go_social` returns `409 wait_not_elapsed` with
`remaining_seconds` until the cool-down finishes. `Later` never launches an app.

## Proposals

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/api/proposals` | — | `Proposal[]` |
| GET | `/api/proposals/:id` | — | `Proposal` |
| POST | `/api/proposals` | `{prompt:3..2000 chars}` | `201 Proposal` + `fallback_reason`, `latency_ms` |
| POST | `/api/proposals/:id/apply` | — | `{proposal, modes}` |
| POST | `/api/proposals/:id/reject` | — | `Proposal` |

A patch operation is limited to:

```json
{ "op": "add|replace|remove", "path": "/modes/<id>[/<field>[/<subfield>]]", "value": ... }
```

Allowed fields: `name, color, icon, pinned_items, activity_app_allowlist,
keywords, transition, notifications, sort_order`. Paths containing `..`,
`__proto__`, `constructor`, or `prototype` are rejected; `remove` is only
allowed for a whole mode. Errors: `422 invalid_patch`, `path_not_allowed`,
`invalid_value`, `mode_exists`, `mode_missing`, `unsupported_request`,
`provider_error`, `provider_and_fallback_failed`.

## Settings and data

| Method | Path | Body |
|---|---|---|
| GET | `/api/settings` | — (never returns the key) |
| PUT | `/api/settings` | `{language?, ai?, privacy?}` |
| PUT | `/api/settings/ai-key` | `{api_key: string\|null}` |
| GET | `/api/audit?limit=100` | — |
| GET | `/api/export` | — (modes + settings, no events/keys) |
| POST | `/api/import` | `{format:"focusdock-export", version:1, modes:[...]}` |
| POST | `/api/data/clear-events` | `{confirm:true}` |
| POST | `/api/data/reset` | `{confirm:"RESET"}` |

## Bridge

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/api/bridge/heartbeat` | Bearer | `{bridge_version, capabilities}` |
| POST | `/api/bridge/events` | Bearer | `{kind:"activity"\|"notification", source_app, payload, dedupe_key?}` |
| POST | `/api/bridge/disconnect` | Bearer | `{}` |
| GET | `/api/bridge/status` | session | — |
| POST | `/api/bridge/rotate-token` | session | — |

Bridge events are stored with `source: "bridge"`. The bridge token cannot read
`/api/state` or any mode/proposal endpoint. A bridge request carrying an
`Origin` header is rejected.

## WebSocket

`GET /api/ws` (upgrade) with the session cookie and exact local `Origin`.
Messages are JSON:

```json
{ "type": "event.created", "data": {...}, "at": "..." }
```

Types: `hello`, `event.created`, `notification.queued`, `notification.decided`,
`mode.changed`, `modes.changed`, `runtime.changed`, `settings.changed`,
`proposal.applied`, `bridge.status`, `data.cleared`, `data.reset`. The client
may send the text `ping`; the server replies `pong`. Invalid origin → `403`,
missing session → `401`.
