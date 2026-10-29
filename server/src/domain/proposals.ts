import { z } from "zod";
import {
  colorSchema,
  modeInputSchema,
  modePatchOpPathRe,
  notificationPolicySchema,
  pinnedItemSchema,
  proposalPatchOpSchema,
  transitionSchema,
  type Mode,
  type ModeConfig,
  type ProposalDiffEntry,
  type ProposalPatchOp,
} from "./schemas";
import type { Store } from "../store";

export class ProposalError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const FIELD_SCHEMAS: Record<string, z.ZodTypeAny> = {
  name: z.string().min(1).max(40),
  color: colorSchema,
  icon: z.string().min(1).max(8),
  pinned_items: z.array(pinnedItemSchema).max(12),
  activity_app_allowlist: z.array(z.string().min(1).max(120)).max(30),
  keywords: z.array(z.string().min(1).max(40)).max(30),
  transition: transitionSchema,
  notifications: notificationPolicySchema,
  sort_order: z.number().int().min(0).max(999),
};

const SUB_SCHEMAS: Record<string, z.ZodTypeAny> = {
  manual_immediate: z.boolean(),
  auto_suggest_only: z.boolean(),
  dwell_seconds: z.number().int().min(0).max(600),
  cooldown_seconds: z.number().int().min(0).max(3600),
  default: z.enum(["show", "defer", "ignore"]),
  time_sensitive: z.enum(["show", "defer"]),
  switch_wait_seconds: z.number().int().min(0).max(300),
  social_switch_enabled: z.boolean(),
};

type VirtualDoc = { modes: Record<string, ModeConfig> };

export function modeToConfig(mode: Mode): ModeConfig {
  return {
    name: mode.name,
    color: mode.color,
    icon: mode.icon,
    pinned_items: mode.pinned_items,
    activity_app_allowlist: mode.activity_app_allowlist,
    keywords: mode.keywords,
    transition: mode.transition,
    notifications: mode.notifications,
    sort_order: mode.sort_order,
  };
}

function virtualDoc(modes: Mode[]): VirtualDoc {
  return {
    modes: Object.fromEntries(modes.map((m) => [m.id, structuredClone(modeToConfig(m))])),
  };
}

function assertValue(schema: z.ZodTypeAny, value: unknown, label: string): void {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ProposalError(
      "invalid_value",
      `${label} is invalid${issue ? `: ${issue.message}` : "."}`,
    );
  }
}

export function validatePatch(raw: unknown, modes: Mode[]): ProposalPatchOp[] {
  const parsed = z.array(proposalPatchOpSchema).min(1).max(12).safeParse(raw);
  if (!parsed.success) {
    throw new ProposalError("invalid_patch", "Proposal must contain 1–12 patch operations.");
  }
  const ops = parsed.data;
  const existing = new Set(modes.map((m) => m.id));
  for (const op of ops) {
    if (!modePatchOpPathRe.test(op.path)) {
      throw new ProposalError("path_not_allowed", `Path is outside the editable mode surface: ${op.path}`);
    }
    if (/(__proto__|constructor|prototype|\.\.)/.test(op.path)) {
      throw new ProposalError("path_not_allowed", `Unsafe path: ${op.path}`);
    }
    const [, , id, field, sub] = op.path.split("/");
    if (!id) throw new ProposalError("path_not_allowed", "Missing mode id.");
    if (op.op === "add" && field === undefined) {
      if (existing.has(id)) {
        throw new ProposalError("mode_exists", `Mode ${id} already exists; use replace to edit it.`);
      }
      assertValue(modeInputSchema, op.value, "mode configuration");
      continue;
    }
    if (!existing.has(id)) {
      throw new ProposalError("mode_missing", `Mode ${id} does not exist.`);
    }
    if (op.op === "remove") {
      if (field !== undefined) {
        throw new ProposalError("remove_not_allowed", "Only a whole mode can be removed.");
      }
      continue;
    }
    if (op.value === undefined) throw new ProposalError("value_missing", `Missing value for ${op.path}`);
    if (field === undefined) {
      assertValue(modeInputSchema, op.value, "mode configuration");
      continue;
    }
    if (!(field in FIELD_SCHEMAS)) throw new ProposalError("field_not_allowed", `Field ${field} is not editable.`);
    if (sub === undefined) {
      assertValue(FIELD_SCHEMAS[field]!, op.value, field);
    } else {
      const allowed = field === "transition" || field === "notifications";
      if (!allowed || !(sub in SUB_SCHEMAS)) {
        throw new ProposalError("field_not_allowed", `Field ${field}.${sub} is not editable.`);
      }
      assertValue(SUB_SCHEMAS[sub]!, op.value, `${field}.${sub}`);
    }
  }
  return ops;
}

