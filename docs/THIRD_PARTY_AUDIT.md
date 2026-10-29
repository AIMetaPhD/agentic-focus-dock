# Third-Party Audit

Audit date: 2026-10-30. Method: GitHub REST `/repos/{owner}/{repo}/license` and direct
`LICENSE` reads for the research references; `npm ls --all` plus each package's
`license` field for shipped dependencies. This file is updated whenever a dependency
is added.

## 1. Research references (no code copied)

| Repository | Verified license | Use in this project | Copying |
|---|---|---|---|
| https://github.com/josejuanqm/docky | GPL-3.0 | Interaction/architecture study only | **None** |
| https://github.com/Hammerspoon/hammerspoon | MIT | Public `NSWorkspace` API patterns studied | **None** (API usage is Apple's, not Hammerspoon's code) |
| https://github.com/milind-soni/tiptour-macos | MIT (LICENSE text; GitHub API classifier says NOASSERTION) | Accessibility/observation patterns studied | **None** |
| https://github.com/TheBoredTeam/boring.notch | GPL-3.0 | Floating-bar interaction study only | **None** |
| https://github.com/The-Portland-Company/focus-dock-for-macos | No LICENSE file (all rights reserved) | Product research only | **None** |

No GPL-3.0 or all-rights-reserved source, asset, icon, or screenshot is included in
this repository. The reference screenshots from the handoff package are **not**
committed; they live only in the private handoff archive.

## 2. Shipped runtime dependencies

All are permissive and MIT-compatible. Versions are pinned by `package-lock.json`.

| Package | License | Role |
|---|---|---|
| `fastify` | MIT | local HTTP server |
| `@fastify/static` | MIT | serves the built web app |
| `ws` | MIT | local WebSocket push |
| `zod` | MIT | schema validation for API bodies and AI proposals |
| `react`, `react-dom` | MIT | web UI |
| `vite` | MIT | web build |
| `@vitejs/plugin-react` | MIT | web build |
| `tsx` | MIT | TypeScript execution (dev + start) |
| `typescript` | Apache-2.0 | type checking |
| `vitest` | MIT | unit/integration tests |
| `@playwright/test` | Apache-2.0 | end-to-end tests |
| `eslint`, `@eslint/js`, `typescript-eslint`, `globals` | MIT | lint |

## 3. Attribution obligations

MIT/Apache-2.0 dependencies require preserving their copyright and permission notices
in distributions. This project ships as source; `package-lock.json` plus each
dependency's own `LICENSE` in `node_modules` satisfies attribution for a source
distribution. If a bundled binary is ever produced, a generated `THIRD_PARTY_NOTICES`
file must be added before release.

## 4. Prohibited patterns (enforced by review)

- No `killall Dock`, no writes to `com.apple.dock`, no SIP changes, no private SPI.
- No reading of Notification Center databases or other apps' private data.
- No copied GPL/proprietary code, icons, or screenshots.
- No model-generated shell/AppleScript execution.
