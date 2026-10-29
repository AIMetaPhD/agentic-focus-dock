export type ModeColor =
  | "amber"
  | "blue"
  | "violet"
  | "teal"
  | "rose"
  | "pink"
  | "lime"
  | "slate";

export type PinnedItem = {
  id: string;
  label: string;
  icon: string;
  kind: "app" | "bookmark";
  bundle_id?: string;
  url?: string;
};

export type ModeConfig = {
  name: string;
  color: ModeColor;
  icon: string;
  pinned_items: PinnedItem[];
  activity_app_allowlist: string[];
  keywords: string[];
  transition: {
    manual_immediate: boolean;
    auto_suggest_only: boolean;
    dwell_seconds: number;
    cooldown_seconds: number;
  };
  notifications: {
    default: "show" | "defer" | "ignore";
    time_sensitive: "show" | "defer";
    switch_wait_seconds: number;
    social_switch_enabled: boolean;
  };
  sort_order: number;
};

export type Mode = ModeConfig & {
  id: string;
  version: number;
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
};

export type Classification = {
  mode: string | null;
  decision: string;
  suggested_mode?: string | null;
  confidence: number;
  reason: string;
  engine: string;
  matched_rule?: string | null;
};

export type ActivityEvent = {
  id: string;
  kind: "activity" | "notification";
  source: "simulated" | "product" | "bridge" | "connected-official";
  source_app: string;
  timestamp: string;
  payload_level: "metadata_only" | "content";
  payload: {
    app_id?: string;
    app_name?: string;
    title?: string;
    body?: string;
    category?: string;
    time_sensitive?: boolean;
    stable_seconds?: number;
    simulated?: boolean;
  };
  classification: Classification;
  actual_action: string;
  created_at: string;
};

export type PendingNotification = {
  id: string;
  event_id: string;
  mode_id: string;
  status: "pending" | "later" | "stayed" | "go_social" | "dismissed";
  wait_seconds: number;
  created_at: string;
  ready_at: string;
  updated_at: string;
  event?: ActivityEvent;
};

export type Settings = {
  language: "en" | "zh";
  ai: {
    provider: "rules" | "ollama" | "openai-compatible";
    ollama_url: string;
    ollama_model: string;
    base_url: string;
    model: string;
    cloud_opt_in: boolean;
    include_recent_activity: boolean;
    has_api_key?: boolean;
  };
  privacy: {
    retention_days: number;
    store_window_titles: boolean;
    excluded_apps: string[];
  };
  data_dir?: string;
};

export type Capabilities = {
  protocol: number;
  version: string;
  platform: string;
  web: Record<string, boolean | string>;
  bridge: {
    available: boolean;
    status: string;
    last_seen: string | null;
    capabilities: Record<string, string> | null;
    note: string;
  };
  system_notifications: { supported: boolean; reason: string };
  accessibility: { status: string; note: string };
  cloud_ai: { provider: string; opt_in: boolean };
};

export type Runtime = {
  active_mode: string;
  manual_lock: boolean;
  last_suggestion_at: string | null;
  last_suggested_mode: string | null;
};

export type AppState = {
  protocol: number;
  version: string;
  modes: Mode[];
  runtime: Runtime;
  active_mode: string;
  pending_notifications: PendingNotification[];
  settings: Settings;
  bridge: {
    connected: boolean;
    last_seen: string | null;
    bridge_version: string | null;
    capabilities: Record<string, string> | null;
    token_path: string;
  };
  capabilities: Capabilities;
  counts: { events: number; modes: number };
};

export type DiffEntry = {
  path: string;
  op: "add" | "replace" | "remove";
  before: unknown;
  after: unknown;
  summary: string;
};

export type Proposal = {
  id: string;
  created_at: string;
  source: string;
  prompt: string;
  summary: string;
  patch: { op: string; path: string; value?: unknown }[];
  diff: DiffEntry[];
  status: "proposed" | "applied" | "rejected" | "failed";
  error: string | null;
  applied_at: string | null;
  applied_mode_ids: string[];
  fallback_reason?: string | null;
  latency_ms?: number | null;
};

export type ModeVersion = {
  id: number;
  mode_id: string;
  version: number;
  snapshot: ModeConfig;
  source: string;
  note: string | null;
  created_at: string;
};
