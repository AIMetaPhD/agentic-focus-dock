# FocusDock — handoff to ChatGPT

- Date: 2026-11-03
- Repository: <https://github.com/AIMetaPhD/agentic-focus-dock>
- Development lead: Claude Code
- Directive: `docs/FOCUSDOCK_NATIVE_RECOVERY_DIRECTIVE_v0.2.md`
- Latest R3 commit: `236115b`
- Public release: **v0.1.0 remains the only public Release. No v0.2 Release was created.**
- Muse G4: **NOT VERIFIED.** No Muse PASS is claimed.

## 1. One-paragraph status

FocusDock is a working local-first Windows prototype, not a daily-use packaged
app. The Windows companion detects real foreground applications and launches
allowlisted apps through an authenticated loopback control channel. R3 now has
real Windows user-session evidence for: a VS Code foreground event, a validated
Building suggestion after 15 s dwell, an operator confirmation that switched
mode and dock, a pinned VS Code launch with audit hash, a cancelable 30 s social
pause, bilingual UI/native status, and state persistence plus clean shutdown
across an app restart. The remaining product decision is whether the workflow is
useful enough to justify packaging; a full OS reboot, a real social app launch,
and an adapter-disabled offline run are not proven.

## 2. Gate matrix

| Gate | Status | Basis |
|---|---|---|
| R0 inventory / Mac reachability | **PASS for reachability matrix** | repo/tooling inventory; one online macOS Tailscale peer; SSH host key presented but not trusted; GUI session not proven |
| R1 macOS bridge smoke test | **BLOCKED** | host-key trust and Mac GUI/screen evidence missing; no `NSPanel`/`NSWorkspace` runtime claim |
| R2 Windows native companion | **PASS (minimal)** | real foreground events from distinct apps; Building suggestion after 15 s; allowlisted Character Map launch; unknown launch rejected; bilingual native status; graceful disconnect |
| R3 usefulness / full workflow | **PARTIAL — technical workflow passes on app restart** | see section 3; product value decision, real social app, and full OS reboot remain |

The gate decision remains **CONDITIONAL GO** only for the specific Windows
native workflow. It is **not GO** for a daily-use claim or another public
Release.

## 3. What R3 proved

### Real editor and suggestion

- Started in Writing with the manual lock released.
- Launched `Visual Studio Code` through the native picker.
- The companion recorded a real bridge activity event for Visual Studio Code.
- After 15 s stable dwell the UI offered `适合 Building` /
  `切换到 Building`; the operator confirmed it.
- `active_mode` changed from `writing` to `building`; the hero and dock changed.
- Evidence: `qa/evidence/native/r3-editor-suggestion.png`,
  `qa/evidence/native/r3-editor-flow.json`.

This is an operator confirmation in the UI, not a claim that the end user
subjectively preferred the suggestion.

### Pinned real editor launch

- Pinned native `Visual Studio Code` in Building.
- Clicking the dock tile produced `已启动 Visual Studio Code`.
- Companion audit entry:
  `launched Visual Studio Code sha256=325fb30ba28d17fa6ba4df58043727b2469aca9d641793a65e413721b2110ec6`.
- Evidence: `r3-editor-pinned-dock.png`, `r3-editor-launch-toast.png`,
  `qa/evidence/native/r3-launch-audit.log`.

### Cancelable 30 s social pause

- A native test fixture labeled `X` pointed at Character Map. This deliberately
  avoided opening private social messages.
- First click returned `409 social_pause_required`; the dialog showed a 31 s
  countdown (30 s configured, rounded up).
- Cancel closed the dialog and did not launch.
- Reopening the tile restarted the wait; at 0 s `现在打开` became enabled and
  launched the fixture (`已启动 X`).
- The dialog states that FocusDock cannot block the app outside itself; this is
  a UX gate, not an OS-level block.
- Evidence: `r3-social-30s-first.png`, `r3-social-30s-ready.png`,
  `r3-social-30s-launch.png`, `r3-social-30s.json`.

A real Slack/WeChat/Telegram launch remains a separate privacy-sensitive check;
it was not performed.

### App restart and clean stop

- Stopped the companion and server; no companion process, window, or listener
  remained.
- With a WebSocket client attached, Ctrl+C terminated the server, closed 4317,
  and the client observed `WS_CLOSED`.
- Restarted from the same data directory; stable state JSON before and after is
  identical (`diff` exit 0): active mode, manual lock, six modes, pins,
  language and privacy settings.
- Found and fixed a real defect: an established WebSocket had kept the Node
  process alive after the HTTP listener closed. Commit `87ba975` terminates hub
  clients in `preClose`, adds a 3 s forced-exit deadline, and adds a regression
  test.
- Evidence: `r3-restart-before.json`, `r3-restart-after.json`,
  `r3-restart-cleanup.txt`, `r3-restart-dock.png`.

### Bilingual and native status

