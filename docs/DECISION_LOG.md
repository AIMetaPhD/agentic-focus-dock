# Decision Log

## 2026-10-30 — Runtime: Node/TypeScript instead of FastAPI

**Decision:** one Node process serves the API and the built React app; SQLite via
`node:sqlite`.
**Why:** one runtime for end users, one language across server/UI/tests, no
native compilation on Windows or macOS. The handoff allowed an equivalent stack
with justification. Trade-off: `node:sqlite` is still experimental; storage is
isolated in `server/src/store.ts`.

## 2026-10-30 — Rules are the default decision layer

**Decision:** deterministic rules always run; Ollama and OpenAI-compatible
providers are optional adapters.
**Why:** the app must work with no network, no key, and no model. "Jev" is not a
dependency (its public API was never verifiable).

## 2026-10-30 — No global notification interception, ever

**Decision:** only product-owned and simulated events are classified. The UI
states the platform limit.
**Why:** public Apple APIs expose only the app's own notifications. Reading
private databases or injecting into other apps is prohibited.

## 2026-10-30 — The 30 s wait is an in-product cool-down

**Decision:** `Go to Social` unlocks after the mode's `switch_wait_seconds`, then
requires a click.
**Why:** it is a product decision aid, not a claim that system notifications were
delayed. `Later` never launches an application.

## 2026-10-30 — AI proposal surface is a constrained JSON Patch

**Decision:** only `/modes/*`, allowlisted fields, bounded values; explicit apply;
one version per mode; rollback creates a new version.
**Why:** a model must not be able to run shell/AppleScript or silently rewrite
configuration. Diff + confirmation makes the change reviewable.

## 2026-10-30 — Loopback security contract is enforced centrally

**Decision:** one `onRequest` hook checks Host, session, Origin, CSRF and content
type; the bridge uses a separate scoped token; the WS upgrade repeats the checks.
**Why:** per-route checks drift. Tests cover evil Host/Origin, missing CSRF,
cross-origin WS and token scope.

## 2026-10-30 — Six default modes, including Social

**Decision:** Writing, Building, Research, Meeting, Break, Social.
**Why:** "Go to Social" needs a real destination. Writing/Building remain the
visual and behavioural focus.

## 2026-10-30 — macOS bridge is source-complete but NOT VERIFIED

**Decision:** ship the Swift package and a macOS CI compile job, and label the
runtime experience `NOT VERIFIED`. Do not claim G3.
**Why:** the development host is Windows; no Mac was reachable. A CI compile is
not evidence of a working overlay.

## 2026-10-30 — Private development, public release gated by the user

**Decision:** private repository and PRs are allowed; public visibility, a public
Release, and the `AIMetaPhD/AIMetaPhD` profile PR require explicit user approval.
**Why:** the handoff's release boundary and the user's instruction.

## 2026-11-01 — Public release authorized; profile PR merged

**Decision:** after explicit owner authorization, the repository is public, the
v0.1.0 Release is published, and the profile PR was merged (merge commit
`5be0466fb81a36cad8f0e9b0e1093aa3f21b01d2`).
**Why:** the owner authorized all three actions; the profile PR was a one-line
addition to the `for builders` table.
