# FocusDock AI — Native Recovery Decision & Claude Code Execution Order v0.2

**Date:** 2026-11-02
**Owner:** ChatGPT (project lead)
**Recipient:** Claude Code (development lead; coordinates Muse/independent QA)
**Decision:** CONDITIONAL GO, narrowly scoped native feasibility + actual-workflow validation.
**Repo:** https://github.com/AIMetaPhD/agentic-focus-dock
**Input:** `FocusDock_ChatGPT_Handoff_2026-11-02.md`, v0.1.0 source, G0 preflight, capability and QA docs.

## 0. Binding product decision

Stop expanding the Web dashboard or the simulated event console. Do **not** rewrite the React/Fastify/SQLite core, migrate frameworks, or begin a new visual-polish sprint. The existing v0.1.0 is an **experimental Web prototype**, **not** a daily-use desktop focus assistant. Preserve the repository and existing working tests.

The success criterion is no longer “more features/tests.” It is **at least one genuine operating-system desktop session producing observable activity events that drive a meaningful user-approved action**. Windows 11 is the primary platform because it is the active development workstation. The existing macOS Bridge is to be checked on the actual MacBook connected via Tailscale, **early and independently**, without postponing Windows development. A functioning Mac proves the concept; it does not substitute for Windows daily usability.

Use the shared Web UI and local backend as product core. Add native companions per platform. No browser-only implementation or mock can pass a native gate.

## 1. Gate R0 — truthful inventory and remote Mac reachability

1. Record repository revision, OS sessions, available tools, version and test results. Review all current action/bridge endpoints and `/dock` route. Do not assume previous documentation corresponds to working capabilities.
2. On Windows, find the **already-configured** Tailscale connection to the user's MacBook (e.g. `tailscale status`, existing SSH config). Do not print Tailscale addresses, credentials or private hostnames in public logs/screenshots. Do not assume Tailscale itself enables remote command execution.
3. Prefer **ordinary macOS Remote Login (SSH over Tailscale)**. Apple's `System Settings → General → Sharing → Remote Login` must permit the selected user; use SSH keys or existing secure login. **Do not instruct users to disable SIP, grant Full Disk Access, or open inbound internet ports.** Tailscale SSH is optional; the macOS GUI-distributed Tailscale app should not be assumed to provide the Tailscale SSH server feature.
4. Run a harmless remote probe (`uname -m`, `sw_vers`, `xcodebuild -version` if present, `node -v`, `id -u`) after authenticated SSH access. First-login host fingerprints must be checked through an independent trusted channel. If SSH is not enabled, give the user the *single specific macOS control* they must authorize; do not invent connection success.
5. A remote SSH shell does not itself prove a GUI session: record whether a user is logged into the physical macOS desktop, whether the display session is active, and how screen/video evidence can be captured with the user's consent (Screen Sharing/VNC over the tailnet or physical Mac capture). Do not claim an `NSPanel` is visible based solely on an SSH process or successful build.

**R0 pass:** clear, independently verifiable reachability matrix and real host access where available. **Blocked** if remote permission/session is unavailable; do not turn Blocked into Pass.

## 2. Gate R1 — Mac hardware smoke test of *existing* bridge (quick validation, not a Mac-first rewrite)

1. On the Mac itself, obtain the source in a separate working tree, start the existing Node local backend bound **only to Mac `127.0.0.1`**, and compile/run `mac-bridge/` as the Mac desktop's **logged-in GUI user**. Backend + bridge must run on the **same Mac**; their current loopback/token contract is per-machine. Do not point the Mac bridge straight at a Windows `127.0.0.1` service.
2. Switch among real Mac apps (Finder, Safari, Terminal or VS Code). Capture the actual `NSWorkspace` event in the backend with platform, source, bundle id, time and app name. Confirm rule suggestions are driven by these real events, not the simulator.
3. Observe the `NSPanel + WKWebView` on the actual Mac screen and verify basic user interaction without stealing focus. If the overlay fails, capture a precise failure and fix only what is needed for the smoke test.
4. If Win browser access to Mac-hosted Web UI is desired, use authenticated SSH local forwarding, e.g. on Windows **when its port 4317 is free**: `ssh -N -L 127.0.0.1:4317:127.0.0.1:4317 <mac-user>@<mac-tailnet-host>` then open Windows `http://127.0.0.1:4317`; retain current strict Host/Origin/CSRF validation. No binding on `0.0.0.0`, no public tunnel, no sending bridge token to the Windows browser. This is access to the Mac's backend, not the Windows host's active apps.
5. If the session is headless, asleep, or no GUI login exists, record as `GUI BLOCKED`; do not counterfeit an overlay success. Do not request broad system permissions merely to make the smoke test pass.

**R1 pass:** real Mac foreground-app events + live UI signal + actual screenshot/video of Mac overlay; events labelled `macOS / native / real`. If partly verified, report each subitem individually.

## 3. Gate R2 — Windows native companion (primary development goal)

