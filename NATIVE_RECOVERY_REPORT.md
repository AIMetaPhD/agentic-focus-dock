# NATIVE_RECOVERY_REPORT.md

- Date: 2026-11-03
- Project lead: ChatGPT
- Development lead: Claude Code
- Directive: `docs/FOCUSDOCK_NATIVE_RECOVERY_DIRECTIVE_v0.2.md`
- Repository: <https://github.com/AIMetaPhD/agentic-focus-dock>
- Recovery commit: `c7a766e013da6f6e14d52c633818febdf43c83f9`
- R3 follow-up commits: `1ad22db` (dock-first Add app UI, web pinned launch, social pause, real app icons), `87ba975` (clean shutdown, R3 restart persistence), `236115b` (real editor, 30 s social and bilingual R3 evidence)
- Base commit before recovery: `56b30f3517ace01f2c31319b90fc5843112f73e8`
- Public release: **v0.1.0 remains the public Release; no v0.2 Release was created.**

This is an implementation report, not a Muse sign-off. The existing Muse G4 gate
remains **NOT VERIFIED**.

## 1. Gate matrix (no blended status)

| Gate | Status | What is proven |
|---|---|---|
| R0 Truthful inventory / Mac reachability | **PASS for reachability matrix** | Repo, host, tools and tests inventoried; one online macOS Tailscale peer exists; SSH host key is presented but **not trusted**; GUI session not proven |
| R1 Existing macOS bridge smoke test | **BLOCKED** | Host-key trust and Mac GUI/screen evidence are missing; no `NSPanel`/`NSWorkspace` runtime claim |
| R2 Windows native companion | **PASS (minimal)** | Real foreground events, Building suggestion after 15 s, three distinct apps, allowlisted Character Map launch, unknown launch rejected, bilingual native status, graceful disconnect |
| R3 Usefulness / full workflow | **PARTIAL — technical workflow passes on app restart** | Dock-first Add app, real icons, real VS Code foreground/suggestion/launch, cancelable 30 s social pause, app-restart persistence, clean stop and bilingual status pass; real social app, OS reboot and user-value assessment pending |

**Recommendation: CONDITIONAL GO** to continue the specific Windows native P0
blockers. **Not GO** for a daily-use claim or another public Release.

## 2. R0 — inventory and Mac reachability

### Host and toolchain

| Item | Result |
|---|---|
| OS | Windows 11 Pro 10.0.26200 (x64), interactive user session |
| Node / npm | v24.12.0 / 11.6.2 |
| .NET Framework compiler | `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe` present |
| Swift / Xcode | not present on this host |
| Tailscale | Running; 8 peers total; **1 online macOS peer** |
| SSH | OpenSSH 10.3p1; ordinary SSH only; Tailscale SSH not advertised |
| Repository | clean before recovery; base `56b30f3` |

### Mac reachability

- The online macOS peer was reached at the SSH transport level: the SSH server
  presented host keys.
- Hostname, Tailnet address and username are **redacted** from this report.
- Strict host-key checking refused the first connection because the key is not
  in `known_hosts`; we did **not** auto-accept it.
- Captured public fingerprints for owner verification:
  - ED25519: `SHA256:CqrWgfGQP+WKBoPyV/axgZDlh86mgbHZANlgI4qFYkA`
  - RSA: `SHA256:5Ap6TmIczc0tnFa1SmbiyftpF/f7sZ2zOcudQm3peT0`
- Required owner check on the Mac:
  - `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`
  - Compare the SHA256 value before adding the key to `known_hosts`.
- No GUI session or screen capture was proven. R1 therefore cannot pass.

## 3. R1 — existing macOS bridge

**BLOCKED.** Preconditions not met:

1. Host key must be independently verified and trusted.
2. The Mac username and Remote Login availability must be confirmed.
3. A logged-in GUI session and screen-capture channel must be confirmed.

No claim is made that the `NSPanel` overlay or `NSWorkspace` events work on a
real Mac. No SIP change, Full Disk Access grant or inbound port was requested.

## 4. R2 — Windows native companion

### Implementation

`win-companion/` is a C# WinForms tray application compiled with the built-in
.NET Framework compiler. No .NET SDK install and no new npm dependency.