export function computeDiff(ops: ProposalPatchOp[], modes: Mode[]): {
  diff: ProposalDiffEntry[];
  next: VirtualDoc;
} {
  const doc = virtualDoc(modes);
  const diff: ProposalDiffEntry[] = [];
  for (const op of ops) {
    const [, , id, field, sub] = op.path.split("/");
    if (!id) continue;
    const beforeMode = doc.modes[id];
    let before: unknown = null;
    if (field === undefined) before = beforeMode ?? null;
    else if (beforeMode && field === "transition") before = beforeMode.transition;
    else if (beforeMode && field === "notifications") before = beforeMode.notifications;
    else if (beforeMode) before = (beforeMode as Record<string, unknown>)[field] as unknown;

    const beforeValue =
      sub !== undefined && before && typeof before === "object"
        ? (before as Record<string, unknown>)[sub]
        : before;

    if (op.op === "remove") {
      delete doc.modes[id];
      diff.push({
        path: op.path,
        op: "remove",
        before: beforeValue,
        after: null,
        summary: `Delete mode "${beforeMode?.name ?? id}"`,
      });
      continue;
    }

    const value = op.value;
    if (field === undefined) {
      const config = modeInputSchema.parse(value);
      doc.modes[id] = config;
      diff.push({
        path: op.path,
        op: op.op,
        before: beforeValue,
        after: config,
        summary: `${op.op === "add" ? "Create" : "Replace"} mode "${config.name}"`,
      });
    } else if (sub === undefined) {
      if (!beforeMode) continue;
      (beforeMode as unknown as Record<string, unknown>)[field] = value;
      diff.push({
        path: op.path,
        op: op.op,
        before: beforeValue,
        after: value,
        summary: `${op.op === "add" ? "Add" : "Change"} ${field} on "${beforeMode.name}"`,
      });
    } else {
      if (!beforeMode) continue;
      const container = (beforeMode as unknown as Record<string, Record<string, unknown>>)[field];
      if (!container) continue;
      container[sub] = value;
      diff.push({
        path: op.path,
        op: op.op,
        before: beforeValue,
        after: value,
        summary: `Change ${field}.${sub} on "${beforeMode.name}"`,
      });
    }
  }
  return { diff, next: doc };
}

export function applyOps(store: Store, ops: ProposalPatchOp[], source: string): string[] {
  const modes = store.listModes();
  const validated = validatePatch(ops, modes);
  const byMode = new Map<string, ProposalPatchOp[]>();
  for (const op of validated) {
    const id = op.path.split("/")[2]!;
    const list = byMode.get(id) ?? [];
    list.push(op);
    byMode.set(id, list);
  }

  const applied: string[] = [];
  store.db.exec("BEGIN");
  try {
    for (const [id, modeOps] of byMode) {
      const current = store.getMode(id);
      const remove = modeOps.some((op) => op.op === "remove" && op.path === `/modes/${id}`);
      if (remove) {
        if (current) store.deleteMode(id);
        applied.push(id);
        continue;
      }
      const createOp = modeOps.find((op) => op.op === "add" && op.path === `/modes/${id}`);
      if (!current && createOp) {
        store.createMode(createOp.value, { id, source });
        applied.push(id);
        continue;
      }
      if (!current) continue;
      let config: ModeConfig = structuredClone(modeToConfig(current));
      for (const op of modeOps) {
        const [, , , field, sub] = op.path.split("/");
        if (field === undefined) {
          config = modeInputSchema.parse(op.value);
        } else if (sub === undefined) {
          (config as unknown as Record<string, unknown>)[field] = op.value;
        } else {
          const container = (config as unknown as Record<string, Record<string, unknown>>)[field];
          if (container) container[sub] = op.value;
        }
      }
      store.replaceModeConfig(id, config, source, "AI proposal applied");
      applied.push(id);
    }
    store.db.exec("COMMIT");
  } catch (error) {
    store.db.exec("ROLLBACK");
    throw error;
  }
  return applied;
}

