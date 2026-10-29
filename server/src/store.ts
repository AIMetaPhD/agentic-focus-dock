import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  modeInputSchema,
  settingsSchema,
  type ActivityEvent,
  type Classification,
  type EventKind,
  type Mode,
  type ModeConfig,
  type ModeVersion,
  type PendingNotification,
  type Proposal,
  type ProposalDiffEntry,
  type ProposalPatchOp,
  type Settings,
} from "./domain/schemas";
import { DEFAULT_MODES } from "./domain/defaults";

const now = () => new Date().toISOString();

export type RuntimeState = {
  active_mode: string;
  manual_lock: boolean;
  last_suggestion_at: string | null;
  last_suggested_mode: string | null;
};

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || `mode-${Date.now().toString(36).slice(-6)}`;
}

type ModeRow = {
  id: string;
  name: string;
  version: number;
  color: string;
  icon: string;
  pinned_items: string;
  activity_app_allowlist: string;
  keywords: string;
  transition: string;
  notifications: string;
  is_builtin: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function rowToMode(row: ModeRow): Mode {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    color: row.color as Mode["color"],
    icon: row.icon,
    pinned_items: parseJson(row.pinned_items, []),
    activity_app_allowlist: parseJson(row.activity_app_allowlist, []),
    keywords: parseJson(row.keywords, []),
    transition: parseJson(row.transition, {
      manual_immediate: true,
      auto_suggest_only: true,
      dwell_seconds: 15,
      cooldown_seconds: 60,
    }),
    notifications: parseJson(row.notifications, {
      default: "defer",
      time_sensitive: "show",
      switch_wait_seconds: 30,
      social_switch_enabled: true,
    }),
    sort_order: row.sort_order,
    is_builtin: row.is_builtin === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function modeToConfig(mode: Mode): ModeConfig {
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

const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS modes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version INTEGER NOT NULL,
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        pinned_items TEXT NOT NULL,
        activity_app_allowlist TEXT NOT NULL,
        keywords TEXT NOT NULL,
        transition TEXT NOT NULL,
        notifications TEXT NOT NULL,
        is_builtin INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS mode_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mode_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        snapshot TEXT NOT NULL,
        source TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_mode_versions_mode ON mode_versions(mode_id, version);
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        source TEXT NOT NULL,
        source_app TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        payload_level TEXT NOT NULL,
        payload TEXT NOT NULL,
        classification TEXT NOT NULL,
        actual_action TEXT NOT NULL,
        dedupe_key TEXT,
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedupe ON events(dedupe_key) WHERE dedupe_key IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        mode_id TEXT NOT NULL,
        status TEXT NOT NULL,
        wait_seconds INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        ready_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status, created_at);
      CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        source TEXT NOT NULL,
        prompt TEXT NOT NULL,
        summary TEXT NOT NULL,
        patch TEXT NOT NULL,
        diff TEXT NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        applied_at TEXT,
        applied_mode_ids TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT NOT NULL,
        detail TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts);
    `,
  },
];

export class Store {
  readonly db: DatabaseSync;
  readonly file: string;

  constructor(file: string) {
    this.file = file;
    if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;");
    this.migrate();
    this.seedIfEmpty();
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
    );
    const applied = new Set(
      this.db.prepare("SELECT version FROM schema_migrations").all().map((r) => Number(r.version)),
    );
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue;
      this.db.exec("BEGIN");
      try {
        this.db.exec(migration.sql);
        this.db
          .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
          .run(migration.version, now());
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    }
  }

  private seedIfEmpty(): void {
    const row = this.db.prepare("SELECT COUNT(*) AS n FROM modes").get() as { n: number };
    if (Number(row.n) > 0) return;
    for (const seed of DEFAULT_MODES) {
      const config = modeInputSchema.parse(seed);
      const ts = now();
      this.db
        .prepare(
          `INSERT INTO modes (id, name, version, color, icon, pinned_items, activity_app_allowlist, keywords, transition, notifications, is_builtin, sort_order, created_at, updated_at)
           VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        )
        .run(
          seed.id,
          config.name,
          config.color,
          config.icon,
          JSON.stringify(config.pinned_items),
          JSON.stringify(config.activity_app_allowlist),
          JSON.stringify(config.keywords),
          JSON.stringify(config.transition),
          JSON.stringify(config.notifications),
          config.sort_order,
          ts,
          ts,
        );
      this.db
        .prepare(
          "INSERT INTO mode_versions (mode_id, version, snapshot, source, note, created_at) VALUES (?, 1, ?, 'seed', 'built-in default', ?)",
        )
        .run(seed.id, JSON.stringify(config), ts);
    }
    this.audit("system", "seed", "modes", { count: DEFAULT_MODES.length });
  }

  // ---------- modes ----------

  listModes(): Mode[] {
    const rows = this.db.prepare("SELECT * FROM modes ORDER BY sort_order ASC, name ASC").all() as ModeRow[];
    return rows.map(rowToMode);
  }

  getMode(id: string): Mode | null {
    const row = this.db.prepare("SELECT * FROM modes WHERE id = ?").get(id) as ModeRow | undefined;
    return row ? rowToMode(row) : null;
  }

  private uniqueId(name: string): string {
    const base = slugify(name);
    let candidate = base;
    let i = 2;
    while (this.getMode(candidate)) {
      candidate = `${base}-${i}`;
      i += 1;
    }
    return candidate;
  }

  createMode(input: unknown, opts: { id?: string; is_builtin?: boolean; source?: string } = {}): Mode {
    const config = modeInputSchema.parse(input);
    const id = opts.id ?? this.uniqueId(config.name);
    if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(id)) throw new Error("invalid mode id");
    if (this.getMode(id)) throw new Error(`mode ${id} already exists`);
    const ts = now();
    this.db
      .prepare(
        `INSERT INTO modes (id, name, version, color, icon, pinned_items, activity_app_allowlist, keywords, transition, notifications, is_builtin, sort_order, created_at, updated_at)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        config.name,
        config.color,
        config.icon,
        JSON.stringify(config.pinned_items),
        JSON.stringify(config.activity_app_allowlist),
        JSON.stringify(config.keywords),
        JSON.stringify(config.transition),
        JSON.stringify(config.notifications),
        opts.is_builtin ? 1 : 0,
        config.sort_order,
        ts,
        ts,
      );
    const mode = this.getMode(id)!;
    this.recordVersion(mode, opts.source ?? "manual", "created");
    this.audit("user", "mode.create", id, { name: mode.name });
    return mode;
  }

  updateMode(id: string, input: unknown, source = "manual"): Mode {
    const existing = this.getMode(id);
    if (!existing) throw new Error("mode not found");
    const config = modeInputSchema.parse({ ...modeToConfig(existing), ...(input as object) });
    const ts = now();
    this.db
      .prepare(
        `UPDATE modes SET name = ?, version = ?, color = ?, icon = ?, pinned_items = ?, activity_app_allowlist = ?, keywords = ?, transition = ?, notifications = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        config.name,
        existing.version + 1,
        config.color,
        config.icon,
        JSON.stringify(config.pinned_items),
        JSON.stringify(config.activity_app_allowlist),
        JSON.stringify(config.keywords),
        JSON.stringify(config.transition),
        JSON.stringify(config.notifications),
        config.sort_order,
        ts,
        id,
      );
    const mode = this.getMode(id)!;
    this.recordVersion(mode, source, "updated");
    this.audit("user", "mode.update", id, { from_version: existing.version, to_version: mode.version });
    return mode;
  }

  replaceModeConfig(id: string, config: ModeConfig, source: string, note: string): Mode {
    const existing = this.getMode(id);
    if (!existing) throw new Error("mode not found");
    const parsed = modeInputSchema.parse(config);
    const ts = now();
    this.db
      .prepare(
        `UPDATE modes SET name = ?, version = ?, color = ?, icon = ?, pinned_items = ?, activity_app_allowlist = ?, keywords = ?, transition = ?, notifications = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        parsed.name,
        existing.version + 1,
        parsed.color,
        parsed.icon,
        JSON.stringify(parsed.pinned_items),
        JSON.stringify(parsed.activity_app_allowlist),
        JSON.stringify(parsed.keywords),
        JSON.stringify(parsed.transition),
        JSON.stringify(parsed.notifications),
        parsed.sort_order,
        ts,
        id,
      );
    const mode = this.getMode(id)!;
    this.recordVersion(mode, source, note);
    return mode;
  }

  deleteMode(id: string): boolean {
    const existing = this.getMode(id);
    if (!existing) return false;
    const count = this.db.prepare("SELECT COUNT(*) AS n FROM modes").get() as { n: number };
    if (Number(count.n) <= 1) throw new Error("cannot delete the last mode");
    this.db.prepare("DELETE FROM modes WHERE id = ?").run(id);
    this.audit("user", "mode.delete", id, { name: existing.name });
    return true;
  }

  reorderModes(ids: string[]): Mode[] {
    const existing = new Set(this.listModes().map((m) => m.id));
    const clean = ids.filter((id) => existing.has(id));
    this.db.exec("BEGIN");
    try {
      clean.forEach((id, index) => {
        this.db.prepare("UPDATE modes SET sort_order = ?, updated_at = ? WHERE id = ?").run(index, now(), id);
      });
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    this.audit("user", "mode.reorder", "modes", { ids: clean });
    return this.listModes();
  }

  restoreDefaults(): Mode[] {
    for (const seed of DEFAULT_MODES) {
      const existing = this.getMode(seed.id);
      const config = modeInputSchema.parse(seed);
      if (!existing) {
        this.createMode(config, { id: seed.id, is_builtin: true, source: "restore" });
      } else if (
        existing.is_builtin &&
        JSON.stringify(modeToConfig(existing)) !== JSON.stringify(config)
      ) {
        this.replaceModeConfig(seed.id, config, "restore", "restored built-in default");
      }
    }
    this.audit("user", "modes.restore_defaults", "modes", {});
    return this.listModes();
  }

  recordVersion(mode: Mode, source: string, note: string): void {
    this.db
      .prepare(
        "INSERT INTO mode_versions (mode_id, version, snapshot, source, note, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(mode.id, mode.version, JSON.stringify(modeToConfig(mode)), source, note, now());
  }

  listVersions(id: string): ModeVersion[] {
    const rows = this.db
      .prepare("SELECT * FROM mode_versions WHERE mode_id = ? ORDER BY version DESC, id DESC")
      .all(id) as {
      id: number;
      mode_id: string;
      version: number;
      snapshot: string;
      source: string;
      note: string | null;
      created_at: string;
    }[];
    return rows.map((r) => ({
      id: r.id,
      mode_id: r.mode_id,
      version: r.version,
      snapshot: parseJson(r.snapshot, {} as ModeConfig),
      source: r.source,
      note: r.note,
      created_at: r.created_at,
    }));
  }

  rollbackMode(id: string, version: number): Mode {
    const rows = this.db
      .prepare("SELECT snapshot FROM mode_versions WHERE mode_id = ? AND version = ? ORDER BY id DESC LIMIT 1")
      .all(id, version) as { snapshot: string }[];
    const row = rows[0];
    if (!row) throw new Error("version not found");
    const snapshot = modeInputSchema.parse(JSON.parse(row.snapshot));
    const mode = this.replaceModeConfig(id, snapshot, "rollback", `rolled back to v${version}`);
    this.audit("user", "mode.rollback", id, { target_version: version, new_version: mode.version });
    return mode;
  }

  // ---------- events ----------

  insertEvent(input: {
    kind: EventKind;
    source: ActivityEvent["source"];
    source_app: string;
    timestamp?: string;
    payload: ActivityEvent["payload"];
    classification: Classification;
    actual_action: ActivityEvent["actual_action"];
    dedupe_key?: string;
  }): { event: ActivityEvent; duplicate: boolean } {
    if (input.dedupe_key) {
      const existing = this.db.prepare("SELECT * FROM events WHERE dedupe_key = ?").get(input.dedupe_key);
      if (existing) {
        return { event: this.rowToEvent(existing as never), duplicate: true };
      }
    }
    const id = `evt_${crypto.randomUUID()}`;
    const ts = input.timestamp ?? now();
    const created = now();
    const payload_level =
      input.payload.title || input.payload.body ? "content" : "metadata_only";
    this.db
      .prepare(
        `INSERT INTO events (id, kind, source, source_app, timestamp, payload_level, payload, classification, actual_action, dedupe_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.kind,
        input.source,
        input.source_app,
        ts,
        payload_level,
        JSON.stringify(input.payload),
        JSON.stringify(input.classification),
        input.actual_action,
        input.dedupe_key ?? null,
        created,
      );
    return { event: this.getEvent(id)!, duplicate: false };
  }

  private rowToEvent(row: Record<string, unknown>): ActivityEvent {
    return {
      id: String(row.id),
      kind: row.kind as EventKind,
      source: row.source as ActivityEvent["source"],
      source_app: String(row.source_app),
      timestamp: String(row.timestamp),
      payload_level: row.payload_level as "metadata_only" | "content",
      payload: parseJson(row.payload, {}),
      classification: parseJson(row.classification, {} as Classification),
      actual_action: row.actual_action as ActivityEvent["actual_action"],
      created_at: String(row.created_at),
    };
  }

  getEvent(id: string): ActivityEvent | null {
    const row = this.db.prepare("SELECT * FROM events WHERE id = ?").get(id);
    return row ? this.rowToEvent(row as never) : null;
  }

  listEvents(limit = 100, kind?: EventKind): ActivityEvent[] {
    const rows = kind
      ? this.db.prepare("SELECT * FROM events WHERE kind = ? ORDER BY created_at DESC LIMIT ?").all(kind, limit)
      : this.db.prepare("SELECT * FROM events ORDER BY created_at DESC LIMIT ?").all(limit);
    return (rows as never[]).map((r) => this.rowToEvent(r));
  }

  countEvents(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number };
    return Number(row.n);
  }

  // ---------- notifications ----------

  createNotification(eventId: string, modeId: string, waitSeconds: number): PendingNotification {
    const id = `ntf_${crypto.randomUUID()}`;
    const ts = now();
    const ready = new Date(Date.now() + Math.max(0, waitSeconds) * 1000).toISOString();
    this.db
      .prepare(
        "INSERT INTO notifications (id, event_id, mode_id, status, wait_seconds, created_at, ready_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)",
      )
      .run(id, eventId, modeId, waitSeconds, ts, ready, ts);
    return this.getNotification(id)!;
  }

  getNotification(id: string): PendingNotification | null {
    const row = this.db.prepare("SELECT * FROM notifications WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    return {
      id: String(row.id),
      event_id: String(row.event_id),
      mode_id: String(row.mode_id),
      status: row.status as PendingNotification["status"],
      wait_seconds: Number(row.wait_seconds),
      created_at: String(row.created_at),
      ready_at: String(row.ready_at),
      updated_at: String(row.updated_at),
      event: this.getEvent(String(row.event_id)) ?? undefined,
    };
  }

  listNotifications(status?: string): PendingNotification[] {
    const rows = status
      ? this.db.prepare("SELECT * FROM notifications WHERE status = ? ORDER BY created_at DESC").all(status)
      : this.db.prepare("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100").all();
    return (rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      event_id: String(row.event_id),
      mode_id: String(row.mode_id),
      status: row.status as PendingNotification["status"],
      wait_seconds: Number(row.wait_seconds),
      created_at: String(row.created_at),
      ready_at: String(row.ready_at),
      updated_at: String(row.updated_at),
      event: this.getEvent(String(row.event_id)) ?? undefined,
    }));
  }

  decideNotification(
    id: string,
    status: Exclude<PendingNotification["status"], "pending">,
  ): PendingNotification {
    const existing = this.getNotification(id);
    if (!existing) throw new Error("notification not found");
    this.db
      .prepare("UPDATE notifications SET status = ?, updated_at = ? WHERE id = ?")
      .run(status, now(), id);
    this.audit("user", "notification.decision", id, { status });
    return this.getNotification(id)!;
  }

  // ---------- proposals ----------

  createProposal(input: {
    source: Proposal["source"];
    prompt: string;
    summary: string;
    patch: ProposalPatchOp[];
    diff: ProposalDiffEntry[];
    status?: Proposal["status"];
    error?: string | null;
  }): Proposal {
    const id = `prop_${crypto.randomUUID()}`;
    const ts = now();
    this.db
      .prepare(
        `INSERT INTO proposals (id, created_at, source, prompt, summary, patch, diff, status, error, applied_at, applied_mode_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, '[]')`,
      )
      .run(
        id,
        ts,
        input.source,
        input.prompt,
        input.summary,
        JSON.stringify(input.patch),
        JSON.stringify(input.diff),
        input.status ?? "proposed",
        input.error ?? null,
      );
    return this.getProposal(id)!;
  }

  getProposal(id: string): Proposal | null {
    const row = this.db.prepare("SELECT * FROM proposals WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.rowToProposal(row) : null;
  }

  private rowToProposal(row: Record<string, unknown>): Proposal {
    return {
      id: String(row.id),
      created_at: String(row.created_at),
      source: row.source as Proposal["source"],
      prompt: String(row.prompt),
      summary: String(row.summary),
      patch: parseJson(row.patch, []),
      diff: parseJson(row.diff, []),
      status: row.status as Proposal["status"],
      error: row.error ? String(row.error) : null,
      applied_at: row.applied_at ? String(row.applied_at) : null,
      applied_mode_ids: parseJson(row.applied_mode_ids, []),
    };
  }

  listProposals(limit = 30): Proposal[] {
    const rows = this.db
      .prepare("SELECT * FROM proposals ORDER BY created_at DESC LIMIT ?")
      .all(limit) as Record<string, unknown>[];
    return rows.map((r) => this.rowToProposal(r));
  }

  markProposal(
    id: string,
    status: Proposal["status"],
    appliedModeIds: string[] = [],
    error: string | null = null,
  ): Proposal {
    this.db
      .prepare("UPDATE proposals SET status = ?, applied_at = ?, applied_mode_ids = ?, error = ? WHERE id = ?")
      .run(status, status === "applied" ? now() : null, JSON.stringify(appliedModeIds), error, id);
    return this.getProposal(id)!;
  }

  // ---------- runtime state ----------

  getRuntime(): RuntimeState {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = 'runtime'").get() as
      | { value: string }
      | undefined;
    const stored = row ? parseJson<Record<string, unknown>>(row.value, {}) : {};
    const modes = this.listModes();
    const fallback = modes[0]?.id ?? "writing";
    const active = typeof stored.active_mode === "string" ? stored.active_mode : fallback;
    return {
      active_mode: this.getMode(active) ? active : fallback,
      manual_lock: Boolean(stored.manual_lock),
      last_suggestion_at:
        typeof stored.last_suggestion_at === "string" ? stored.last_suggestion_at : null,
      last_suggested_mode:
        typeof stored.last_suggested_mode === "string" ? stored.last_suggested_mode : null,
    };
  }

  setRuntime(patch: Partial<RuntimeState>): RuntimeState {
    const next = { ...this.getRuntime(), ...patch };
    this.db
      .prepare(
        "INSERT INTO settings (key, value) VALUES ('runtime', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(JSON.stringify(next));
    return next;
  }

  // ---------- settings ----------

  getSettings(): Settings {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = 'app'").get() as
      | { value: string }
      | undefined;
    const stored = row ? parseJson(row.value, {}) : {};
    return settingsSchema.parse(stored);
  }

  updateSettings(patch: unknown): Settings {
    const current = this.getSettings();
    const next = settingsSchema.parse({ ...current, ...(patch as object) });
    this.db
      .prepare("INSERT INTO settings (key, value) VALUES ('app', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(JSON.stringify(next));
    this.audit("user", "settings.update", "app", next);
    return next;
  }

  // ---------- audit ----------

  audit(actor: string, action: string, target: string, detail: unknown): void {
    this.db
      .prepare("INSERT INTO audit_log (ts, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)")
      .run(now(), actor, action, target, JSON.stringify(detail));
    this.db.exec(
      "DELETE FROM audit_log WHERE id NOT IN (SELECT id FROM audit_log ORDER BY id DESC LIMIT 2000)",
    );
  }

  listAudit(limit = 100): {
    id: number;
    ts: string;
    actor: string;
    action: string;
    target: string;
    detail: unknown;
  }[] {
    const rows = this.db
      .prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?")
      .all(limit) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: Number(r.id),
      ts: String(r.ts),
      actor: String(r.actor),
      action: String(r.action),
      target: String(r.target),
      detail: parseJson(r.detail, {}),
    }));
  }

  // ---------- data lifecycle ----------

  prune(retentionDays: number): number {
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
    this.db.exec("BEGIN");
    try {
      this.db
        .prepare("DELETE FROM notifications WHERE event_id IN (SELECT id FROM events WHERE created_at < ?)")
        .run(cutoff);
      const result = this.db.prepare("DELETE FROM events WHERE created_at < ?").run(cutoff);
      this.db.exec("COMMIT");
      const changes = Number(result.changes ?? 0);
      if (changes > 0) this.audit("system", "retention.prune", "events", { deleted: changes, cutoff });
      return changes;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  exportData(): unknown {
    return {
      format: "focusdock-export",
      version: 1,
      exported_at: now(),
      modes: this.listModes().map((m) => ({ ...modeToConfig(m), id: m.id, is_builtin: m.is_builtin })),
      settings: this.getSettings(),
    };
  }

  clearEvents(): number {
    const result = this.db.prepare("DELETE FROM events").run();
    this.db.prepare("DELETE FROM notifications").run();
    this.audit("user", "data.clear_events", "events", { deleted: Number(result.changes ?? 0) });
    return Number(result.changes ?? 0);
  }

  resetAll(): void {
    this.db.exec("BEGIN");
    try {
      this.db.exec("DELETE FROM notifications; DELETE FROM events; DELETE FROM proposals; DELETE FROM mode_versions; DELETE FROM modes; DELETE FROM settings; DELETE FROM audit_log;");
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    this.seedIfEmpty();
    this.audit("user", "data.reset", "all", {});
  }
}

export function openStore(file: string): Store {
  return new Store(file);
}

export { modeToConfig };
