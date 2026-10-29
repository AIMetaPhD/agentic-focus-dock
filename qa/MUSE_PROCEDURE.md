# Independent QA procedure — FocusDock AI (G4)

You are Muse, the independent QA engineer. The implementer's own tests are
reference material only. Your verdict must come from what you personally ran.

Authorization: the product owner explicitly asked the implementer to coordinate
this QA directly with Muse on 2026-10-30. This is a normal software-testing task
on synthetic data.

## Fixed facts

- Repository on this Windows workstation:
  `E:\ClaudeCodeFiles\MyProducts\agentic-focus-dock`
- Product commit under test: the exact `commit_sha` in the queue task inputs.
- Platform: Windows 11, Node 24. The macOS bridge cannot be tested here.
- Product data: synthetic demo events only. Do not open any personal data
  outside the repository and its temporary copy.

## Rules

- Do not modify, commit, or push the product repository.
- Work in a temporary clone outside the repository.
- Do not claim macOS results. If you lack a capability, mark the check BLOCKED.
- The implementer's test results are not your evidence. Re-run the commands and
  write what you observed.
- Time box: 30 minutes from claim. Post a partial honest verdict rather than
  letting the task expire.

## Steps

1. Create a temporary clone and check out the exact commit:

```powershell
$repo = "E:\ClaudeCodeFiles\MyProducts\agentic-focus-dock"
$sha  = "<commit_sha from inputs>"
$temp = Join-Path $env:TEMP ("focusdock-qa-" + (Get-Random))
git clone --no-hardlinks $repo $temp
git -C $temp checkout $sha
git -C $temp rev-parse HEAD
```

2. Install and run the automated suites:

```powershell
cd $temp
npm ci
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
```

Record exact counts. A failure is a finding, not something to work around.

3. Start a separate server for black-box probes (do not use the Playwright run):

```powershell
$env:FOCUSDOCK_DATA_DIR = Join-Path $temp "qa-data"
$env:FOCUSDOCK_PORT = "4391"
$env:FOCUSDOCK_PORT_STRICT = "1"
$env:FOCUSDOCK_NO_OPEN = "1"
Start-Process node -ArgumentList "node_modules/tsx/dist/cli.mjs","server/src/index.ts" -WorkingDirectory $temp
```

Wait for `http://127.0.0.1:4391/api/health` to return 200.

4. Work through the checks below. Capture the command and the observed response
   for each. Use any HTTP client; PowerShell examples are only a suggestion.

### W-01 Start with no network and no model

- Fresh data folder, start the server.
- `GET /api/health` → 200.
- `GET /api/state` without a session → 401.
- `GET /` → the app shell with a session cookie.
- Restart with the same data folder: modes and the active mode persist.

### W-02 Mode management

- Create a mode via `POST /api/modes` (needs session, origin, CSRF header).
- Update it, read it back, delete it.
- Create another, reorder, export, reset, import the export.
- Verify a refresh/restart keeps the mode.

### W-03 Dock and UI

- Use the Playwright run or a browser at 1440×900.
- Six mode pills, Writing active, `aria-pressed="true"` on the active pill.
- Keyboard focus reaches the pill and the lock button.
- Narrow viewport (375 px) remains usable; mode names collapse but the active
  one is readable.
- Screenshots must show `SIMULATED` on demo data.

### W-04 Notification flow

- Demo Slack message during Writing → deferred card, label `SIMULATED`,
  `Held for social`, countdown visible.
- `Stay` keeps Writing. `Later` closes the card without changing mode.
- `Go to Social` before the countdown ends → 409 `wait_not_elapsed`.
- Set Writing's wait to 0, create another message, `Go to Social` → active mode
  becomes Social.
- Urgent/time-sensitive event → immediate card.

### W-05 Activity classification

- `POST /api/demo/activity` with `com.microsoft.VSCode`, `stable_seconds: 20`
  during Writing → suggestion for Building after the dwell.
- `stable_seconds: 5` → hold by dwell.
- Rapid events → no mode flap; check the cooldown reason.
- Manual lock on → suggestion only, never auto-switch.
- Unknown app → stay with low confidence.

### W-06 AI configuration and failure handling

- Default provider `rules`: a proposal is created with a diff.
- Set provider `ollama` with no server running, then request a proposal: the
  response must fall back to rules (`source: rules-fallback`) or fail clearly;
  it must not apply anything.
- Malformed/unsupported instruction (`rm -rf / ...`) → 422, no mode change.
- Check that the AI key is never present in `/api/settings`, `/api/export`, or
  the SQLite file. Do not enter a real key.

### W-07 Agent mode edits

- `POST /api/proposals` with a create request → diff → apply → mode exists.
- Apply an edit, then roll back to the previous version: values and behavior
  return to the old state, history is preserved.
- Attempt a path outside `/modes/*` and a field outside the allowlist: rejected.
- Apply the same proposal twice: second apply 409.

### W-08 Privacy and data lifecycle

- Export contains modes/settings only; no events, no session, no bridge
  authentication value.
- Clear events empties the timeline; reset restores the six default modes.
- Retention setting is persisted.
- Settings show the data folder; no event contents appear in server stdout.

### W-09 Loopback access control

With your own requests, verify:

- `Host: evil.example:<port>` → 421.
- Cross-site `Origin` on a mutation → 403.
- Missing `X-FocusDock-CSRF` → 403.
- No session → 401.
- WebSocket with an evil `Origin` → 403; without a session → 401.
- `/api/bridge/*` without its Bearer value → 401; the same value on
  `/api/state` → 401.
- Oversized JSON body → 413.
- No permissive CORS header is returned.

### W-10 Windows 11

- Record OS build, Node version, browser version.
- The full web flow above must work without any Mac component.

### M-01..M-04 macOS

BLOCKED on this host. Record the reason. Do not sign these off.

### R-01..R-03 Release and license

- R-01: the repository is private; a fresh clone plus `npm ci` is the available
  release check. Public Release: BLOCKED.
- R-02: read `docs/THIRD_PARTY_AUDIT.md`, `NOTICE.md`, `LICENSE`; check that no
  GPL/proprietary source is present.
- R-03: `AIMetaPhD/AIMetaPhD` profile PR: BLOCKED (not public yet).

## Verdict format (return in the queue result)

```json
{
  "gate": "G4",
  "commit_sha": "<exact>",
  "tester": "muse-1",
  "environment": "Windows 11 build ..., Node ..., Chromium ...",
  "checks": [
    { "id": "W-01", "status": "PASS", "observed": "..." }
  ],
  "bugs": [
    {
      "id": "FD-001",
      "severity": "Sev0|Sev1|Sev2|Sev3",
      "title": "...",
      "steps": "...",
      "expected": "...",
      "actual": "...",
      "evidence": "..."
    }
  ],
  "not_verified": ["M-01", "M-02", "M-03", "M-04", "R-01 public release", "R-03"],
  "signoff": "PASS|CONDITIONAL|FAIL|NOT VERIFIED",
  "notes": "..."
}
```

Return it as the queue result evidence under `verdict`, with your full human
report under `report_markdown`. Do not write a verdict file into the repository;
the implementer will preserve your queue result byte-for-byte.

## Severity guide

- Sev0: data loss, remote control of the machine, product cannot start.
- Sev1: core Writing/Building flow broken, access-control bypass, unconfirmed
  mode mutation, clear license violation.
- Sev2: recoverable UI/config defect, incomplete feature.
- Sev3: cosmetic or wording.

If any Sev0/Sev1 or security/privacy/license issue remains, the signoff is FAIL.
A Web PASS does not cover macOS.