// ---------------------------------------------------------------------------
// Deterministic offline proposer. This is the default "AI" path with no model.
// ---------------------------------------------------------------------------

const DOMAIN_TEMPLATES: Record<
  string,
  {
    color: ModeConfig["color"];
    icon: string;
    apps: string[];
    urls: (string | null)[];
    bundles: string[];
    keywords: string[];
  }
> = {
  research: {
    color: "violet",
    icon: "🔬",
    apps: ["Zotero", "Papers", "Browser"],
    urls: [null, "https://scholar.google.com", null],
    bundles: ["com.zotero.Zotero", "com.google.Chrome", "com.apple.Safari", "com.apple.Preview"],
    keywords: ["research", "literature", "read", "文献", "阅读", "研究"],
  },
  writing: {
    color: "amber",
    icon: "✍",
    apps: ["Notes", "Docs", "Browser"],
    urls: [null, "https://docs.google.com", null],
    bundles: ["com.apple.Notes", "com.google.Chrome", "com.apple.Safari"],
    keywords: ["write", "draft", "essay", "写作", "论文"],
  },
  building: {
    color: "blue",
    icon: "⚒",
    apps: ["VS Code", "Terminal", "Browser"],
    urls: [null, null, "https://github.com"],
    bundles: ["com.microsoft.VSCode", "com.apple.Terminal", "com.google.Chrome"],
    keywords: ["code", "build", "debug", "代码", "编程"],
  },
  social: {
    color: "pink",
    icon: "💬",
    apps: ["Slack", "X", "WeChat"],
    urls: [null, null, null],
    bundles: ["com.tinyspeck.slackmacgap", "com.twitter.twitter-mac", "com.tencent.xinWeChat"],
    keywords: ["social", "slack", "微信", "社交"],
  },
  meeting: {
    color: "teal",
    icon: "🎙",
    apps: ["Zoom", "Notes", "Calendar"],
    urls: [null, null, null],
    bundles: ["us.zoom.xos", "com.apple.Notes", "com.apple.iCal"],
    keywords: ["meeting", "call", "会议"],
  },
  break: {
    color: "rose",
    icon: "🌿",
    apps: ["Music", "Photos"],
    urls: [null, null],
    bundles: ["com.apple.Music", "com.apple.Photos"],
    keywords: ["break", "rest", "休息"],
  },
};

function detectDomain(text: string): string {
  const t = text.toLowerCase();
  if (/论文|文献|paper|research|literature|阅读|study/.test(t)) return "research";
  if (/写作|草稿|write|draft|essay/.test(t)) return "writing";
  if (/编程|代码|开发|build|code|debug|terminal/.test(t)) return "building";
  if (/社交|微信|slack|social|twitter|discord/.test(t)) return "social";
  if (/会议|开会|meeting|zoom|call/.test(t)) return "meeting";
  if (/休息|放松|break|rest/.test(t)) return "break";
  return "writing";
}

const COLOR_WORDS: [RegExp, ModeConfig["color"]][] = [
  [/橙|琥珀|amber|orange/i, "amber"],
  [/蓝|blue/i, "blue"],
  [/紫|violet|purple/i, "violet"],
  [/青|teal|cyan/i, "teal"],
  [/玫瑰|粉红|rose/i, "rose"],
  [/粉|pink/i, "pink"],
  [/绿|lime|green/i, "lime"],
  [/灰|slate|gray|grey/i, "slate"],
];

