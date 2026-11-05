# Windows 本地试用手册

> FocusDock AI — Windows 试用版（v0.2-dev）单入口启动与浮动 Dock

---

## 1. 先决条件

| 项目 | 要求 |
|------|------|
| 操作系统 | Windows 11 10.0.22621+（含 24H2） |
| Node.js | 22.5+（推荐 24 LTS） |
| WebView2 | Microsoft Edge WebView2 Evergreen Runtime（已随 Edge/Office 自动安装，未安装时首次启动会提示） |
| 权限 | 普通用户即可（无需管理员） |
| 网络 | 首次构建需联网下载 WebView2 SDK（约 800 KB）；运行时仅回环，无需联网 |

---

## 2. 单命令启动

双击 **`Start-FocusDock.cmd`**，或在 PowerShell 中运行：

```powershell
.\Start-FocusDock.cmd
```

> 启动器会显式使用 Windows PowerShell 5.1，避免 PowerShell 7.6.x 在窄控制台/重定向输出时启动即崩溃（`totalWidth ('-17')` / `ShowUpdateNotification`）。请通过 `.cmd` 启动，不要直接用 `pwsh scripts\Start-FocusDock.ps1`。

脚本会自动：
1. 检查 Node.js 版本和端口占用（4317）。
2. `npm run build` 构建前端。
3. 编译 Windows Companion（含 WebView2 浮动 Dock）。
4. 启动本地后端（`http://127.0.0.1:4317`）并生成 Bridge Token。
5. 启动 Companion（托盘 + 浮动 Dock）。
6. 打印提示：`已启动：后端和原生浮动条由同一个托盘入口管理。右击托盘图标 → Exit / 退出可全部关闭。`

**常见启动失败与对策**

| 报错 | 原因 | 解决 |
|------|------|------|
| `端口 4317 已占用` | 已有 FocusDock 或其他程序占用 | 右击托盘 → Exit；或关闭冲突程序 |
| `前端构建失败` | 依赖缺失或源码错误 | `npm install` 后重试 |
| `原生组件构建失败` | 旧版残留或缺少 WebView2 SDK | 退出旧实例重试；首次需联网 |
| `浮动 Dock 无法加载 WebView2` | 未安装 WebView2 Runtime | 安装 [Microsoft Edge WebView2 Evergreen](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) |

---

## 3. 界面与核心流程

### 3.1 浮动 Dock（Windows 原生）

- 位置：屏幕底部居中，常驻置顶，不抢焦点、不遮挡工作区。
- 显示：六大模式、+ 添加本机应用、锁定/解锁、语言切换、版本号。
- 状态栏：`Windows — 已连接` 表示 Bridge 心跳正常。

### 3.2 完整 Dashboard（浏览器）

访问 `http://127.0.0.1:4317`，功能完整：
- **专注**：模式英雄卡、建议横幅、事件流、时间环。
- **时间线**：所有事件与决策审计。
- **模式**：增删改、固定项、关键词、通知策略。
- **AI 工作室**：自然语言改模式 → Diff → 确认应用/回滚。
- **权限**：能力矩阵、隐私设置、语言切换。
- **演示控制台**：模拟 Slack、时间敏感、VS Code 专注、突发 50 条。

### 3.3 原生应用固定与启动

1. 浮动 Dock 或 Dashboard 点击 **+ 添加本机应用**。
2. 搜索 → 测试启动（弹窗右侧“测试启动”） → 固定（“固定”按钮）。
3. 固定后出现在 Dock 栏，点击图标即可启动/激活。
4. 启动审计记录在 `%LOCALAPPDATA%\FocusDock\runtime\launch-audit.log`（SHA-256 校验）。

> ⚠️ 仅允许 Start Menu 解析到的真实 `.exe`；不接受任意命令行、URI 或 Shell 命令。

### 3.4 模式建议与手动锁定

- 规则引擎：15 秒稳定前台 → 建议切换模式（横幅上方）。
- 手动锁定（锁图标）：暂停所有建议，横幅显示“已锁定 · 暂停模式建议”。
- 解锁后恢复自动建议。

### 3.5 社交应用冷静期

- 固定社交类应用（Slack/Telegram 等）后点击 → 30 秒倒计时弹窗。
- 可取消、倒计时结束后“立即打开”。
- **仅为 Dock 内提示，不拦截系统级通知、不阻止直接启动**。

---

## 4. 数据与隐私

- 所有数据存于 `%LOCALAPPDATA%\FocusDock\focusdock.db`（SQLite）。
- 导出/导入：设置 → 导出 JSON / 导入 JSON。
- 隐私设置：`Settings → Privacy`
  - `store_window_titles: false`（默认不存标题）
  - `retention_days: 7`（默认保留 7 天）
  - `excluded_apps: []`（排除列表）
- AI：默认 `rules`（本地离线），可选 Ollama / OpenAI-compatible，`cloud_opt_in: false`。

---

## 5. 卸载与回滚

| 操作 | 命令/步骤 |
|------|-----------|
| 完全卸载 | 删除 `%LOCALAPPDATA%\FocusDock` 目录 |
| 仅重置数据 | 删除 `%LOCALAPPDATA%\FocusDock\focusdock.db` 及 `runtime\` 目录 |
| 回退版本 | 重新克隆旧 Tag 并 `npm install && npm run build` |

> 注：无安装程序、无注册表项、无系统服务、无自动更新。

---

## 6. 常见问题

| 现象 | 排查 |
|------|------|
| 浮动 Dock 不显示 | 右击托盘 → Show / hide Dock；或检查 WebView2 Runtime |
| Bridge 显示“仅 Web — 无本机访问” | 托盘右击 → Exit → 重新双击 `Start-FocusDock.cmd` |
| 点击固定应用无反应 | 检查 `%LOCALAPPDATA%\FocusDock\runtime\floating-dock-error.log` |
| 端口冲突 | `netstat -ano \| findstr :4317` 找到占用进程并结束 |
| 启动即报 `totalWidth ('-17')` 或 `ShowUpdateNotification` | 这是 PowerShell 7.6.x 的启动缺陷；`Start-FocusDock.cmd` 已固定使用 Windows PowerShell 5.1，请通过 `.cmd` 启动，不要直接 `pwsh` 运行脚本 |

---

## 7. 支持与反馈

- 仓库：<https://github.com/AIMetaPhD/agentic-focus-dock>
- Issues：功能建议 / Bug 报告请附截图、日志、复现步骤。
- 本手册随 v0.2-dev 发布，随代码同步更新。