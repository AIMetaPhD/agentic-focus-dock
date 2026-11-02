# FocusDock Bridge (macOS, optional)

A small AppKit agent that shows the FocusDock dock as a floating `NSPanel`
containing a `WKWebView` pointed at the local `/dock` route. It also reports
frontmost-app changes using the public `NSWorkspace` API.

**Status: source complete, real-device verification NOT VERIFIED.** This
repository was built on Windows. The Swift package compiles in CI on a
`macos-14` runner, but no one has yet observed the overlay on a real Mac
desktop. See `../docs/G0_PREFLIGHT.md` §2 for the verification checklist.

## Build

```bash
cd mac-bridge
swift build -c release
swift test
./build-app.sh
```

The app bundle is written to `mac-bridge/.build/FocusDockBridge.app` and is
ad-hoc signed only. It is not notarized; do not present it as a consumer
installer.

## Run

Start the web app first (`npm start` in the repository root), then:

```bash
open ".build/FocusDockBridge.app" --args --backend http://127.0.0.1:4317
```

The bridge reads the per-run token from:

```
~/Library/Application Support/FocusDock/runtime/bridge-token
```

Override with `--token-path`. The token is sent only in an `Authorization`
header and is never logged or put in a URL.

Optional window titles:

```bash
open ".build/FocusDockBridge.app" --args --with-titles
```

This asks for Accessibility permission. If denied, the bridge still reports
bundle ids and app names and the web app keeps working.

## What it does and does not do

- ✅ Floating borderless panel above normal windows, joins all Spaces, works
  alongside full-screen apps.
- ✅ Loads only the local `/dock`, `/`, and `/assets/*` routes; every other
  navigation is cancelled.
- ✅ Reports app activation with `NSWorkspace`; sends an immediate event and a
  15 s dwell event.
- ✅ Reports Accessibility status and degrades to bundle-id-only events.
- ✅ Quitting closes the panel and sends a disconnect; the system Dock is never
  touched.
- ❌ It does not replace, hide, or modify the system Dock.
- ❌ It does not read or suppress other apps' notifications.
- ❌ It does not execute shell commands, AppleScript, or launch apps; v0.1.0 has
  no app-launch endpoint.

## Verification checklist (needs a real Apple Silicon Mac)

1. `swift build -c release && swift test` — compile evidence.
2. Start the web app, run the bridge, confirm the panel appears above normal
   windows without stealing focus.
3. Switch between two apps; confirm `/api/events` shows `source: "bridge"` and
   the timeline updates in the browser.
4. Move the panel across two displays and toggle full-screen; confirm it remains
   visible or follows the active screen without a black border.
5. Deny Accessibility; confirm events still arrive with bundle ids only.
6. Quit the bridge; confirm the panel disappears, no process remains, and the
   system Dock is unchanged.
7. Sleep/wake and log out/in; confirm no stale window remains.

Record OS version, hardware, screenshots and the `swift build` log in
`qa/evidence/mac/`.
