# Final Release Closure — FocusDock AI v0.1.0

Date: 2026-10-30
Repository: <https://github.com/AIMetaPhD/agentic-focus-dock> (**private**)
Release candidate commit: `01c21e0b72b2d717b913824906f8f66c3516d3dd`
CI: <https://github.com/AIMetaPhD/agentic-focus-dock/actions/runs/40955562215> — **success**

This document is the implementation owner's closure record. It is not a Muse
sign-off and it does not authorize a public release.

## Gate status

| Gate | Status | Evidence |
|---|---|---|
| G0 Preflight / security contract / native feasibility | **CONDITIONAL** | `docs/G0_PREFLIGHT.md`; macOS overlay spike **BLOCKED** (no Mac) |
| G1 Runnable browser MVP | **PASS** | 69 automated tests; screenshots `qa/evidence/`; Windows 11 real run |
| G2 Rules, AI proposals, persistence, privacy | **PASS** (rules path) | `server/test/rules.test.ts`, `server/test/proposals.test.ts`, E2E |
| G3 macOS bridge | **NOT VERIFIED** | Swift package + macOS CI compile; no real-device run |
| G4 Independent Muse QA | **NOT VERIFIED** | no Muse instance could reach the source (attempts 1–2); the source-snapshot channel was refused as opaque (attempt 3). See `docs/QA_REPORT.md` and `qa/muse-result-G4-attempt*.json` |
| G5 Private release candidate | **PASS for private RC** | green CI, bilingual README, LICENSE/NOTICE/SECURITY/PRIVACY, private repo |
| G6 Profile README | **BLOCKED** | requires a public repo and explicit user approval |

## What is real

- A local web app at `http://127.0.0.1:4317`, started with `npm start`.
- Six modes with editable config, pinned apps, colors, allowlists, keywords,
  dwell/cooldown, notification policy.
- Versioned persistence in SQLite; export/import; restore defaults; rollback.
- Deterministic rules with manual lock and anti-flap behavior.
- A notification queue with 30 s in-product cool-down, `Stay` / `Later` /
  `Go to Social`, and urgent bypass. Every demo event is labelled `SIMULATED`.
- Schema-safe AI proposals: validated JSON Patch, visible diff, explicit apply,
  version bump, rollback; Ollama/OpenAI-compatible adapters with timeout and
  rules fallback (adapters not exercised against a live endpoint).
- English/简体中文 UI, honest capability panel, bridge authentication rotation.
- Loopback-only security: Host/Origin allowlists, HttpOnly session, CSRF
  double-submit, WebSocket origin check, rate limits, 64 KB body limit.
- CI on Linux for web tests and on `macos-14` for the Swift package.

## What is not real / not verified

| Item | Status | Why it matters |
|---|---|---|
| macOS floating panel at runtime | **NOT VERIFIED** | no Apple Silicon host; CI compile is not a device test |
| Accessibility title capture | **NOT VERIFIED** | requires macOS permission flow |
| Multi-display/full-screen/sleep-wake | **NOT VERIFIED** | same |
| Live Ollama / cloud provider | **NOT EXERCISED** | no model/endpoint in this environment |
| Global notification interception | **UNSUPPORTED** | public API limit; explicitly stated in UI/docs |
| Public GitHub Release / profile PR | **NOT DONE** | awaiting user authorization |
| Muse independent sign-off | **NOT VERIFIED** | all three dispatch attempts blocked by the Muse VM/harness, not by a product defect; see `docs/QA_REPORT.md` |

## Evidence index

| Evidence | Location |
|---|---|
| Server/security/rules tests (52) | `server/test/`, result in `docs/QA_REPORT.md` |
| Web unit tests (4) | `web/src/i18n.test.ts` |
| Playwright (13) | `tests/e2e/`, report `qa/evidence/playwright-report/` |
| Screenshots | `qa/evidence/*.png` |
| CI run | Actions run `40955562215`, all three jobs green |
| Muse attempt 1 | `qa/muse-result-G4-attempt1.json` (verbatim queue result) |
| Architecture / threat model | `docs/ADR-001-ARCHITECTURE.md`, `docs/THREAT_MODEL.md` |
| License audit | `docs/THIRD_PARTY_AUDIT.md`, `NOTICE.md` |

## Security and privacy statement

- No GPL-3.0 or all-rights-reserved code is copied. Research references are
  documented and were not vendored.
- No keys, tokens, private paths, or personal screenshots are committed. CI runs
  a tracked-file secret scan and a runtime dependency audit.
- The app stores only local mode config, synthetic/demo events and settings.
  The optional cloud key lives outside SQLite in a `0600` file.
- No third-party notification database is read; no SIP/Dock modification; no
  shell/AppleScript execution by the model.

## Required before a public release

1. Resolve or formally waive the Muse QA gate. A Muse PASS on this commit is
   required; if no Muse instance can reach the source, record G4 as NOT VERIFIED
   and obtain the product owner's decision.
2. Run the macOS bridge checklist on Apple Silicon and attach evidence
   (`mac-bridge/README.md`).
3. Obtain explicit user authorization to change repository visibility and create
   a public Release/tag.
4. Only after the repository is public and reachable, open the minimal
   `AIMetaPhD/AIMetaPhD` profile PR and request the user's approval to merge.

## Commit / build

- Node 24.12.0 on Windows 11; `npm ci && npm run verify` passes.
- CI repeats the full suite on Ubuntu and compiles/tests the Swift package on
  macOS 14.
- The private RC tag, if created, is `v0.1.0-rc.1` (no public Release).