- `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)` observes real foreground changes.
- `GetForegroundWindow`, `GetWindowThreadProcessId`, process name/executable and
  optional `GetWindowText` (off by default) identify the app.
- Events are POSTed to the existing loopback `/api/bridge/events` with the
  per-run Bearer token; browser Origin is never sent.
- A native Start Menu picker resolves `.lnk` targets to existing `.exe` files.
- Launch verifies the target and computes SHA-256; unknown/out-of-catalog
  requests are rejected; every attempt is written to an audit log.
- Status window is bilingual, privacy-safe by default (`native app detected`),
  and has no token/path display.
- `--exit-after` exercises graceful teardown: unhook, tray removal, disconnect.

### Real observations

Controlled output (`qa/evidence/native/companion-controlled.log`):

- `Windows 命令处理程序` (Command Processor) — real foreground event.
- `Windows Terminal Host` — real foreground event; 15 s stable event.
- `Windows PowerShell` — real foreground event.
- The companion observed **three distinct foreground apps** without the demo
  console.
- At `2026-11-02 15:16:15` the Terminal Host produced `stable=15s`; the server
  state records `last_suggested_mode: "building"` at `15:16:15` local time.

`qa/evidence/native/server-state.json` records:

- `bridge.connected: true`
- `capabilities.platform: "windows"`
- `capabilities.activity: "win32-foreground"`
- `last_suggested_mode: "building"`
- `counts.events: 8`

### Launch evidence

- `Character Map` (Start Menu-resolved `C:\WINDOWS\system32\charmap.exe`):
  `LAUNCH OK`, SHA-256
  `af7866199687521bf0179212a9fd788669c158516c00012ea98e04697b38ed35`
  (`qa/evidence/native/launch-audit.log`).
- Unknown app `DefinitelyNotInstalledApp`: `LAUNCH REJECTED`, exit 4
  (`qa/evidence/native/launch-rejection.txt`).
- The same catalog backs the native tray picker (`win-companion/src/AppPickerForm.cs`).

### Native UI / language

- `qa/evidence/native/00-windows-companion.png`: native status window showing
  `Windows — connected`, privacy-safe foreground line, event count and no error.
  The screenshot was taken at startup (0 events); the controlled log is the
  authoritative event evidence.
- `qa/evidence/native/01-web-topbar-zh.png`: Chinese topbar with
  `Windows — 已连接`.
- `qa/evidence/native/02-web-topbar-en.png`: English topbar with
  `Windows — connected`.
- `qa/evidence/native/web-status.json`: `toggleWorked: true`.
- The topbar language switch is a visible `EN` / `中文` button.

### Disconnect

`--exit-after 5` produced no remaining `FocusDockCompanion.exe` process; the
server reported `connected: false`, `last_seen: null`
(`qa/evidence/native/disconnect-test.txt`,
`qa/evidence/native/disconnect-status.json`).

### R2 limitations

- Web pinned launch is **Windows-only** and requires the running companion; the
  browser-only and macOS paths still have no launch endpoint.
- The native picker initially preselected the first Start Menu entry (`Access`),
  which caused an accidental Microsoft Access launch. It now starts with no
  selection and keeps Launch disabled until the user explicitly chooses an app.
- The foreground-to-record latency was observed at the log's 1-second
  resolution; **sub-second latency was not instrumented**. The `<1 s` target is
  not proven.
- Multi-monitor, fullscreen, sleep/wake and elevated-process behavior were not
  tested.
- The app is a tray companion, not a polished always-on-top dock.
- Status window shows 0 events in the captured screenshot because it was taken
  before the event sequence; the log and server state show the real events.

## 5. R3 — usefulness test

**PARTIAL — technical workflow passes on the app-restart path; a full OS reboot and the user-value assessment remain.**

Proven:

- **Dock-first Add app UI:** the dock has a `+ Add` tile; it opens a searchable
  app modal with an onboarding sentence, a `Test launch` action and a `Pin`
  action. Pinning `Character Map` produced `Pinned Character Map` and a new dock
  tile (`r3-add-app-modal.png`, `r3-dock-pinned.png`, `r3-add-app-test.json`).
