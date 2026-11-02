# Threat Model

Scope: the local web app, its loopback HTTP/WebSocket surface, the optional macOS
bridge, and AI-generated mode proposals. Out of scope: OS-level malware with the
user's own privileges (it can read the same files), and any third-party app the user
chooses to authorize.

## Assets

| Asset | Sensitivity | Where it lives |
|---|---|---|
| Mode definitions, rules, pinned apps | Low | SQLite (`focusdock.db`) |
| Activity metadata (app id, optional window title) | Medium | SQLite, retention-limited |
| Notification text the user types into the demo | Medium | SQLite |
| Session secret / CSRF token | High | server memory + HttpOnly cookie |
| Bridge capability token | High | `runtime/bridge-token` (0600) + server memory |
| Cloud AI API key (optional) | Critical | OS user-profile secret file (0600 best effort), never DB/git/logs/localStorage |

## Trust boundaries

1. Browser (any page in any tab) ↔ loopback HTTP/WS.
2. Native bridge process ↔ loopback HTTP.
3. Server ↔ optional cloud model endpoint (opt-in only).
4. Web UI ↔ WKWebView in the bridge (same local origin, same session rules).

## Threats and controls

| ID | Threat | Control | Residual risk |
|---|---|---|---|
| T1 | DNS rebinding: `evil.com` resolves to 127.0.0.1 and calls the API | Server binds 127.0.0.1 only; every request's `Host` must be `127.0.0.1:<port>` or `localhost:<port>`; `Origin`, when present, must be an exact allowed origin; no CORS headers are emitted | A local process can still forge Host/Origin — it already has local code execution |
| T2 | CSRF from a malicious page | Session cookie is `HttpOnly`, `SameSite=Strict`, `Path=/`; all mutations also require `X-FocusDock-CSRF` matching the `fd_csrf` double-submit cookie; JSON content type required | Same-site subdomain attacks are not applicable (IP host) |
| T3 | Cross-origin WebSocket hijack | WS upgrade validates exact `Origin`, session cookie, and `Host`; no wildcard | — |
| T4 | Token leakage via URL/logs | No token in any URL or query string; request logging omits cookie/authorization headers; bootstrap cookie is set by the server, not embedded in HTML | Browser devtools can see the user's own cookie (expected) |
| T5 | Malicious local process steals the bridge token | Token file created 0600 (POSIX) / user-only ACL (Windows best effort); token is per-process, rotates on restart, and only authorizes `/api/bridge/*` | Same-user malware can read it; documented |
| T6 | Prompt injection makes the model emit shell commands or arbitrary config | Proposals are constrained JSON Patch over `/modes/*` only; ops allowlisted; fields schema-validated; values type-checked; no free text execution; user must confirm; every apply is versioned and reversible | A malicious but schema-valid mode (e.g. absurd color) is possible — low impact |
| T7 | Model endpoint exfiltrates activity data | Cloud provider is opt-in; default `rules` engine; outbound payload contains only the user's prompt plus mode summaries, never raw events/window titles unless the user enables "include recent activity"; documented in Settings | The user's own prompt may contain sensitive text |
| T8 | WebView injection in the bridge | WKWebView loads only `http://127.0.0.1:<port>/dock`; navigation to other origins is cancelled. v0.1.0 exposes no JS message handler or app-launch endpoint; a future launch API must be allowlisted and audited. | A compromised local server could serve hostile JS — same trust domain |
| T9 | Unauthorized app launch from a malicious event | The web core has no app-launch API. The unreleased Windows companion launches only a Start Menu-resolved `.exe` selected by the user, verifies its SHA-256, rejects unknown/out-of-catalog targets, and audits each attempt; no shell/AppleScript. | The companion runs as the same user, so same-user code can still launch apps directly. |
| T10 | Data over-retention | Default retention 7 days for events; "clear all product data" wipes DB, versions, queue, audit; export is explicit | Backups outside the app are the user's choice |
| T11 | Import of a hostile mode bundle | Import validates the same schema, caps file size (256 KB), strips unknown fields, requires confirmation, never executes content | — |
| T12 | Port collision / duplicate instance | Port auto-selection with a clear URL; a second instance gets its own data lock; SQLite WAL + busy timeout | Two instances can share the DB; documented as unsupported |

## Explicit non-goals (cannot be fixed by this project)

- Intercepting or silencing other apps' macOS notifications. `UNUserNotificationCenter`
  exposes only the app's own notifications. The UI says so; simulated events are
  labelled `simulated`.
- Reading other apps' window contents, keystrokes, clipboard, or browser history.
- Replacing or modifying the system Dock.
- Launching native applications in v0.1.0. Pinned app tiles are labels/bookmarks;
  the macOS bridge has no app-launch endpoint.

## Security verification

Automated tests cover: non-loopback bind refusal, evil `Host`, evil `Origin`, missing
session, missing CSRF header, cross-origin WS, bridge token scope, proposal injection
(`../../`, `exec`, unknown fields), oversized bodies, and secret absence from logs.
See `docs/QA_REPORT.md` for the evidence index.
