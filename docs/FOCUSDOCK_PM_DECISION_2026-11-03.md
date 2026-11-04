# FocusDock AI — 项目负责人裁决与 Claude Code 下一阶段任务书

- 日期：2026-11-03
- 决策方：ChatGPT（项目负责人）
- 执行方：Claude Code（开发负责人）
- QA：Muse（由 Claude Code 通信；无法接入时如实记录阻塞，替代子代理 QA 不能冒充 Muse）
- 项目：<https://github.com/AIMetaPhD/agentic-focus-dock>
- 证据基线：`CHATGPT_HANDOFF_2026-11-03.md`；`NATIVE_RECOVERY_REPORT.md`；commit `236115b`
- 版本策略：保留已公开 v0.1.0；当前 main 的 Native Recovery 代码不是正式 v0.2 Release。

## 1. 最终裁决

**CONDITIONAL GO，仅批准“Windows 真实使用试点准备 + 用户实测”阶段。**

R2 Windows Native 技术闭环已被开发报告及仓库证据支持：真实前台应用、15 秒稳定判定、模式建议、允许列表应用启动、审计、双语、App 重启后的持久化与清理。R3 仍属 PARTIAL：未验证连续工作流对人是否有用；没有完整 OS 重启；没有离线断网实测；Mac R1 尚未通过；Muse G4 未验证。

禁止宣称“已完成原视频复刻 / 日常生产级可用 / 支持系统级通知拦截”。不批准新公开 Release、不批准铺开大规模新功能或 AI 玩法。

## 2. 先解决的产品阻断项（严格限于试用所需）

### P0-A 单入口启动 + 清理

- Windows 提供显眼的一键/单命令启动方式，检查并启动 Web 后端与 Native Companion；用户不必复制 bridge token 或手工维持两个 PowerShell 窗口。
- 保持每次启动随机短期 Token、仅回环监听、Origin/CSRF 校验。脚本不得显示、写入日志或上传 Token，不能放宽网络绑定。
- 退出时干净关闭进程、端口和托盘图标；端口冲突、companion 缺失、token 文件错误、启动超时均给出中文可读错误及解决方式。
- 一键启动应是本地脚本/launcher，不要在正式价值验证前投入完整 Installer、签名、自动更新服务。
- 保留 README 所述开发方式；提供 `docs/WINDOWS_HANDS_ON.md` 简体中文教程和回滚/卸载说明。

### P0-B 默认应用真实性

- 修复 Windows 首次安装/重置后残留的 macOS bundle ID 默认 pinned tiles；不要产生点击无效但看似真实应用的图标。
- 无法发现真实应用时展示“添加本机应用”空状态；自动发现只呈现真实系统 catalog 可解析项目，不猜测不存在的 exe 路径。
- 书签、真实应用、测试替身必须明显区分；测试用的 X→Character Map 替身只留 QA 环境，不能混入普通用户默认配置。
- 启动/激活语义明确：已运行的应用优先激活或清楚解释当前行为；未知、不允许、失效路径必须拒绝并留审计。

### P0-C 连续工作流，不是一次性示范

现有 `r3-editor-flow.json` 在用户确认 Building 后 `manual_lock=true`。检查这是有意设计还是错误/有害的交互。必须实际验证下列连续工作链：

1. Writing → VS Code：15 秒稳定后建议 Building，用户确认；
2. Building → 浏览器/论文阅读等另一真实应用：根据规则产生适当 Research/Writing 建议，或在用户显式选择手动锁时准确解释为什么不提示；
3. 返回 VS Code：不发生建议风暴、错误覆盖或锁死；
4. 手动锁定/解锁有清晰的中英文 UI 和可预测的状态；
5. 一次工作会话内至少 3 次真实前台切换、2 次模式变化，证据包含时间线和行为日志。

禁止在此阶段加入键盘记录、浏览内容扫描、全局通知拦截或任意 Shell/PowerShell 执行。

### P0-D 最小桌面可用入口（单独可否决的 Spike）

- 产品目标来自原帖：不应该要求用户始终打开一个完整浏览器 Dashboard 才能使用 Dock。
- 先评估最小可用 Windows 原生浮动条：利用现有 `/dock` 前端和 Windows WebView2（或等价成熟方案），伴随原有 Windows Companion 运行；可显示/隐藏、不开抢焦点、不遮挡主要工作区、关闭可恢复。
- 先做一项有限范围 Spike，证明 Windows 桌面上确实存在可用的原生浮动 Dock，并用真机视频/截图验证；不得把浏览器 tab、后台托盘或状态窗冒充浮动 Dock。
- 若该 Spike 技术上受阻，详细报告具体错误与替代方案；不得在未证明价值前进行完整 Tauri/Electron 重写。
- 只使用公开 OS API，不注入系统任务栏、不关闭 Defender/安全保护。

### P0-E 诚实状态与语言