1. Design and implement the **smallest** conventional Windows user-session companion, preferably a standalone C#/.NET desktop/agent process using Win32 P/Invoke with a minimal tray/control surface. Reuse the existing React `/dock` where helpful (WebView2 is optional). Do not rewrite as Electron/Tauri unless a recorded and testable blocker demands it.
2. Use public `GetForegroundWindow`, `GetWindowThreadProcessId`, safe process metadata and optional top-level `GetWindowText` to detect app switches. Prefer official foreground-change event hooks (`SetWinEventHook`) or bounded polling with deduplication. Handle null/short-lived windows, PID reuse, elevated targets, session changes and the companion's own window. Do **not** install keyboard hooks, screen scrapers, browser history scraping or default clipboard collection.
3. Each genuine event is authenticated over loopback IPC and includes the machine/platform, `source=native_windows`, process/app identity, event timestamp and non-sensitive context. Exclude the app's own internal UI by default. Keep window titles off by default, with an opt-in and retention limit.
4. Add a **real installed app picker / application registry** rather than hard-coded X/Email tiles. Allowlist only the installed program identifier or a resolved trusted executable path with verified launch metadata; do not accept arbitrary command line, shell, `cmd /c`, PowerShell or untrusted URI from the Web UI/LLM. A user click may launch/activate an approved app and must produce a success/failure audit. Unknown, modified or out-of-allowlist requests are rejected. Elevation must not be requested.
5. Make Windows real app events drive the existing dwell/hysteresis rules and Writing/Building suggestions. A user can confirm a suggestion or explicitly opt into safe auto-switching. Preserve manual lock as a **mode-suggestion lock**, not a system app blocker.
6. After foreground detection + app launching work, provide a small visible desktop surface (always-on-top floating dock or tray + popover) that reuses Web features; prove actual interaction. Full multi-monitor/performance polish follows the native viability gate, not before.
7. Preserve strict local service protections: 127.0.0.1 bind, Host+Origin checks, CSRF, session restrictions, per-run scoped bridge credentials, action allowlist, logging without secrets, rate-limits and kill/disconnect behavior. UI pages must not be able to launch apps via unauthenticated localhost requests.
8. Provide top-level 简体中文 / English switch and an accurate default based on detected locale or user settings; both language paths must be exercised. Display explicit `Windows — connected`, `macOS — connected`, or `Web-only — no native access` states.

**R2 acceptance:** Windows 11 physical logged-in user session detects at least three genuinely distinct foreground apps (e.g., VS Code/Notepad/Chrome) without demo console; correct label and mode suggestion from real events; real allowlisted launch of one installed app; blocked unknown launch; user-visible native/tray interaction; proof of proper disconnect; bilingual UI. Target under 1 s from stable foreground change to recorded observation under ordinary desktop conditions, with measured value reported; 15 s stable dwell before suggestions by default. No unsubstantiated claims about all fullscreen/multi-monitor cases.

## 4. Gate R3 — usefulness test (mandatory product decision)

Demonstrate the complete real workflow on **Windows**, not just source compilation:

- Start app normally in an interactive Windows login; mode default Writing.
- Switch into a real code editor; observe native foreground event and a validated Building suggestion after dwell. User confirms; mode and dock state change.
- Click a pinned **real** allowlisted editor/browser (not a bookmark pretending to be an app); confirm launch/activation and auditable result.
- Click a social item **through FocusDock**; observe opt-in, cancelable 30 s focus pause when configured. Make clear that the user can still open it outside FocusDock; **no OS-wide blocking is claimed**.
- Reboot/restart the app; verify settings persist, stopped agent does not leave windows or background listeners, and app functions without cloud model or internet.
- Confirm all paths are understandable in both Simplified Chinese and English, and the native-connected status reflects reality.

**User value test:** after the technical test, ask for an actual user assessment of whether the tool saves context-switching friction during normal work. Do not equate 'automated tests passed' with 'useful.'

## 5. Gate decision / explicit stopping rules

- **GO** only if R2 and R3 produce genuine Windows user-session evidence and at least one real practical workflow. R1 adds cross-platform feasibility evidence but must not be relabelled pass without a Mac GUI test.
- **CONDITIONAL** if the Mac flow works but Windows remains incomplete: continue only the *specific* Windows blocker, without adding new features or making another broad public release.
- **STOP / PARK** if neither platform yields genuine foreground detection + an authorized real action, if the only successful test is CI/simulator, or if the user concludes the real workflow is not worth adopting. Mark the repository `experimental/prototype`, state its limitations honestly and stop feature development; do not delete existing open-source work.
- No v0.2 public Release, promotion as a daily-use focus agent, or further Profile marketing until R2+R3 real-world evidence and user approval. Existing v0.1.0 remains public and is accurately labelled a prototype.

## 6. QA and evidence contract

- Development lead Claude Code coordinates Muse. Re-dispatch to Muse against an accessible repository/release instead of a private workstation path or opaque source archive. If Muse remains inaccessible, retain precise blocker proof and use a *separate* clean-context QA subagent as clearly labelled supplementary evidence; never forge Muse PASS.
- Evidence must include git commit SHA, Windows/macOS OS version, hardware, console output/structured event log with redacted private names, screenshots/video from the actual host GUI session, app-launch audit + rejection, permissions/denial behavior, and reviewer verdict for each gate.
- Preserve v0.1.0 tests; add automated native event parsing, IPC security and allowlist rejection tests. Flag missing device tests `NOT VERIFIED` rather than PASS.
- Keep sensitive process names, titles, Tailnet details, credentials and API keys out of public artifacts.

## 7. Required return to ChatGPT (do not write only a design document)

Provide `NATIVE_RECOVERY_REPORT.md` containing:

1. Current commit and exact touched files.
2. R0/R1/R2/R3 PASS/FAIL/BLOCKED/NOT VERIFIED matrix (no blended status).
3. Real Windows and Mac observations + evidence file paths; classify SIMULATED/REAL.
4. Implemented vs proposed vs blocked abilities; no misleading checkmarks.
5. Technical decisions, security regression and license checks.
6. Demonstrated practical workflow; what remains unproven and why.
7. Clear GO/STOP recommendation and no auto-public release.

**Immediate instruction:** start R0 and R1 access test alongside Windows R2 minimal native foreground-monitor spike. Prioritize proving the OS integration before aesthetics or further simulation. Only ask the user for genuinely necessary permissions (e.g., enabling Mac Remote Login or GUI screen sharing) and do not claim remote device access unless demonstrated.