- **Real app icons:** the Add app modal and the dock now render each pinned
  app's own executable icon instead of a shared `▣` glyph. `Character Map` and
  `Obsidian` returned different PNGs (2096 vs 1778 bytes, different SHA-256) and
  rendered in both surfaces (`r3-add-app-character-map.png`,
  `r3-add-app-obsidian.png`, `r3-dock-icons.png`, `r3-icon-*.png`).
- **Web pinned launch:** the newly pinned dock tile `Character Map` launched a
  real app through `/api/native/launch`; UI toast: `Launched Character Map`
  (`qa/evidence/native/r3-web-launch.png`).
- **Real editor foreground and suggestion:** with Writing active and the
  manual lock released, `Visual Studio Code` was launched through the native
  picker. The companion recorded a real foreground activity event, the rules
  engine suggested `Building` after 15 s stable dwell, and the operator
  confirmed the suggestion in the UI. `active_mode` changed from `writing` to
  `building`; the dock and mode hero changed with it
  (`r3-editor-suggestion.png`, `r3-editor-flow.json`).
- **Pinned real editor launch:** `Visual Studio Code` was pinned as a native
  app in Building; clicking that dock tile produced `已启动 Visual Studio Code`
  and an audit entry with SHA-256
  `325fb30ba28d17fa6ba4df58043727b2469aca9d641793a65e413721b2110ec6`
  (`r3-editor-pinned-dock.png`, `r3-editor-launch-toast.png`).
- **Cancelable 30 s social pause:** a pinned test item labeled `X` (pointing to
  the Character Map target, a test fixture) received
  `409 social_pause_required`. The dialog showed a 31 s initial countdown
  (30 s configured, rounded up), Cancel left the app unlaunched, reopening the
  tile showed the same wait, and `Open now` became enabled at 0 s; UI toast:
  `已启动 X`. The dialog explicitly says FocusDock cannot block the app outside
  itself (`r3-social-30s-first.png`, `r3-social-30s-ready.png`,
  `r3-social-30s-launch.png`, `r3-social-30s.json`).
- **Bilingual and native status:** the topbar, dock labels and native status
  were checked in both languages. Chinese: `Windows — 已连接`, dock `添加`;
  English: `Windows — connected`, dock `Add`
  (`r3-bilingual-zh.png`, `r3-bilingual-en.png`, `r3-bilingual.json`).
- **App restart and clean stop:** the companion and server were stopped, then
  restarted from the same data directory. No companion process, window or
  listener remained after stop; with a WebSocket client still attached, the
  server exited and the client observed `WS_CLOSED`. The stable state JSON
  before and after restart is identical (`diff` exit 0), including the active
  mode, manual lock, all six modes, `Character Map` and `Obsidian` pins, and
  language/privacy settings. Icons returned the same SHA-256 values
  (`r3-restart-before.json`, `r3-restart-after.json`,
  `r3-restart-cleanup.txt`, `r3-restart-dock.png`).
- **Local-only dependency check:** listeners and established peers sampled from
  the server and companion were loopback-only; AI provider was `rules`,
  `cloud_opt_in` was false and no API key was configured
  (`r3-restart-local-only.txt`).
- The native picker is now labeled **Diagnostic launch** and has a search box.
  It no longer preselects the first Start Menu entry; Launch is disabled until
  an explicit selection. This fixes the accidental `Access` launch reported by
  the user. The normal flow is the web dock `+ Add` modal.

A real defect was found during this test: the first shutdown left the Node
process alive because an established WebSocket kept the event loop open after
the HTTP listener closed. Commit `87ba975` terminates hub clients in the
`preClose` hook, adds a 3 s forced-exit deadline, and adds a regression test.
The stop sequence above was rerun after the fix.

Not proven:

- No real Slack/WeChat/Telegram app was launched; the social item was a test
  fixture pointing at Character Map. This deliberately avoided exposing private
  messages. The gate mechanics and 30 s default were exercised, but a real
  social app remains a separate privacy-sensitive check.
- A full OS reboot was not performed. This pass covers the directive's
  "reboot/restart the app" path; FocusDock has no auto-start entry, so the
  server and companion must be started manually after signing in.
- The app was not run with the network adapter disabled; offline capability is
  supported by the local rule engine and loopback-only socket sample, not by an
  adapter-disabled test.
- User assessment that the tool actually reduces context-switching friction is
  still pending.

