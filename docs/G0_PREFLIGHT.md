# G0 — Preflight, Security Contract & Native Feasibility

Date: 2026-10-30
Owner: Claude Code (implementation owner)
Status: **CONDITIONAL** — Web track PASS, macOS native spike **BLOCKED (no Mac host)**

## 1. Host and toolchain (measured, not assumed)

| Check | Command | Result |
|---|---|---|
| OS | `uname -a` | `MINGW64_NT-10.0-26200 ... x86_64 Msys` (Windows 11 Pro 10.0.26200) |
| Node | `node -v` | v24.12.0 |
| npm | `npm -v` | 11.6.2 |
| Python | `python --version` | 3.13.9 (not required by the shipped app) |
| Git | `git --version` | 2.55.0.windows.4 |
| GitHub CLI | `gh auth status` | logged in as `AIMetaPhD`; scopes `repo`, `workflow`, `gist`, `read:org` |
| Swift | `command -v swift` | **NOT FOUND** |
| Xcode | `command -v xcodebuild` | **NOT FOUND** |
| SSH hosts | `grep '^Host ' ~/.ssh/config` | only `github.com` — no macOS host reachable |
| npm registry | `npm ping` | PONG (1591 ms) |
| Built-in SQLite | `node -e "new DatabaseSync(':memory:')"` | works (Node prints `ExperimentalWarning`) |
| Target repo | `gh repo view AIMetaPhD/agentic-focus-dock` | **404 — does not exist yet** |

## 2. macOS native spike

Requirement: real `NSPanel` + `WKWebView` overlay, `NSWorkspace` activation events,
bridge authentication and an action allowlist, with no residual window on quit.

**Status: BLOCKED.** This workstation is Windows 11 x64. There is no Swift toolchain,
no Xcode, and no reachable Mac (local or SSH). Per `05_FINAL_DECISIONS_AND_GATE_RULES.md`
this must not be reported as verified.

What was delivered instead (and how it is labelled):

1. `mac-bridge/` contains the real Swift Package source for the spike and the
   production-shaped bridge (NSPanel, WKWebView loading the local `/dock` route,
   NSWorkspace observer, scoped Bearer token, action allowlist, cleanup on quit).
2. `.github/workflows/ci.yml` compiles it on a `macos-14` (Apple Silicon) runner and
   runs the non-UI unit tests. A green compile is **compile evidence only** — it is not
   evidence that the floating overlay works on a user's desktop.
3. `docs/CAPABILITIES.md` and the UI report `mac_bridge: not_connected` until a real
   bridge handshake arrives over loopback.

**Unblock procedure (needs a real Apple Silicon Mac):**

```bash
cd mac-bridge
swift build -c release
.build/release/FocusDockBridge --backend http://127.0.0.1:4317
```

Then verify: overlay appears above normal windows; clicking a mode pill changes the
mode in the Web UI; switching apps emits `bridge.activity` events; quitting removes
the panel (no residual process/window); Accessibility denial degrades to bundle-id
only; system Dock is untouched.

## 3. Upstream license verification (2026-10-30, GitHub API)

| Repo | License found | Decision |
|---|---|---|
| `josejuanqm/docky` | GPL-3.0 (`LICENSE`) | Reference interaction only. **No code copied.** |
| `Hammerspoon/hammerspoon` | MIT | Reference only for public `NSWorkspace` patterns; no code copied in v1. |
| `milind-soni/tiptour-macos` | LICENSE text is **MIT** (GitHub API reports `NOASSERTION`, classifier miss) | Reference only; no code copied. |
| `TheBoredTeam/boring.notch` | GPL-3.0 | Reference interaction only. **No code copied.** |
| `The-Portland-Company/focus-dock-for-macos` | **No LICENSE file** → all rights reserved | Research only. Also writes `com.apple.dock` and runs `killall Dock`, which this project forbids. **No code copied.** |

No upstream source code is vendored. See `docs/THIRD_PARTY_AUDIT.md` for the full list
including npm dependencies.

## 4. Gate result

| Item | Status | Evidence |
|---|---|---|
| Host/toolchain inventory | PASS | section 1 |
| License matrix | PASS | section 3, `THIRD_PARTY_AUDIT.md` |
| Threat model | PASS | `docs/THREAT_MODEL.md` |
| Architecture contract fixed | PASS | `docs/ADR-001-ARCHITECTURE.md`, `docs/API.md` |
| Scope P0/P1/Later fixed | PASS | `docs/SCOPE.md` |
| Real macOS overlay spike | **BLOCKED** | no Mac; Swift source + CI compile only |
| GitHub private repo | pending | created in G1 delivery step |

**G0 = CONDITIONAL.** The Web track (G1/G2) is not blocked. Any claim that the macOS
overlay is complete is prohibited until the unblock procedure above is executed on a
real Mac and its evidence is attached.
