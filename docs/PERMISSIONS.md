# Permissions

The app is designed so the browser core needs **no system permission at all**.

| Permission | When | What happens if denied |
|---|---|---|
| Local network (loopback) | always | none needed; the server binds 127.0.0.1 |
| Accessibility (macOS) | only with `--with-titles` | bridge reports bundle ids/app names only; no crash, no prompt loop |
| Screen Recording | never requested | not used |
| Notifications (UNUserNotificationCenter) | never | the app only shows its own in-page cards |
| Full Disk Access | never requested | not used |
| Automation / AppleScript | never requested | no shell or AppleScript execution |

## macOS Accessibility

1. Start the web app, then launch the bridge with `--with-titles`.
2. The bridge reports `accessibility: denied` until you grant it.
3. Open **System Settings → Privacy & Security → Accessibility** and enable
   `FocusDockBridge`.
4. Restart the bridge. The Permissions panel should show `granted` and window
   titles may appear in the timeline.
5. To revoke: disable it in the same panel; the bridge immediately degrades to
   bundle ids on the next event.

The bridge never reads window contents, keystrokes, or other apps' data.

## Why "Other apps' notifications" is marked unsupported

`UNUserNotificationCenter` only exposes the notifications your own app
schedules. There is no public API to enumerate, delay, or suppress another
application's notifications. FocusDock does not read Notification Center
databases, inject code, or change system notification settings.

The in-product queue and 30 s cool-down apply only to events FocusDock itself
created or simulated. Third-party connectors are out of scope for v1.

See [CAPABILITIES.md](CAPABILITIES.md) for the full matrix.
