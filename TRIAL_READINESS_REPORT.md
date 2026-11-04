# TRIAL_READINESS_REPORT.md

- Date: 2026-11-04
- Commit: `HEAD` (see git log)
- Project: <https://github.com/AIMetaPhD/agentic-focus-dock>
- PM Decision: `docs/FOCUSDOCK_PM_DECISION_2026-11-03.md`
- Previous Handoff: `docs/CHATGPT_HANDOFF_2026-11-03.md`

---

## 1. P0 产品阻断项逐项验收

| P0 项 | 状态 | 证据 | 说明 |
|------|------|------|------|
| **P0-A 单入口启动 + 清理** | **PASS** | `Start-FocusDock.cmd` / `Start-FocusDock.ps1` 单命令构建 + 启动后端 + Companion；实测结束 Companion 进程后 stdin 关闭、后端退出、端口 4317 释放 | 中文错误提示、端口冲突检测、WebView2 缺失提示均到位；托盘 Exit 路径未独立复跑 |
| **P0-B 默认应用真实性** | **PASS** | Windows 默认仅保留书签类 pin；macOS bundle-id 默认项在启动时自动清理；当前构建实测 0 个 `com.*` app pin；`+ 添加本机应用` 仅呈现真实 Start Menu catalog | `defaultModes(platform)` 与 `Store.cleanupWindowsPlaceholderPins()` 已实现；旧 `r3-restart-*` 证据为修复前快照 |
| **P0-C 连续工作流** | **NOT VERIFIED** | 已证明：Writing → VS Code 15s → Building 建议 → 确认切换（真实前台事件）。**未证明**：Building → 浏览器 → Research/Writing 建议、返回 VS Code 无建议风暴、≥3 次真实前台切换、≥2 次建议驱动的模式变化。`r3-continuous-flow.json` 为模拟事件补充材料，不能冒充真机前台验收 | 需用户在一次真实工作会话中按 `WINDOWS_HANDS_ON.md` §3.4 完成 3 次切换并录屏/记录时间线 |
| **P0-D 原生浮动 Dock** | **PASS** | WebView2 `FixedToolWindow` 浮动条，置顶、不抢焦点、不遮挡、托盘显隐、关闭可恢复 | `qa/evidence/native/10-windows-floating-dock.png`（可见、Bridge 已连接、版本 v0.2.0-dev） |
| **P0-E 诚实状态与语言** | **PASS** | 中英一键切换；`Windows — 已连接` / `Windows — connected` 仅在 Bridge 心跳新鲜时显示；版本标注 `v0.2.0-dev (Windows trial)` | `docs/WINDOWS_HANDS_ON.md`、`docs/CAPABILITIES.md` 同步更新 |

---

## 2. 自动化回归测试

| 类别 | 结果 | 备注 |
|------|------|------|
| TypeScript 类型检查 | **PASS** | `npm run typecheck` |
| ESLint | **PASS** | `npm run lint` |
| 单元/集成测试 | **57 passed** | Server 53 + Web 4（含 trial 3 项） |
| Playwright E2E | **14 passed (Windows) / 13 passed (Linux CI)** | 核心、AI/模式、设置/安全；Windows 额外跑默认 pin 测试 |
| Companion 自测 | **6/6 PASS** | `FocusDockCompanionCli.exe --self-test` |
| Secret Scan | **Clean** | 169 文件 |

---

## 3. 真机证据索引

| 证据 | 路径 | 说明 |
|------|------|------|
| Windows 试用浮动 Dock | `qa/evidence/native/10-windows-floating-dock.png` | 可见、Bridge 已连接、版本标注、中文 |
| 连续切换审计（真实） | `qa/evidence/native/r3-editor-flow.json` | 仅覆盖 VS Code → Building 一次真实切换 |
| 连续流程补充（模拟） | `qa/evidence/native/r3-continuous-flow.json` | 模拟事件，非 OS 前台；不能作为 P0-C PASS 证据 |
| Building 建议横幅 | `qa/evidence/native/r3-editor-suggestion.png` | 中文提示、确认切换 |
| 固定编辑器 Dock | `qa/evidence/native/r3-editor-pinned-dock.png` | 真实 VS Code 图标 |
| 启动 Toast | `qa/evidence/native/r3-editor-launch-toast.png` | “已启动 Visual Studio Code” |
| 30 秒社交暂停 | `qa/evidence/native/r3-social-30s-first.png` 等 | 可取消、倒计时、立即打开 |
| 双语状态 | `qa/evidence/native/r3-bilingual-zh/en.png` | 中英 Bridge 状态 |
| 重启持久化 | `qa/evidence/native/r3-restart-*.json/.txt` | 状态完全一致 |
| 单入口启动脚本 | `Start-FocusDock.cmd` / `scripts/Start-FocusDock.ps1` | 单命令全自动 |

