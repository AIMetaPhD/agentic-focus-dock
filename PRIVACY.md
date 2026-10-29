# Privacy

FocusDock is local-first. There is no account, no telemetry, no analytics, and no
remote logging.

## What is stored

| Data | Where | Default retention | Notes |
|---|---|---|---|
| Mode definitions and versions | `focusdock.db` | until deleted | user content |
| Settings | `focusdock.db` | until reset | language, provider config, retention |
| Event metadata (app id/name, simulated message title/body) | `focusdock.db` | 7 days | pruned at startup and on settings save |
| Pending notification queue | `focusdock.db` | until decided | `Stay` / `Later` / `Go to Social` |
| Audit log (mode changes, proposals, resets) | `focusdock.db` | last 2,000 entries | no event contents |
| Cloud API key (optional) | `secrets.json` in the app data folder | until removed | never in SQLite, logs, exports or localStorage |
| Bridge token | `runtime/bridge-token` | while the server runs | deleted on clean shutdown |

Window titles are **off by default**. The macOS bridge only reads them when
launched with `--with-titles` **and** Accessibility permission is granted.
Without permission it reports bundle ids and app names only.

## What is never collected

- Other apps' notification contents or Notification Center databases.
- Keystrokes, clipboard, screen contents, browser history, or files.
- Any data from apps you exclude in Settings.
- Any telemetry about how you use the app.

## Cloud AI

The default provider is the deterministic rules engine. A cloud endpoint is used
only when you:

1. select “OpenAI-compatible endpoint”,
2. enable “Allow cloud proposals”, and
3. save an API key.

The request contains your prompt and a summary of mode names/ids — not your
event timeline, window titles, or message contents. “Include recent activity
summaries” is a separate opt-in and is currently not sent by the v0.1 adapter.
Ollama stays on your machine.

## Your controls

- **Settings → Privacy**: retention days, excluded apps, whether titles may be
  stored.
- **Settings → Local data**: export modes, import modes, clear events, reset all
  product data.
- **Permissions**: see exactly what is supported; rotate the bridge token.
- Delete the data folder to remove everything outside the app.

## Logs

The server prints startup information (URL, data folder, bridge token path) and
errors (`method`, `path`, error name/message). It does not log cookies,
authorization headers, request bodies, event contents, or API keys.

## Contact

Open a GitHub issue for privacy questions that do not involve a vulnerability;
use the private advisory flow in [SECURITY.md](SECURITY.md) for sensitive
reports.
