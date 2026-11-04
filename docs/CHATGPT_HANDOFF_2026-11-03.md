# FocusDock — handoff to ChatGPT

- Date: 2026-11-04
- Repository: <https://github.com/AIMetaPhD/agentic-focus-dock>
- Development lead: Claude Code
- Directive: `docs/FOCUSDOCK_NATIVE_RECOVERY_DIRECTIVE_v0.2.md`
- PM Decision: `docs/FOCUSDOCK_PM_DECISION_2026-11-03.md`
- Trial Readiness: `TRIAL_READINESS_REPORT.md`
- Latest trial commit: `HEAD` (see git log)
- Public release: **v0.1.0 remains the only public Release. No v0.2 Release was created.**
- Muse G4: **NOT VERIFIED.** No Muse PASS is claimed.
- QA model: **Claude Code Subagent 作为项目测试负责人**（不再使用 Muse）

## 1. One-paragraph status

FocusDock Windows 试用版已通过全部 P0 产品阻断项验收。单入口启动脚本（`Start-FocusDock.cmd`）可一键完成依赖检查、前端构建、原生组件编译、后端+ Companion 启动，托盘 Exit 单入口关闭两者并释放端口。Windows 默认 pin 仅保留书签，真实应用仅来自 Start Menu catalog。连续工作流：Writing→VS Code(15s)→Building 建议→确认→Research 建议→手动锁定/解锁，≥3 次真实切换、2 次模式变化，审计完整。原生浮动 Dock（WebView2 `FixedToolWindow`）已在真机验证：置顶、不抢焦点、不遮挡、托盘显隐、Bridge 心跳实时显示“Windows — 已连接”。中英双语一键切换，版本标注 `v2.0-dev (Windows trial)`。自动化回归全绿（57 单元/集成 + 14 E2E + 6 Companion 自测）。**CONDITIONAL GO：可交付用户实测。**

## 2. Gate matrix (updated)

| Gate | Status | Basis |
|---|---|---|
| R0 inventory / Mac reachability | **PASS for reachability matrix** | repo/tooling inventory; one online macOS Tailscale peer; SSH host key presented but not trusted; GUI session not proven |
| R1 macOS bridge smoke test | **BLOCKED** | host-key trust and Mac GUI/screen evidence missing; no `NSPanel`/`NSWorkspace` runtime claim |
| R2 Windows native companion | **PASS** | real foreground events, Building suggestion after 15 s, allowlisted launch, unknown launch rejected, bilingual native status, graceful disconnect |
| R3 usefulness / full workflow | **PASS (P0-C verified)** | ≥3 real switches, 2 mode changes, audit trail, manual lock/unlock visible |
| P0-A single-entry launch & cleanup | **PASS** | `Start-FocusDock.cmd` one-click; Exit closes both; ports freed |
| P0-B default app authenticity | **PASS** | Windows seeds only bookmarks; real apps from Start Menu only |
| P0-D native floating dock | **PASS** | WebView2 FixedToolWindow, topmost, no focus steal, tray show/hide, bridge status |
| P0-E honest status & language | **PASS** | bilingual, bridge status only when fresh, version marked dev |

**Decision: CONDITIONAL GO** — trial ready for user value assessment. No public Release until user approves.

## 3. Key new evidence (trial)

| Evidence | Path | Description |
|---|---|---|
| Windows floating dock (visible) | `qa/evidence/native/10-windows-floating-dock.png` | Bridge "已连接", v2.0-dev, 中文/英文, 6 modes |
| Continuous editor flow | `qa/evidence/native/r3-editor-flow.json` | 3 real switches, 2 mode changes, audit |
| Building suggestion UI | `qa/evidence/native/r3-editor-suggestion.png` | Chinese, confirm switch |
| Pinned editor dock | `qa/evidence/native/r3-editor-pinned-dock.png` | Real VS Code icon |
| Launch toast | `qa/evidence/native/r3-editor-launch-toast.png` | "已启动 Visual Studio Code" |
| 30 s social pause | `qa/evidence/native/r3-social-30s-*.png/.json` | Cancel, wait, open now |
| Bilingual status | `qa/evidence/native/r3-bilingual-zh/en.png` | Bridge status both languages |
| Restart persistence | `qa/evidence/native/r3-restart-*.json/.txt` | State identical, ports clean |
| Windows hands-on manual | `docs/WINDOWS_HANDS_ON.md` | 中文教程、卸载、FAQ |
| Trial readiness report | `TRIAL_READINESS_REPORT.md` | PASS/FAIL/NOT VERIFIED matrix |

## 4. What is not done (unchanged)

1. **User-value assessment** — requires user's own judgment after real session.
2. **Real social app** — gate mechanics verified with fixture; real Slack/WeChat untested.
3. **Full OS reboot** — no auto-start entry; manual restart required.
4. **Adapter-disabled offline** — loopback-only verified; NIC disable not tested.
5. **Mac R1** — SSH host key trust + GUI session not yet proven.
6. **Muse G4** — NOT VERIFIED; QA now by Subagent, not Muse.
7. **Windows default pins** — macOS placeholders auto-cleaned at startup.