The social pause is a UX gate, not an OS-level block; the user can still open
the app directly. Automated tests are not a substitute for the user-value test.

## 6. Technical decisions and security

- **No new npm dependency.** The companion uses .NET Framework 4.8 WinForms and
  Win32 P/Invoke; compiled with the OS-provided `csc.exe`.
- **No keyboard hooks, screen scraping, clipboard or notification database
  access.** Window titles are off by default.
- The bridge token is read from the FocusDock-created file, sent only to
  loopback in an Authorization header; no Origin header is sent.
- The native app catalog resolves Start Menu shortcuts to existing `.exe`
  targets; it does not accept arbitrary command lines, PowerShell, `cmd /c` or
  URIs from the model/web UI.
- The web `/api/native/launch` route proxies an opaque catalog id to the
  companion; it does not accept a path or command line. The social pause is a
  UX gate, explicitly not a security boundary.
- Launch target is hashed with SHA-256 and audited; unknown/out-of-catalog
  requests are rejected.
- Status window hides app names by default; raw event logs with user app names
  were removed from the public evidence and replaced by a controlled, sanitized
  log.
- Windows-process identifiers were added to default mode allowlists so real
  events match the existing rules engine.
- The public v0.1.0 Release remains unchanged; this work is on `main` only.

## 7. Tests and CI

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm test` | **57 passed** (53 server + 4 web), including the WebSocket shutdown regression test |
| `npm run build` | pass |
| `npm run test:e2e` | **13 passed** (before the R3 web-launch UI change; CI re-runs it) |
| R3 UI scripts | `win-companion/r3-add-app-test.mjs` and `r3-web-test.mjs` pass |
| `npm run secret-scan` | clean, 132 tracked files |
| C# `--self-test` | **6 checks pass**, including executable icon extraction |
| C# build | pass |
| CI | R2 run `41409028974` on `c7a766e` — **success**; icon commit `1ad22db` run `41470500051` — **success**; shutdown/restart commit `87ba975` run `41475843568` — **success**; R3 workflow commit `236115b` run `41480919475` — **success** (macOS bridge, secret scan, web typecheck/lint/unit/e2e) |
| Muse QA | **NOT VERIFIED**; no Muse PASS was fabricated |

## 8. Evidence index

| Evidence | Path |
|---|---|
| Native status window | `qa/evidence/native/00-windows-companion.png` |
| Chinese topbar | `qa/evidence/native/01-web-topbar-zh.png` |
| English topbar | `qa/evidence/native/02-web-topbar-en.png` |
| Controlled foreground log | `qa/evidence/native/companion-controlled.log` |
| Server state snapshot | `qa/evidence/native/server-state.json` |
| Launch audit | `qa/evidence/native/launch-audit.log` |
| Unknown launch rejection | `qa/evidence/native/launch-rejection.txt` |
| Self-test | `qa/evidence/native/self-test.txt` |
| Build | `qa/evidence/native/build.txt` |
| Disconnect test | `qa/evidence/native/disconnect-test.txt` |
| Disconnect state | `qa/evidence/native/disconnect-status.json` |
| Language toggle result | `qa/evidence/native/web-status.json` |
| Web pinned launch | `qa/evidence/native/r3-web-launch.png` |
| Social pause dialog | `qa/evidence/native/r3-social-pause.png` |
| Social open after pause | `qa/evidence/native/r3-social-open.png` |
| R3 UI test result | `qa/evidence/native/r3-web-test.json` |
| Dock-first Add app modal | `qa/evidence/native/r3-add-app-modal.png` |
| Dock after pinning | `qa/evidence/native/r3-dock-pinned.png` |
| Add-app test result | `qa/evidence/native/r3-add-app-test.json` |
| Add-app icon — Character Map | `qa/evidence/native/r3-add-app-character-map.png` |
| Add-app icon — Obsidian | `qa/evidence/native/r3-add-app-obsidian.png` |
| Dock with real pinned icons | `qa/evidence/native/r3-dock-icons.png` |
| Extracted icon PNGs | `qa/evidence/native/r3-icon-character-map.png`, `r3-icon-obsidian.png` |
| Restart state before | `qa/evidence/native/r3-restart-before.json` |
| Restart state after | `qa/evidence/native/r3-restart-after.json` |
| Stop/restart result | `qa/evidence/native/r3-restart-cleanup.txt` |
| Loopback-only socket sample | `qa/evidence/native/r3-restart-local-only.txt` |
| Dock after restart | `qa/evidence/native/r3-restart-dock.png` |
| Real editor suggestion | `qa/evidence/native/r3-editor-suggestion.png` |
| Real editor flow result | `qa/evidence/native/r3-editor-flow.json` |
| Pinned editor dock | `qa/evidence/native/r3-editor-pinned-dock.png` |
| Editor launch toast | `qa/evidence/native/r3-editor-launch-toast.png` |
| 30 s social pause | `qa/evidence/native/r3-social-30s-first.png`, `r3-social-30s-ready.png`, `r3-social-30s-launch.png`, `r3-social-30s.json` |
| Bilingual status | `qa/evidence/native/r3-bilingual-zh.png`, `r3-bilingual-en.png`, `r3-bilingual.json` |
| R3 launch audit (includes the accidental Access launch) | `qa/evidence/native/r3-launch-audit.log` |
| Companion source | `win-companion/src/` |
| Companion README | `win-companion/README.md` |

Raw logs with non-controlled app names were kept out of the repository.

## 9. Exact files in the recovery commit

`c7a766e` touches:

- Native companion: `win-companion/build.ps1`,
  `win-companion/README.md`, `win-companion/smoke-drive.ps1`,
  `win-companion/capture-*.ps1`, `win-companion/capture-web.mjs`,
  `win-companion/src/*.cs`.
- Server: `server/src/server.ts`, `server/src/index.ts`,
  `server/src/domain/defaults.ts`.
- Web: `web/src/App.tsx`, `web/src/components/PermissionsView.tsx`,
  `web/src/i18n.tsx`, `web/src/styles.css`.
- Tests: `tests/e2e/03-settings-security.spec.ts`.
- Docs: `README.md`, `README.zh-CN.md`, `CHANGELOG.md`,
  `docs/CAPABILITIES.md`, `docs/SCOPE.md`, `docs/THREAT_MODEL.md`,
  `docs/FOCUSDOCK_NATIVE_RECOVERY_DIRECTIVE_v0.2.md`.
- Evidence: `qa/evidence/native/*` and regenerated `qa/evidence/0*.png`.
- `.gitignore`.

The R3 follow-up adds: `server/src/server.ts`, `web/src/App.tsx`,
`web/src/components/Dock.tsx`, `web/src/components/ModesView.tsx`,
`web/src/components/NativeAppPicker.tsx`, `web/src/i18n.tsx`,
`web/src/styles.css`, `win-companion/src/ControlServer.cs`,
`win-companion/src/AppCatalog.cs`, `win-companion/src/AppPickerForm.cs`,
`win-companion/src/StatusForm.cs`, `win-companion/src/TrayContext.cs`,
`win-companion/src/Options.cs`, `win-companion/src/Program.cs`,
`win-companion/r3-*.mjs`, and `qa/evidence/native/r3-*`.

## 10. GO / STOP recommendation

**CONDITIONAL GO** for the next Windows native step, limited to the remaining
R3 blockers:

1. Run a reboot/restart persistence and residual-window test.
2. Optionally repeat the social pause with the default 30 s and a real social
   app the owner chooses (no private content).
3. Instrument foreground-to-record latency to sub-second resolution.
4. Conduct the user-value test with the owner; the current result is still
   "technically works", not "useful in daily work".
5. Remove or demote the raw native Start Menu picker further if the owner still
   finds it confusing; the web `+ Add` flow is the intended product surface.

**Do not** publish a v0.2 Release, promote the app as a daily-use focus agent,
or open further profile marketing until R2 + R3 real-world evidence and user
approval exist. Do not relabel the current v0.1.0 prototype as native-capable.

## 11. Mac unblock request (R1 only)

To unblock R1, the owner needs to:

1. Verify the ED25519 fingerprint on the Mac:
   `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`.
2. Provide the Mac login username (not a password or token).
3. Confirm `System Settings → General → Sharing → Remote Login` permits that
   user.
4. Confirm a logged-in GUI session and an agreed screen/view evidence method
   (Screen Sharing over the tailnet or physical capture).

Do **not** disable SIP, grant Full Disk Access, or open inbound internet ports
for this test.
