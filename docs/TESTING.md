# Testing

## Commands

```bash
npm run typecheck    # server + web, strict TS
npm run lint         # ESLint 9 + typescript-eslint
npm test             # server (Vitest) + web (Vitest)
npm run test:e2e     # Playwright, starts its own isolated server
npm run verify       # secret scan + all of the above + build + E2E
```

The E2E launcher wipes `qa/e2e-data`, builds the web app and starts a strict
server on 127.0.0.1:4317. It never touches your normal data folder.

## Coverage map

| Area | Test file | Count |
|---|---|---|
| Activity rules (dwell, cooldown, lock, auto-switch) | `server/test/rules.test.ts` | 12 |
| Notification rules (urgent, social defer, 50-event policy) | `server/test/rules.test.ts` | included |
| Patch validation, diff, apply, rollback, offline parser | `server/test/proposals.test.ts` | 12 |
| API, sessions, modes, notifications, bridge auth | `server/test/api.test.ts` | 21 |
| WebSocket origin, secret handling, body limits | `server/test/security.test.ts` | 7 |
| i18n interpolation | `web/src/i18n.test.ts` | 4 |
| Dock, notification flow, suggestion, persistence | `tests/e2e/01-core.spec.ts` | 5 |
| AI diff/apply, rollback, mode CRUD, injection | `tests/e2e/02-ai-and-modes.spec.ts` | 4 |
| Capabilities, language, unauth/evil origin, burst | `tests/e2e/03-settings-security.spec.ts` | 4 |

## Manual checks that automation cannot prove

- Overlay behaviour on a real Mac (multi-display, full-screen, sleep/wake).
- Accessibility permission grant/revoke on macOS.
- A live Ollama or OpenAI-compatible endpoint (timeouts, 401, malformed JSON).
- Port collision on a machine with another service on 4317.

These are recorded as NOT VERIFIED in `docs/QA_REPORT.md` rather than assumed.

## Evidence

- Screenshots: `qa/evidence/*.png` (synthetic data only)
- Playwright HTML report: `qa/evidence/playwright-report/index.html`
- Machine-readable results: `test-results/` (ignored by git except on failure)
