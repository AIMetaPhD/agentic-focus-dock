# QA Report — v0.1.0

Status: **development verification complete; independent Muse QA PENDING.**
This file is written by the implementation owner. It is **not** a Muse sign-off.

## Environment

| Item | Value |
|---|---|
| OS | Windows 11 Pro 10.0.26200 (x64) |
| Node | v24.12.0 |
| Browser (E2E) | Playwright Chromium, 1440×900 |
| Commit under test | recorded in the final delivery message (repo commit SHA) |
| Data | isolated `qa/e2e-data`, wiped per run; screenshots use synthetic data |
| macOS | **not available** — G3 NOT VERIFIED |

## Automated results

Command: `npm test && npm run test:e2e` (also `npm run verify` in CI).

| Suite | Result |
|---|---|
| Server unit + integration (Vitest) | **52 passed, 0 failed** |
| Web unit (Vitest) | **4 passed, 0 failed** |
| Playwright end-to-end | **13 passed, 0 failed** |
| TypeScript | clean |
| ESLint | clean |
| Secret scan | clean (tracked files only) |

### What the automated tests prove

- Session issuance, HttpOnly/SameSite flags, unauthenticated rejection.
- Evil `Host` → 421; evil `Origin` → 403; missing CSRF → 403.
- Cross-origin WebSocket rejected (403), no-session WS rejected (401).
- Bridge Bearer token works only on `/api/bridge/*`; browser Origin on a bridge
  call rejected; wrong token rejected.
- Mode CRUD, persistence across a DB reopen, last-mode deletion guard.
- Social defer, `wait_not_elapsed` (409), `Stay`, zero-wait `Go to Social`,
  urgent classification, dedupe.
- Proposal diff/apply/rollback over HTTP; double apply rejected; unsupported
  instructions rejected with 422.
- 50-event burst policy: 8 urgent, 42 deferred; timeline renders 50 items.
- Oversized body → 413; malformed JSON → 400 without stack traces.
- API key never appears in settings responses, the DB, or exports; bridge token
  never appears in the HTML shell or exports.
- UI: six modes, notification card labels, stay flow, urgent flow, Building
  suggestion and switch, reload persistence, manual lock, AI diff/apply,
  rollback, new-mode creation, English/Chinese switch, capability truth.

## Evidence index

| Evidence | Path |
|---|---|
| Writing dashboard | `qa/evidence/00-focus-writing.png` |
| Notification card (`SIMULATED`, countdown) | `qa/evidence/01-notification.png` |
| Building after suggested switch | `qa/evidence/02-focus-building.png` |
| AI proposal diff | `qa/evidence/03-ai-diff.png` |
| Mode editor + version history | `qa/evidence/04-mode-editor.png` |
| Permissions & capabilities | `qa/evidence/05-permissions.png` |
| Chinese settings | `qa/evidence/06-settings-zh.png` |
| Timeline after 50-event burst | `qa/evidence/07-timeline.png` |
| Playwright HTML report | `qa/evidence/playwright-report/` |
| Test sources | `server/test/`, `web/src/*.test.ts`, `tests/e2e/` |

## Not verified

| Item | Reason | Required evidence |
|---|---|---|
| macOS floating Dock (G3) | no Mac available | real Apple Silicon run + screenshots/logs per `mac-bridge/README.md` |
| Accessibility grant/deny on macOS | no Mac | system settings screenshot + event log |
| Multi-display / full-screen / sleep-wake | no Mac | recording per scenario |
| Live Ollama provider | no local model installed | request/response log + latency |
| Live OpenAI-compatible provider | no endpoint/key used | opt-in screenshot + provider response |
| Public GitHub release | awaiting user authorization | repo visibility + Release URL |
| `AIMetaPhD` profile PR | depends on public release | PR URL |

## Independent Muse QA

**PENDING.** The implementation owner will send the repository, build commands,
test environment and this report to Muse. Muse must produce its own verdict and
`MUSE_QA_SIGNOFF.md`; the development owner must not write or approve it.

No Sev0/Sev1 defect was found by the automated suite. That is not a substitute
for independent QA, and it does not cover the macOS-only items above.
