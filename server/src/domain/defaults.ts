import type { ModeConfig } from "./schemas";

export type SeedMode = Omit<ModeConfig, "sort_order"> & { id: string; sort_order: number };

export const DEFAULT_MODES: SeedMode[] = [
  {
    id: "writing",
    name: "Writing",
    color: "amber",
    icon: "✍",
    sort_order: 0,
    pinned_items: [
      { id: "notes", label: "Notes", icon: "📝", kind: "app", bundle_id: "com.apple.Notes" },
      { id: "docs", label: "Docs", icon: "📄", kind: "bookmark", url: "https://docs.google.com" },
      { id: "browser", label: "Browser", icon: "🌐", kind: "app", bundle_id: "com.google.Chrome" },
    ],
    activity_app_allowlist: [
      "com.apple.Notes",
      "com.google.Chrome",
      "com.apple.Safari",
      "md.obsidian",
      "notepad.exe",
      "winword.exe",
      "obsidian.exe",
    ],
    keywords: ["write", "draft", "essay", "paper", "写作", "论文", "稿"],
    transition: { manual_immediate: true, auto_suggest_only: true, dwell_seconds: 15, cooldown_seconds: 60 },
    notifications: { default: "defer", time_sensitive: "show", switch_wait_seconds: 30, social_switch_enabled: true },
  },
  {
    id: "building",
    name: "Building",
    color: "blue",
    icon: "⚒",
    sort_order: 1,
    pinned_items: [
      { id: "vscode", label: "VS Code", icon: "⌨", kind: "app", bundle_id: "com.microsoft.VSCode" },
      { id: "terminal", label: "Terminal", icon: "▣", kind: "app", bundle_id: "com.apple.Terminal" },
      { id: "browser", label: "Browser", icon: "🌐", kind: "app", bundle_id: "com.google.Chrome" },
      { id: "github", label: "GitHub", icon: "⑂", kind: "bookmark", url: "https://github.com" },
    ],
    activity_app_allowlist: [
      "com.microsoft.VSCode",
      "com.apple.Terminal",
      "com.google.Chrome",
      "com.apple.Safari",
      "com.googlecode.iterm2",
      "code.exe",
      "devenv.exe",
      "windowsterminal.exe",
      "cmd.exe",
      "powershell.exe",
    ],
    keywords: ["code", "build", "debug", "terminal", "repo", "代码", "编程", "调试"],
    transition: { manual_immediate: true, auto_suggest_only: true, dwell_seconds: 15, cooldown_seconds: 60 },
    notifications: { default: "defer", time_sensitive: "show", switch_wait_seconds: 30, social_switch_enabled: true },
  },
  {
    id: "research",
    name: "Research",
    color: "violet",
    icon: "🔬",
    sort_order: 2,
    pinned_items: [
      { id: "zotero", label: "Zotero", icon: "📚", kind: "app", bundle_id: "com.zotero.Zotero" },
      { id: "papers", label: "Papers", icon: "📄", kind: "bookmark", url: "https://scholar.google.com" },
      { id: "browser", label: "Browser", icon: "🌐", kind: "app", bundle_id: "com.google.Chrome" },
    ],
    activity_app_allowlist: [
      "com.zotero.Zotero",
      "com.google.Chrome",
      "com.apple.Safari",
      "com.apple.Preview",
      "zotero.exe",
    ],
    keywords: ["research", "literature", "read", "study", "文献", "阅读", "研究"],
    transition: { manual_immediate: true, auto_suggest_only: true, dwell_seconds: 15, cooldown_seconds: 60 },
    notifications: { default: "defer", time_sensitive: "show", switch_wait_seconds: 30, social_switch_enabled: true },
  },
  {
    id: "meeting",
    name: "Meeting",
    color: "teal",
    icon: "🎙",
    sort_order: 3,
    pinned_items: [
      { id: "zoom", label: "Zoom", icon: "🎥", kind: "app", bundle_id: "us.zoom.xos" },
      { id: "notes", label: "Notes", icon: "📝", kind: "app", bundle_id: "com.apple.Notes" },
      { id: "calendar", label: "Calendar", icon: "📅", kind: "app", bundle_id: "com.apple.iCal" },
    ],
    activity_app_allowlist: [
      "us.zoom.xos",
      "com.apple.Notes",
      "com.apple.iCal",
      "com.microsoft.teams2",
      "zoom.exe",
      "teams.exe",
      "ms-teams.exe",
    ],
    keywords: ["meeting", "call", "zoom", "会议", "开会", "讨论"],
    transition: { manual_immediate: true, auto_suggest_only: true, dwell_seconds: 15, cooldown_seconds: 60 },
    notifications: { default: "defer", time_sensitive: "show", switch_wait_seconds: 30, social_switch_enabled: true },
  },
  {
    id: "break",
    name: "Break",
    color: "rose",
    icon: "🌿",
    sort_order: 4,
    pinned_items: [
      { id: "music", label: "Music", icon: "♫", kind: "app", bundle_id: "com.apple.Music" },
      { id: "photos", label: "Photos", icon: "▧", kind: "app", bundle_id: "com.apple.Photos" },
    ],
    activity_app_allowlist: [
      "com.apple.Music",
      "com.apple.Photos",
      "com.apple.TV",
      "spotify.exe",
      "music.ui.exe",
    ],
    keywords: ["break", "rest", "walk", "休息", "放松"],
    transition: { manual_immediate: true, auto_suggest_only: true, dwell_seconds: 15, cooldown_seconds: 60 },
    notifications: { default: "show", time_sensitive: "show", switch_wait_seconds: 0, social_switch_enabled: false },
  },
  {
    id: "social",
    name: "Social",
    color: "pink",
    icon: "💬",
    sort_order: 5,
    pinned_items: [
      { id: "slack", label: "Slack", icon: "◈", kind: "app", bundle_id: "com.tinyspeck.slackmacgap" },
      { id: "x", label: "X", icon: "𝕏", kind: "app", bundle_id: "com.twitter.twitter-mac" },
      { id: "wechat", label: "WeChat", icon: "✉", kind: "app", bundle_id: "com.tencent.xinWeChat" },
    ],
    activity_app_allowlist: [
      "com.tinyspeck.slackmacgap",
      "com.twitter.twitter-mac",
      "com.tencent.xinWeChat",
      "com.hnc.Discord",
      "com.apple.MobileSMS",
      "slack.exe",
      "discord.exe",
      "wechat.exe",
    ],
    keywords: ["social", "slack", "twitter", "wechat", "discord", "社交", "微信"],
    transition: { manual_immediate: true, auto_suggest_only: true, dwell_seconds: 15, cooldown_seconds: 60 },
    notifications: { default: "show", time_sensitive: "show", switch_wait_seconds: 0, social_switch_enabled: false },
  },
];

export function defaultModes(platform: string = process.platform): SeedMode[] {
  return DEFAULT_MODES.map((mode) => ({
    ...mode,
    pinned_items: platform === "win32"
      ? mode.pinned_items.filter((item) => item.kind === "bookmark")
      : mode.pinned_items,
  }));
}

export const SOCIAL_APP_HINTS = [
  "slack",
  "discord",
  "twitter",
  "x",
  "wechat",
  "微信",
  "instagram",
  "messages",
  "teams",
];

export const URGENT_KEYWORDS = [
  "urgent",
  "asap",
  "immediately",
  "deadline",
  "incident",
  "outage",
  "p0",
  "critical",
  "紧急",
  "立即",
  "马上",
  "截止",
  "故障",
  "报警",
];