function findModeByName(modes: Mode[], raw: string): Mode | null {
  const needle = raw.trim().toLowerCase();
  return (
    modes.find((m) => m.id === needle) ??
    modes.find((m) => m.name.toLowerCase() === needle) ??
    modes.find((m) => m.name.toLowerCase().includes(needle)) ??
    null
  );
}

function extractCreateName(prompt: string): string | null {
  const zh = prompt.match(
    /(?:新增|添加|创建|新建)\s*(?:一个|个|一款)?\s*["“'「]?([一-龥A-Za-z0-9][一-龥A-Za-z0-9 _-]{0,28}?)["”'」]?\s*(?:模式|mode)/i,
  );
  if (zh?.[1]) return zh[1].trim();
  const en = prompt.match(
    /(?:add|create|new|make)\s+(?:a|an)?\s*["“']?([A-Za-z0-9][A-Za-z0-9 _-]{0,28}?)["”']?\s+mode/i,
  );
  if (en?.[1]) return en[1].trim();
  return null;
}

export function rulesProposal(prompt: string, modes: Mode[]): { summary: string; patch: ProposalPatchOp[] } {
  const text = prompt.trim();
  if (text.length < 3) throw new ProposalError("prompt_too_short", "Describe the mode change you want.");
  if (text.length > 2000) throw new ProposalError("prompt_too_long", "Keep the request under 2000 characters.");

  const createName = extractCreateName(text);
  if (createName) {
    const domain = detectDomain(text);
    const template = DOMAIN_TEMPLATES[domain]!;
    const baseId = createName
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 28);
    let id = baseId || `mode-${Date.now().toString(36).slice(-5)}`;
    let n = 2;
    const existingIds = new Set(modes.map((m) => m.id));
    while (existingIds.has(id)) {
      id = `${baseId}-${n}`;
      n += 1;
    }
    const existingNames = new Set(modes.map((m) => m.name.toLowerCase()));
    let name = createName.replace(/模式$/, "").trim();
    name = name.charAt(0).toUpperCase() + name.slice(1);
    if (existingNames.has(name.toLowerCase())) name = `${name} ${n}`;
    const deferSocial = /社交|social|slack|微信/.test(text) && /延后|推迟|defer|hold|later|稍后/.test(text);
    const config: ModeConfig = {
      name,
      color: template.color,
      icon: template.icon,
      pinned_items: template.apps.map((label, index) => ({
        id: `${id}-${index}`,
        label,
        icon: ["◈", "▣", "🌐"][index] ?? "◎",
        kind: template.urls[index] ? "bookmark" : "app",
        ...(template.urls[index] ? { url: template.urls[index]! } : {}),
      })),
      activity_app_allowlist: template.bundles,
      keywords: [name.toLowerCase(), ...template.keywords],
      transition: {
        manual_immediate: true,
        auto_suggest_only: true,
        dwell_seconds: 15,
        cooldown_seconds: 60,
      },
      notifications: {
        default: deferSocial ? "defer" : "defer",
        time_sensitive: "show",
        switch_wait_seconds: 30,
        social_switch_enabled: deferSocial,
      },
      sort_order: modes.length,
    };
    return {
      summary: `Create a ${name} mode with ${template.apps.join(", ")} pinned${deferSocial ? " and social messages deferred" : ""}.`,
      patch: [{ op: "add", path: `/modes/${id}`, value: config }],
    };
  }

  const stripArticle = (value: string) =>
    value.replace(/^(the|a|an|这个|那个)\s+/i, "").trim();

  const deleteMatch = text.match(
    /(?:删除|移除|delete|remove)\s*["“']?([一-龥A-Za-z0-9 _-]{1,30})["”']?\s*(?:模式|mode)?/i,
  );
  if (deleteMatch?.[1]) {
    const mode = findModeByName(modes, stripArticle(deleteMatch[1]));
    if (!mode) throw new ProposalError("mode_missing", `No mode named "${deleteMatch[1]}".`);
    return {
      summary: `Delete the ${mode.name} mode.`,
      patch: [{ op: "remove", path: `/modes/${mode.id}` }],
    };
  }

  const rename = text.match(
    /(?:重命名|改名|rename)\s*["“']?([一-龥A-Za-z0-9 _-]{1,30})["”']?\s*(?:为|to|as)\s*["“']?([一-龥A-Za-z0-9 _-]{1,30})["”']?/i,
  );
  if (rename?.[1] && rename[2]) {
    const mode = findModeByName(modes, stripArticle(rename[1]));
    if (!mode) throw new ProposalError("mode_missing", `No mode named "${rename[1]}".`);
    return {
      summary: `Rename ${mode.name} to ${rename[2]}.`,
      patch: [{ op: "replace", path: `/modes/${mode.id}/name`, value: stripArticle(rename[2]) }],
    };
  }

  // Any remaining request is an edit. Identify the target by the mode's own
  // name appearing in the text (longest first), which handles possessives
  // like "Writing's switch wait" without brittle word-order regexes.
  const lower = text.toLowerCase();
  const targetMode =
    [...modes]
      .sort((a, b) => b.name.length - a.name.length)
      .find((mode) => lower.includes(mode.name.toLowerCase())) ?? null;

  if (targetMode) {
    const waitMatch = text.match(
      /(?:wait|countdown|cool-?down|等待|冷静|冷却)[^0-9]{0,16}(\d{1,3})/i,
    );
    if (waitMatch?.[1]) {
      const seconds = Number(waitMatch[1]);
      return {
        summary: `Set ${targetMode.name}'s switch wait to ${seconds}s.`,
        patch: [
          {
            op: "replace",
            path: `/modes/${targetMode.id}/notifications/switch_wait_seconds`,
            value: seconds,
          },
        ],
      };
    }

    const dwellMatch = text.match(/(?:dwell|停留)[^0-9]{0,16}(\d{1,3})/i);
    if (dwellMatch?.[1]) {
      const seconds = Number(dwellMatch[1]);
      return {
        summary: `Set ${targetMode.name}'s dwell time to ${seconds}s.`,
        patch: [
          {
            op: "replace",
            path: `/modes/${targetMode.id}/transition/dwell_seconds`,
            value: seconds,
          },
        ],
      };
    }

    for (const [re, color] of COLOR_WORDS) {
      if (!re.test(text)) continue;
      return {
        summary: `Set ${targetMode.name}'s color to ${color}.`,
        patch: [{ op: "replace", path: `/modes/${targetMode.id}/color`, value: color }],
      };
    }

    if (/(notification|通知)/i.test(text)) {
      if (/延后|推迟|defer|hold|later/i.test(text)) {
        return {
          summary: `Defer non-urgent notifications in ${targetMode.name}.`,
          patch: [
            { op: "replace", path: `/modes/${targetMode.id}/notifications/default`, value: "defer" },
          ],
        };
      }
      if (/忽略|屏蔽|静音|ignore|mute/i.test(text)) {
        return {
          summary: `Ignore non-urgent notifications in ${targetMode.name}.`,
          patch: [
            { op: "replace", path: `/modes/${targetMode.id}/notifications/default`, value: "ignore" },
          ],
        };
      }
      if (/显示|放行|show|allow/i.test(text)) {
        return {
          summary: `Show non-urgent notifications in ${targetMode.name}.`,
          patch: [
            { op: "replace", path: `/modes/${targetMode.id}/notifications/default`, value: "show" },
          ],
        };
      }
    }

    if (/(auto|自动).*(switch|切换)|switch automatically/i.test(text)) {
      return {
        summary: `Allow ${targetMode.name} to switch automatically after the dwell time.`,
        patch: [
          {
            op: "replace",
            path: `/modes/${targetMode.id}/transition/auto_suggest_only`,
            value: false,
          },
        ],
      };
    }
  }

  throw new ProposalError(
    "unsupported_request",
    "The offline rules parser only supports: create mode, delete mode, rename mode, change color, change switch wait, change dwell time, and change notification policy. Configure a local model for freer requests.",
  );
}
