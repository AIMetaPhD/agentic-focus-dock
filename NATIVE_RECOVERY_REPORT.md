# NATIVE_RECOVERY_REPORT.md

- Date: 2026-11-02
- Project lead: ChatGPT
- Development lead: Claude Code
- Directive: `docs/FOCUSDOCK_NATIVE_RECOVERY_DIRECTIVE_v0.2.md`
- Repository: <https://github.com/AIMetaPhD/agentic-focus-dock>
- Recovery commit: `c7a766e013da6f6e14d52c633818febdf43c83f9`
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
| R3 Usefulness / full workflow | **PARTIAL / BLOCKED** | Real foreground → suggestion and native launch exist, but the **web pinned tile does not launch apps**, the social pause flow is not native, reboot persistence was not tested, and the user-value assessment has not happened |

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

- **The web dock's pinned tiles still do not launch apps.** Launch is exposed
  through the native tray picker and the `--launch` test path only.
- The foreground-to-record latency was observed at the log's 1-second
  resolution; **sub-second latency was not instrumented**. The `<1 s` target is
  not proven.
- Multi-monitor, fullscreen, sleep/wake and elevated-process behavior were not
  tested.
- The app is a tray companion, not a polished always-on-top dock.
- Status window shows 0 events in the captured screenshot because it was taken
  before the event sequence; the log and server state show the real events.

## 5. R3 — usefulness test

**PARTIAL / BLOCKED.**

Proven:

- Real foreground app → native event → validated Building suggestion after 15 s.
- Real allowlisted app launch from the native picker catalog.
- Bilingual native status and language switch.
- Graceful disconnect with no residual process.

Not proven:

- Clicking a **web pinned tile** to launch a real app (R3 explicitly asks for
  this).
- The opt-in social pause workflow on a real social app.
- Reboot/restart persistence and no-residual-window behavior after a real
  reboot.
- User assessment that the tool actually reduces context-switching friction.

The user-value test has not been performed; automated tests are not a substitute.

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
| `npm test` | **56 passed** (52 server + 4 web) |
| `npm run build` | pass |
| `npm run test:e2e` | **13 passed** |
| `npm run secret-scan` | clean, 132 tracked files |
| C# `--self-test` | **5 checks pass** |
| C# build | pass |
| CI | run `41409028974` on `c7a766e` — **success**, all three jobs |
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

## 10. GO / STOP recommendation

**CONDITIONAL GO** for the next Windows native step, limited to the specific
R3 blockers:

1. Wire a web pinned app tile to the native allowlist launch through an
   authenticated server proxy; or explicitly decide that native tray launch is
   the product surface.
2. Add a real social-app pause workflow and prove it on Windows.
3. Run a reboot/restart persistence and residual-window test.
4. Instrument foreground-to-record latency to sub-second resolution.
5. Conduct the user-value test with the owner.

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