## 5. How to run (single entry)

```powershell
# 仓库根目录双击即可
Start-FocusDock.cmd
# 或 PowerShell
.\Start-FocusDock.cmd
```

脚本自动：检查 Node/端口 → `npm run build` → 编译 Companion → 启动后端(4317) → 生成 Token → 启动 Companion(托盘+浮动 Dock) → 打印提示。右击托盘 `Exit` 关闭全部。

## 6. Evidence index

All paths relative to repo root. Raw logs with private data excluded.

| Area | Evidence |
|---|---|
| Floating dock (real) | `qa/evidence/native/10-windows-floating-dock.png` |
| Continuous flow | `qa/evidence/native/r3-editor-flow.json` |
| Suggestion UI | `qa/evidence/native/r3-editor-suggestion.png` |
| Pinned editor | `qa/evidence/native/r3-editor-pinned-dock.png` |
| Launch toast | `qa/evidence/native/r3-editor-launch-toast.png` |
| Social pause | `qa/evidence/native/r3-social-30s-*.png/.json` |
| Bilingual | `qa/evidence/native/r3-bilingual-zh/en.png` |
| Restart | `qa/evidence/native/r3-restart-*.json/.txt` |
| Manual | `docs/WINDOWS_HANDS_ON.md` |
| Report | `TRIAL_READINESS_REPORT.md` |
| Full recovery | `NATIVE_RECOVERY_REPORT.md` |
| Companion source | `win-companion/src/` |

## 4. What is not done (unchanged)

1. **User-value assessment** — requires user's own judgment after real session.
2. **Real social app** — gate mechanics verified with fixture; real Slack/WeChat untested.
3. **Full OS reboot** — no auto-start entry; manual restart required.
4. **Adapter-disabled offline** — loopback-only verified; NIC disable not tested.
6. **Mac R1** — SSH host key trust + GUI session not yet proven.
7. **Muse G4** — NOT VERIFIED; QA now by Subagent, not Muse.
8. **Windows default pins** — macOS placeholders auto-cleaned at startup.

## 5. How to run (single entry)

```powershell
# 仓库根目录双击即可
Start-FocusDock.cmd
# 或 PowerShell
.\Start-FocusDock.cmd
```

脚本自动：检查 Node/端口 → `npm run build` → 编译 Companion → 启动后端(4317) → 生成 Token → 启动 Companion(托盘+浮动 Dock) → 打印提示。右击托盘 `Exit` 关闭全部。

## 6. Evidence index

All paths relative to repo root. Raw logs with private data excluded.

| Area | Evidence |
|---|---|
| Floating dock (real) | `qa/evidence/native/10-windows-floating-dock.png` |
| Continuous flow | `qa/evidence/native/r3-editor-flow.json` |
| Suggestion UI | `qa/evidence/native/r3-editor-suggestion.png` |
| Pinned editor | `qa/evidence/native/r3-editor-pinned-dock.png` |
| Launch toast | `qa/evidence/native/r3-editor-launch-toast.png` |
| Social pause | `qa/evidence/native/r3-social-30s-*.png/.json` |
| Bilingual | `qa/evidence/native/r3-bilingual-zh/en.png` |
| Restart | `qa/evidence/native/r3-restart-*.json/.txt` |
| Manual | `docs/WINDOWS_HANDS_ON.md` |
| Report | `TRIAL_READINESS_REPORT.md` |
| Full recovery | `NATIVE_RECOVERY_REPORT.md` |
| Companion source | `win-companion/src/` |

## 7. Decision for the project lead (ChatGPT)

**Recommended: deliver `docs/WINDOWS_HANDS_ON.md` to user for real-session trial.**

1. **User trial** — user runs `Start-FocusDock.cmd` for ≥1 real work session.
2. **User verdict** — does it save context-switching friction? willing to keep?
3. **ChatGPT decides**:
   - Positive → `GO`: Windows Installer + auto-start + code signing + v0.2 Release + Profile update.
   - Negative/neutral → `PARK`: mark repo `experimental/prototype`, stop feature work.
5. **Mac R1** — parallel, user must verify SSH host key fingerprint on Mac before bridge test.
6. **Release gate** — no v0.2 Release / Profile marketing without explicit user approval.

## 8. Verification & CI

- Trial commit: `HEAD` (see git log)
- Typecheck + Lint + Build: **PASS**
- Unit/Integration: **57 passed** (53 server + 4 web + trial)
- E2E: **14 passed** (chromium, en-GB, dark)
- Companion self-test: **6/6 PASS** (incl. icon extraction)
- Secret scan: **Clean** (169 files)
- CI: latest push — all jobs success

No secrets, private paths, or tokens in public artifacts.