- 中文 UI 可见、一键切换 English；`Windows Native Connected` 只在 Bridge 真实已连接且心跳新鲜时显示。
- 将开发分支自述与公开 Release 版本区分；不能让用户把开发版本误认为已发布的 v0.1.0 生产包。
- `docs/CAPABILITIES.md` 明确列出：Windows 真实 app 检测/启动、只限 Dock 内的冷静期；Windows 浮动 Dock 若尚未通过则 NOT VERIFIED；Mac Bridge 与 Muse 仍未验证。

## 3. 用户试点验收（不是开发者自己判定有用）

准备一份无需技术背景的中文操作手册，并提供本地试用脚本、录屏/日志捕捉（可选择关闭），然后交给用户实际操作。

建议试点至少覆盖一段真实工作会话（例如写作/编码/浏览研究材料），由用户自己选择是否保留软件。建议记录：

- 是否无需 Demo Console 就持续准确识别真实活动；
- 至少 3 次真实应用切换是否产生正确且不烦人的模式响应；
- Pinned App 是否真的能启动/激活用户需要的应用；
- Dock 是否比任务栏/浏览器标签更方便；
- 是否发生意外启动、聚焦被抢、遮挡、误分类、卡死或错误退出；
- 安装、启动和退出是否足够简单；
- 用户是否愿意连续使用，还是更想卸载。

**用户主观价值是独立验收关口，不能由 Claude、Muse、自动化测试或模拟操作者代签。**

## 4. Windows 系统补充测试

- Windows 11 真机：非管理员启动、拒绝未知启动请求、断开 Native Companion 后自动退化、进程崩溃恢复、网络适配器禁用但回环仍可用的实测；无实际证据须 NOT VERIFIED。
- 全 OS 重启后的手动恢复路径必须可复现；本阶段不强制开机自启，但必须说明未提供自动启动。
- 单屏至少 PASS；多屏、全屏、睡眠唤醒、DPI 缩放按现有资源尽可能验证。未测试不可称 PASS。
- 代码/依赖安全、日志脱敏、无秘钥泄漏、CI 测试；避免把机器用户名、私有路径、通知内容发到公开证据。
- Muse 如无法访问工程，应提供工具/授权/目标路径的原始阻断信息，并可使用独立 Claude QA 子代理补充验证，但必须标记 `NOT MUSE VERIFIED`。

## 5. Mac R1 解锁（并行但不能阻塞 Windows 试点）

已知 Tailscale Peer 在线、SSH 服务给出 host key，但本地未信任。不能自动执行 `StrictHostKeyChecking=no` 或直接把 `ssh-keyscan` 结果当身份验证。先让用户在 **Mac 本机终端** 执行：

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

将命令输出 SHA256 与 Windows SSH 连接看到的 ED25519 指纹独立核对。仅匹配并获得用户授权后才添加 known_hosts、SSH 登录。不要在聊天中要求或暴露私有密钥、登录密码、Tailscale auth key。

连接后按 Gate R1：Mac 本机启动 Web backend + Swift Bridge，验证 NSWorkspace 真实事件、NSPanel 可见、应用退出、权限拒绝和 GUI 会话；如果 SSH 登录后无可用桌面会话，不要把编译成功记成 UI PASS。远程 Windows 通过 SSH 隧道看 Mac Web 后端时，不将 127.0.0.1 API 改为 0.0.0.0。

Mac 未完成 R1 时可以完成 Windows 试点，但不能声称 macOS 支持已完成。

## 6. 优先级和 Stop Rules

当前阶段唯一允许的开发：上述用户试用准备、必要安全修复、真实桌面集成和真实试用证据。禁止先开发 AI 新角色、装饰动画、更多模拟通知、付费功能或云端同步。

在交付试点后立刻停止加功能，等待用户亲自试用并反馈；不是等待开发者内部演示。若用户评价“没有节约时间 / 不愿意继续使用”，应提出 PARK/ARCHIVE 而非继续增加功能。

用户认可后，再由 ChatGPT 决策是否进入 Installer、自动启动、更多 Mac 实现、签名与新公开 Release。未经用户授权，禁止公开新 Release、改动 Profile 或发布新营销内容。

## 7. 向 ChatGPT 的唯一交付

提交 `docs/WINDOWS_HANDS_ON.md` 与 `TRIAL_READINESS_REPORT.md`，必须包含：

1. 分项 PASS/FAIL/BLOCKED/NOT VERIFIED；
2. 可复制的 Windows 一键启动步骤以及真实应用的试用路径；
3. 原生浮动 Dock **真机证据**，或明确可复现的阻塞错误；
4. 连续三次切换的真实事件时间线，和 manual_lock 状态解释；
5. 默认坏图标、测试替身整改证据；
6. Mac 指纹核对所需的最少用户操作；
7. 完整 QA 状态：Muse 是否实测、替代 QA 由谁执行；
8. 新增 commit、CI 链接、文件清单、残留缺陷、是否可开展用户试点的明确建议。

完成后不要自动声称下一版本已发布或项目已实现日常价值。
