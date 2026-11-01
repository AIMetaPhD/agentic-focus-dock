# Final Release Closure — FocusDock AI v0.1.0

Date: 2026-11-01
Repository: <https://github.com/AIMetaPhD/agentic-focus-dock> (**public**)
Release: <https://github.com/AIMetaPhD/agentic-focus-dock/releases/tag/v0.1.0>
Product code commit: `01c21e0b72b2d717b913824906f8f66c3516d3dd`
Verified tree: `ea3ef8605932163f913d4db1d9d79860eed911bf`
CI: <https://github.com/AIMetaPhD/agentic-focus-dock/actions/runs/40957464211> — **success**
Previous private RC: tag `v0.1.0-rc.2`

This document is the implementation owner's closure record. It is **not** a Muse
sign-off and it does not claim that the Muse gate passed.

## Product owner decision

On 2026-11-01 the product owner selected the option to accept the independent
Claude sub-agent verification as supplementary release evidence and proceed with
the public release. The Muse gate remains **NOT VERIFIED**. This is a documented
waiver, not a Muse PASS; the original acceptance criterion "Muse independent QA
sign-off" is therefore **not fully met**.

## Gate status

| Gate | Status | Evidence |
|---|---|---|
| G0 Preflight / security contract / native feasibility | **CONDITIONAL** | `docs/G0_PREFLIGHT.md`; macOS overlay spike **BLOCKED** (no Mac) |
| G1 Runnable browser MVP | **PASS** | 69 automated tests; screenshots `qa/evidence/`; Windows 11 real run |
| G2 Rules, AI proposals, persistence, privacy | **PASS** (rules path) | `server/test/rules.test.ts`, `server/test/proposals.test.ts`, E2E |
| G3 macOS bridge | **NOT VERIFIED** | Swift package + macOS CI compile; no real-device run |
| G4 Independent Muse QA | **WAIVED — Muse NOT VERIFIED** | three Muse attempts blocked by the VM/harness; independent Claude sub-agent PASS (not Muse) on `ea3ef86`; owner waiver 2026-11-01. See `docs/QA_REPORT.md` and `qa/SUBAGENT_VERIFICATION_2026-10-30.md` |
| G5 Public release candidate | **PASS under documented waiver** | public repo, v0.1.0 Release, green CI, bilingual README, LICENSE/NOTICE/SECURITY/PRIVACY |
| G6 Profile README | **PR OPEN — merge awaits owner** | `AIMetaPhD/AIMetaPhD` pull request; merge is not part of this release |

## What is real

- A public, MIT-licensed local web app at `http://127.0.0.1:4317`, started with
  `npm start`.
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
| Muse independent sign-off | **NOT VERIFIED / WAIVED** | all three dispatch attempts blocked by the Muse VM/harness, not by a product defect; owner accepted supplementary sub-agent verification on 2026-11-01 |
| Profile PR merge | **OPEN** | the PR is open; merging still requires the owner's approval |

## Evidence index

| Evidence | Location |
|---|---|
| Server/security/rules tests (52) | `server/test/`, result in `docs/QA_REPORT.md` |
| Web unit tests (4) | `web/src/i18n.test.ts` |
| Playwright (13) | `tests/e2e/`, screenshots `qa/evidence/*.png` |
| Independent sub-agent verification (not Muse) | `qa/SUBAGENT_VERIFICATION_2026-10-30.md` |
| CI run | Actions run `40957464211`, all three jobs green on `ea3ef86` |
| Muse attempts 1–3 | `qa/muse-result-G4-attempt*.json`, `docs/QA_REPORT.md` |
| Architecture / threat model | `docs/ADR-001-ARCHITECTURE.md`, `docs/THREAT_MODEL.md` |
| License audit | `docs/THIRD_PARTY_AUDIT.md`, `NOTICE.md` |
| Release notes | `docs/RELEASE_NOTES_v0.1.0.md` |

## Security and privacy statement

- No GPL-3.0 or all-rights-reserved code is copied. Research references are
  documented and were not vendored.
- The tracked working tree was scanned (101 files); the pre-release git history
  patch output (709,535 bytes) was scanned for secret patterns and the
  workstation username. Both scans were clean.
- The public permissions screenshot redacts the local bridge-token path and hides
  the floating dock overlay.
- The app stores only local mode config, synthetic/demo events and settings.
  The optional cloud key lives outside SQLite in a `0600` file.
- No third-party notification database is read; no SIP/Dock modification; no
  shell/AppleScript execution by the model.

## Release conditions

1. The Muse QA gate is **waived, not passed**. The owner accepted the sub-agent
   verification as supplementary evidence on 2026-11-01.
2. The macOS bridge remains **NOT VERIFIED**; the Release notes say so and the
   binary is not presented as production-ready.
3. Public visibility and the v0.1.0 Release were explicitly authorized by the
   product owner on 2026-11-01.
4. The profile README PR is open; merging it still requires the owner's approval.

## Commit / build

- Node 24.12.0 on Windows 11; `npm ci && npm run verify` passes.
- CI repeats the full suite on Ubuntu and compiles/tests the Swift package on
  macOS 14.
- Public tag: `v0.1.0`.
