# Contributing

Thanks for helping. This project values a small, auditable surface over feature
count.

## Setup

```bash
npm install
npm run dev        # build web + start the local server
npm test           # server + web unit tests
npm run test:e2e   # Playwright (installs Chromium on first run)
npm run verify     # everything, including secret scan
```

Node.js 22.5+ is required. The macOS bridge is a separate Swift package:

```bash
cd mac-bridge
swift build
swift test
```

## Before opening a pull request

- `npm run verify` passes locally.
- New behaviour has a test: rules in `server/test/`, UI flows in `tests/e2e/`.
- Both READMEs and `docs/CAPABILITIES.md` stay truthful. Do not describe
  simulated events as real integrations.
- No new dependency without a license check (`docs/THIRD_PARTY_AUDIT.md`).
- No secrets, tokens, private paths, or personal screenshots in the diff.

## Hard boundaries

- No `killall Dock`, no `com.apple.dock` writes, no SIP changes, no private SPI.
- No copying GPL-3.0 or all-rights-reserved code, icons, or assets. Research
  references are listed in `docs/THIRD_PARTY_AUDIT.md`.
- No claim of intercepting or silencing other apps' notifications.
- No model-generated shell, AppleScript, or arbitrary OS action.
- The local server must never bind a non-loopback address.

## Code style

- TypeScript strict mode; run `npm run typecheck` and `npm run lint`.
- Keep domain rules in `server/src/domain/`, HTTP/security in
  `server/src/server.ts`, and storage behind `Store`.
- The mode schema (`server/src/domain/schemas.ts`) is the single source of truth;
  do not duplicate it in the UI.
- Prefer a clear error message over silent failure; never log secrets.

## Commit messages

Use an imperative subject (`add proposal rollback test`) and explain the why in
the body when it is not obvious. Keep commits focused.