- Chinese: `Windows — 已连接`, dock `添加`.
- English: `Windows — connected`, dock `Add`.
- Evidence: `r3-bilingual-zh.png`, `r3-bilingual-en.png`,
  `r3-bilingual.json`.

### Local-only dependency check

- Sampled listeners and established peers for the server and companion were
  loopback-only (`127.0.0.1`).
- AI provider was `rules`; `cloud_opt_in` was false; no API key was configured.
- No non-loopback listener was present.
- Evidence: `r3-restart-local-only.txt`.

The app was **not** run with the network adapter disabled. This is an
architecture/socket-level check, not an adapter-disabled PASS.

## 4. What is not done

1. **User-value assessment.** The directive explicitly requires the user's
   judgment that the tool reduces context-switching friction. Automated tests
   and operator clicks do not answer this.
2. **Real social app.** The gate mechanics and 30 s default pass with a
   Character Map fixture; no Slack/WeChat/Telegram content was opened.
3. **Full OS reboot.** The tested path is app restart. FocusDock has no
   installer or auto-start entry; after a real reboot the server and companion
   must be started manually.
4. **Adapter-disabled offline run.** Local-only sockets and rule-engine config
   were verified, but the machine was not disconnected.
5. **Mac R1.** Still blocked on host-key trust and GUI evidence.
6. **Muse G4.** Still NOT VERIFIED. Supplementary subagent evidence is not a
   Muse sign-off.
7. **Windows default pins.** Some seeded pins still use macOS bundle IDs
   (`Notes`, `Browser`, `VS Code` placeholder) and fail if clicked on Windows.
   Use the dock `+ Add` flow for native apps. This should be cleaned before a
   daily-use claim.

## 5. How to run on Windows

From the repository root:

```powershell
npm install
npm start
```

`npm start` builds the web app and prints the bridge token path. Keep the server
running, then start the companion in a second terminal:

```powershell
.\win-companion\build.ps1
.\win-companion\bin\FocusDockCompanion.exe --backend http://127.0.0.1:4317 --token-file <token-file-printed-by-server> --show-status
```

Open <http://127.0.0.1:4317>. Add native apps with the dock `+ Add` tile. The
companion and server are both loopback-only; the bridge token is created by the
server.

Optional verification:

```powershell
npm run verify
.\win-companion\bin\FocusDockCompanionCli.exe --self-test
```

## 6. Evidence index

All paths are relative to the repository root.

| Area | Evidence |
|---|---|
| R3 editor suggestion | `qa/evidence/native/r3-editor-suggestion.png`, `r3-editor-flow.json` |
| R3 pinned editor launch | `qa/evidence/native/r3-editor-pinned-dock.png`, `r3-editor-launch-toast.png` |
| R3 30 s social pause | `qa/evidence/native/r3-social-30s-first.png`, `r3-social-30s-ready.png`, `r3-social-30s-launch.png`, `r3-social-30s.json` |
| R3 restart / cleanup | `qa/evidence/native/r3-restart-before.json`, `r3-restart-after.json`, `r3-restart-cleanup.txt`, `r3-restart-dock.png` |
| R3 local-only check | `qa/evidence/native/r3-restart-local-only.txt` |
| R3 bilingual | `qa/evidence/native/r3-bilingual-zh.png`, `r3-bilingual-en.png`, `r3-bilingual.json` |
| R2 foreground / launch | `qa/evidence/native/00-windows-companion.png`, `01-web-topbar-zh.png`, `02-web-topbar-en.png`, `r3-launch-audit.log` |
| Full report | `NATIVE_RECOVERY_REPORT.md` |
| Companion source | `win-companion/src/` |

## 7. Decision for the project lead

Recommended next decision:

1. **Product:** ask the user for the required value assessment before any
   `GO`. If the answer is negative, park the project as an experimental
   prototype rather than adding features.
2. **Packaging:** only after a positive value answer, add a Windows installer /
   optional auto-start and replace macOS placeholder pins with native or
   bookmark defaults.
3. **Evidence:** if a real social app test is required, define a privacy rule
   first (which app, what may be shown, no message screenshots).
4. **Release:** no v0.2 public Release or Profile marketing until the user
   explicitly approves and R2+R3 real-world evidence is accepted.
5. **Muse:** re-dispatch only against an accessible repository/release; keep
   G4 NOT VERIFIED until a real Muse report exists.

## 8. Verification commands and CI

- R3 evidence commit: `236115b`
- Shutdown fix: `87ba975`
- CI for `236115b`: run `41480919475` — success
- CI for `87ba975`: run `41475843568` — success
- CI for `1ad22db`: run `41470500051` — success
- R2 CI: run `41409028974` on `c7a766e` — success
- `npm test`: 57 passed (53 server + 4 web), including the WebSocket shutdown
  regression test
- Companion `--self-test`: 6 checks pass, including executable icon extraction

Raw logs containing user-specific app names, private paths, or tokens were not
included in the public evidence.
