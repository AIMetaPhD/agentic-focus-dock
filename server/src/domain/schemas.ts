import { z } from "zod";

export const MODE_COLORS = [
  "amber",
  "blue",
  "violet",
  "teal",
  "rose",
  "pink",
  "lime",
  "slate",
] as const;

export const colorSchema = z.enum(MODE_COLORS);

export const pinnedItemSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(80),
  icon: z.string().min(1).max(8),
  kind: z.enum(["app", "bookmark"]).default("app"),
  bundle_id: z.string().max(120).optional(),
  url: z.string().url().max(500).optional(),
});

export const transitionSchema = z.object({
  manual_immediate: z.boolean().default(true),
  auto_suggest_only: z.boolean().default(true),
  dwell_seconds: z.number().int().min(0).max(600).default(15),
  cooldown_seconds: z.number().int().min(0).max(3600).default(60),
});

export const notificationPolicySchema = z.object({
  default: z.enum(["show", "defer", "ignore"]).default("defer"),
  time_sensitive: z.enum(["show", "defer"]).default("show"),
  switch_wait_seconds: z.number().int().min(0).max(300).default(30),
  social_switch_enabled: z.boolean().default(true),
});

export const modeInputSchema = z.object({
  name: z.string().min(1).max(40),
  color: colorSchema.default("amber"),
  icon: z.string().min(1).max(8).default("◎"),
  pinned_items: z.array(pinnedItemSchema).max(12).default([]),
  activity_app_allowlist: z.array(z.string().min(1).max(120)).max(30).default([]),
  keywords: z.array(z.string().min(1).max(40)).max(30).default([]),
  transition: transitionSchema.default({
    manual_immediate: true,
    auto_suggest_only: true,
    dwell_seconds: 15,
    cooldown_seconds: 60,
  }),
  notifications: notificationPolicySchema.default({
    default: "defer",
    time_sensitive: "show",
    switch_wait_seconds: 30,
    social_switch_enabled: true,
  }),
  sort_order: z.number().int().min(0).max(999).default(0),
});

export type ModeConfig = z.infer<typeof modeInputSchema>;
export type PinnedItem = z.infer<typeof pinnedItemSchema>;

export type Mode = ModeConfig & {
  id: string;
  version: number;
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
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

export const EVENT_SOURCES = [
  "simulated",
  "product",
  "bridge",
  "connected-official",
] as const;

export const eventPayloadSchema = z.object({
  app_id: z.string().max(120).optional(),
  app_name: z.string().max(120).optional(),
  title: z.string().max(200).optional(),
  body: z.string().max(400).optional(),
  category: z.string().max(60).optional(),
  time_sensitive: z.boolean().optional(),
  stable_seconds: z.number().min(0).max(86_400).optional(),
  simulated: z.boolean().optional(),
});

export const activityInputSchema = z.object({
  source: z.enum(EVENT_SOURCES).default("simulated"),
  source_app: z.string().min(1).max(120),
  timestamp: z.string().datetime({ offset: true }).optional(),
  payload: eventPayloadSchema.default({}),
  dedupe_key: z.string().max(160).optional(),
});

export const notificationInputSchema = z.object({
  source: z.enum(EVENT_SOURCES).default("simulated"),
  source_app: z.string().min(1).max(120),
  timestamp: z.string().datetime({ offset: true }).optional(),
  payload: eventPayloadSchema.default({}),
  dedupe_key: z.string().max(160).optional(),
});

export type EventKind = "activity" | "notification";

export type Classification = {
  mode: string | null;
  decision:
    | "stay"
    | "hold"
    | "suggest_switch"
    | "auto_switch"
    | "show"
    | "defer"
    | "ignore"
    | "time_sensitive";
  suggested_mode?: string | null;
  confidence: number;
  reason: string;
  engine: "rules" | "rules-fallback" | "ollama" | "openai-compatible" | "manual";
  matched_rule?: string | null;
};

export type ActivityEvent = {
  id: string;
  kind: EventKind;
  source: (typeof EVENT_SOURCES)[number];
  source_app: string;
  timestamp: string;
  payload_level: "metadata_only" | "content";
  payload: z.infer<typeof eventPayloadSchema>;
  classification: Classification;
  actual_action:
    | "none"
    | "suggested"
    | "switched"
    | "queued_in_app"
    | "shown"
    | "deferred";
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

export const proposalPatchOpSchema = z.object({
  op: z.enum(["add", "replace", "remove"]),
  path: z.string().min(1).max(200),
  value: z.unknown().optional(),
});

export type ProposalPatchOp = z.infer<typeof proposalPatchOpSchema>;

export type ProposalDiffEntry = {
  path: string;
  op: "add" | "replace" | "remove";
  before: unknown;
  after: unknown;
  summary: string;
};

export type Proposal = {
  id: string;
  created_at: string;
  source: "rules" | "ollama" | "openai-compatible" | "rules-fallback";
  prompt: string;
  summary: string;
  patch: ProposalPatchOp[];
  diff: ProposalDiffEntry[];
  status: "proposed" | "applied" | "rejected" | "failed";
  error: string | null;
  applied_at: string | null;
  applied_mode_ids: string[];
};

export const settingsSchema = z.object({
  language: z.enum(["en", "zh"]).default("zh"),
  ai: z
    .object({
      provider: z.enum(["rules", "ollama", "openai-compatible"]).default("rules"),
      ollama_url: z.string().url().default("http://127.0.0.1:11434"),
      ollama_model: z.string().max(80).default("qwen2.5:7b"),
      base_url: z.string().url().default("https://api.openai.com/v1"),
      model: z.string().max(80).default("gpt-4o-mini"),
      cloud_opt_in: z.boolean().default(false),
      include_recent_activity: z.boolean().default(false),
    })
    .default({
      provider: "rules",
      ollama_url: "http://127.0.0.1:11434",
      ollama_model: "qwen2.5:7b",
      base_url: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      cloud_opt_in: false,
      include_recent_activity: false,
    }),
  privacy: z
    .object({
      retention_days: z.number().int().min(1).max(365).default(7),
      store_window_titles: z.boolean().default(false),
      excluded_apps: z.array(z.string().max(120)).max(50).default([]),
    })
    .default({
      retention_days: 7,
      store_window_titles: false,
      excluded_apps: [],
    }),
});

export type Settings = z.infer<typeof settingsSchema>;

export const aiSettingsPatchSchema = z
  .object({
    provider: z.enum(["rules", "ollama", "openai-compatible"]),
    ollama_url: z.string().url(),
    ollama_model: z.string().max(80),
    base_url: z.string().url(),
    model: z.string().max(80),
    cloud_opt_in: z.boolean(),
    include_recent_activity: z.boolean(),
  })
  .partial();

export const privacySettingsPatchSchema = z
  .object({
    retention_days: z.number().int().min(1).max(365),
    store_window_titles: z.boolean(),
    excluded_apps: z.array(z.string().max(120)).max(50),
  })
  .partial();

export const modePatchOpPathRe =
  /^\/modes\/[a-z0-9][a-z0-9-]{0,31}(\/(?:name|color|icon|pinned_items|activity_app_allowlist|keywords|transition|notifications|sort_order))?(\/(?:manual_immediate|auto_suggest_only|dwell_seconds|cooldown_seconds|default|time_sensitive|switch_wait_seconds|social_switch_enabled))?$/;
