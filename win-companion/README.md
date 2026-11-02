# FocusDock Native Companion — Windows

Minimal Windows user-session companion for the FocusDock web core. It uses the
built-in .NET Framework compiler, so no .NET SDK download is required on this
workstation.

## What it does

- Observes real foreground-window changes with `SetWinEventHook`.
- Resolves the process id, process name and executable path.
- Posts authenticated activity events to the local FocusDock backend
  (`/api/bridge/events`) using the per-run bridge token.
- Enumerates installed Start Menu applications, resolves `.lnk` targets to
  existing `.exe` files, and launches only a selected, verified target.
- Shows a tray icon and a bilingual status window.
- Writes a local audit log for every launch/rejection and a companion log.

## What it does not do

- It does not read or suppress other applications' notifications.
- It does not send keystrokes, clipboard, screen contents or browser history.
- It does not accept a free-form command line or arbitrary URI from the web UI.
- It does not replace or modify the Windows taskbar or the macOS Dock.

## Build

```powershell
cd win-companion
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

This produces `bin\FocusDockCompanion.exe` (tray) and
`bin\FocusDockCompanionCli.exe` (console/self-test).

## Self-test

```powershell
.\bin\FocusDockCompanionCli.exe --self-test
```

Expected: `SELF-TEST PASS`.

## Launch an installed app from the allowlist

The same resolved Start Menu catalog used by the tray picker can be exercised
non-interactively:

```powershell
.\bin\FocusDockCompanionCli.exe --launch "Notepad"
```

A name that does not resolve to an installed `.exe` is rejected. The launch and
its SHA-256 are written to `%LOCALAPPDATA%\FocusDock\win-companion-audit.log`.

## Run against the local app

Start FocusDock first, then pass the token file that belongs to that instance.
For the default FocusDock data directory:

```powershell
.\bin\FocusDockCompanion.exe --backend http://127.0.0.1:4317 --show-status
```

For a trial data directory:

```powershell
.\bin\FocusDockCompanion.exe `
  --backend http://127.0.0.1:4317 `
  --token-file "<repo>\.tmp-data\trial\runtime\bridge-token" `
  --show-status
```

The status window shows the backend, native connection state, a privacy-safe
"native app detected" line, event count and last error. Pass `--show-app-names`
only when you explicitly want real app names in that window. The tray menu can
open the status window, launch an installed app, open the dashboard, or exit.

## Security notes

- The bridge token is read from the file created by FocusDock and sent only in an
  `Authorization: Bearer` header to loopback.
- The companion never sends an `Origin` header; the backend's bridge routes reject
  browser-origin calls.
- The app picker only lists resolved `.exe` targets that currently exist. Launch
  computes the SHA-256 of the target and records it in the local audit log.
- Window titles are off by default; pass `--titles` only for an explicit test.
- The companion exits by removing the tray icon, unhooking the WinEvent hook and
  sending `/api/bridge/disconnect`.