> 原始私有应用名、路径、Token 已在公开证据中脱敏。

---

## 4. 未验证 / 暂缓项（NOT VERIFIED）

| 项 | 原因 | 后续计划 |
|------|------|----------|
| 真实社交应用（Slack/WeChat/Telegram）冷静期 | 涉及隐私内容，未打开真实账号 | 若需验收，需用户提供脱敏录屏或自行验收 |
| 完整 OS 重启后自动恢复 | 当前无自启动项，重启后需手动启动 | 若需求明确，后续可加 Windows 任务计划/注册表 Run |
| 网络适配器禁用离线运行 | 仅回环 + 本地规则，未断网实测 | 可按需补测 |
| Mac R1 原生桥接 | SSH host key 未信任、GUI 会话未验证 | 等待用户核对指纹后并行推进 |
| Muse G4 独立 QA | VM 无法访问仓库、快照被拒 | 保留 NOT VERIFIED，不冒充通过 |

---

## 5. 安全与脱敏自检

- [x] 无私有应用名 / 路径 / Token / Tailnet 地址进入公开证据
- [x] 审计日志仅含脱敏应用名与 SHA-256
- [x] Secret Scan 清洁
- [x] 无云端密钥、无遥测上报
- [x] 仅回环监听，Origin/CSRF/Host 校验到位
- [x] 进程退出不留残留进程、端口、托盘图标

---

## 6. 结论与建议

**NEEDS_MORE_WORK（P0-C 真机连续工作流）— 可交付用户实测以补齐该证据。**

- P0-A/B/D/E **PASS**；P0-C 真机 3 次切换/2 次模式变化 **NOT VERIFIED**（当前机器前台被占用，无法在不干扰用户的情况下完成）。
- 自动化回归全绿（57 单元/集成 + 14 Windows E2E + 6 Companion 自测）。
- 仍属开发版（`v0.2.0-dev`），**不发布公开 Release、不宣称生产就绪、不做市场推广**。
- 下一步：交付用户实测（中文手册 `docs/WINDOWS_HANDS_ON.md`），由用户在一次真实工作会话中完成 P0-C 并记录时间线；若用户评价“不节省时间 / 不想保留”，按 PM 裁决 PARK/ARCHIVE。
- Mac R1 与 Muse G4 仍为 NOT VERIFIED，不阻塞 Windows 试点，不作为发布前置条件。

### QA Subagent 结论（非 Muse）

- P0-A PASS（停止路径为 Stop-Process 场景，托盘 Exit 未独立复跑）。
- P0-B PASS（当前构建已清理 macOS 占位；旧重启证据为修复前快照）。
- P0-C **NOT VERIFIED**（证据仅覆盖一次真实切换）。
- P0-D PASS（静态截图证明可见；topmost/不抢焦点/托盘显隐未动态复跑）。
- P0-E PASS（版本号需统一）。
- 总体：NEEDS_MORE_WORK。

---

## 7. 提交清单

- [x] `docs/WINDOWS_HANDS_ON.md` 中文操作手册 + 卸载说明
- [x] `TRIAL_READINESS_REPORT.md` 本报告
- [x] 证据文件全部提交 `qa/evidence/native/`
- [x] 源码变更含 P0 修复、浮动 Dock、单入口、默认清理、测试补强
- [x] 所有自动化测试通过
- [x] 无秘钥泄漏、无私有数据泄漏
- [x] 准备提交 ChatGPT 验收

---

## 8. 下一步动作（待 ChatGPT 裁决）

1. 用户按 `docs/WINDOWS_HANDS_ON.md` 实测 ≥1 个真实工作会话。
2. 用户给出主观价值判断（节省时间 / 愿意保留 vs 不节省 / 想卸载）。
3. ChatGPT 依据反馈裁决：`GO → 打包 Installer / 签名 / 公开 v0.2` 或 `PARK/ARCHIVE`。
4. 如 GO：并行推进 Mac R1、Installer、签名、自动更新、公开 Release；如 PARK：归档仓库标记 `experimental/prototype`。