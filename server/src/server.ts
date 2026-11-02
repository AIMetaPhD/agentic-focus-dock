import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";
import { WebSocketServer, type WebSocket } from "ws";
import { z, ZodError } from "zod";
import { APP_VERSION, PROTOCOL_VERSION, isAllowedHost, isAllowedOrigin } from "./config";
import { Store, type RuntimeState } from "./store";
import {
  CSRF_HEADER,
  RateLimiter,
  SessionManager,
  checkHost,
  checkOrigin,
  parseCookies,
  removeSecretFile,
  sessionFromRequest,
  setSessionCookies,
  timingSafeEqual,
  writeSecretFile,
  SESSION_COOKIE,
} from "./security";
import {
  activityInputSchema,
  aiSettingsPatchSchema,
  modeInputSchema,
  notificationInputSchema,
  privacySettingsPatchSchema,
  type ActivityEvent,
  type Classification,
  type Mode,
  type PendingNotification,
  type Settings,
} from "./domain/schemas";
import { actualActionFor, classifyActivity, classifyNotification } from "./domain/rules";
import {
  ProposalError,
  applyOps,
  computeDiff,
  validatePatch,
} from "./domain/proposals";
import { proposeWithProvider } from "./ai/providers";
import { hasApiKey, readApiKey, writeApiKey } from "./secrets";

export type BridgeStatus = {
  connected: boolean;
  last_seen: string | null;
  bridge_version: string | null;
  capabilities: Record<string, string> | null;
  token_path: string;
};

export type Ctx = {
  store: Store;
  dataDir: string;
  webDist: string;
  port: number;
  sessions: SessionManager;
  bridgeToken: string;
  bridgeTokenPath: string;
  bridge: BridgeStatus;
  limiter: RateLimiter;
  hub: Hub;
};

class Hub {
  private clients = new Set<WebSocket>();

  add(socket: WebSocket): void {
    this.clients.add(socket);
    socket.on("close", () => this.clients.delete(socket));
    socket.on("error", () => this.clients.delete(socket));
  }

  broadcast(type: string, data: unknown): void {
    const message = JSON.stringify({ type, data, at: new Date().toISOString() });
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) client.send(message);
    }
  }
}

const nowIso = () => new Date().toISOString();

function fail(reply: FastifyReply, status: number, code: string, message: string): FastifyReply {
  return reply.code(status).send({ error: code, message });
}

function ensureSession(ctx: Ctx, request: FastifyRequest, reply: FastifyReply): void {
  const existing = sessionFromRequest(request, ctx.sessions);
  if (existing) return;
  setSessionCookies(reply, ctx.sessions.issue());
}

function isMutating(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function bridgeAuthorized(ctx: Ctx, request: FastifyRequest): boolean {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return false;
  return timingSafeEqual(header.slice("Bearer ".length).trim(), ctx.bridgeToken);
}

function bridgeIsFresh(ctx: Ctx): boolean {
  if (!ctx.bridge.last_seen) return false;
  return Date.now() - Date.parse(ctx.bridge.last_seen) < 25_000;
}

const SOCIAL_NATIVE_HINTS = [
  "slack",
  "discord",
  "twitter",
  "wechat",
  "微信",
  "instagram",
  "messages",
  "teams",
];

function isSocialNativeLabel(label: string | undefined): boolean {
  const value = (label ?? "").toLowerCase().trim();
  if (!value) return false;
  if (value === "x" || value.startsWith("x ") || value.endsWith(" x")) return true;
  return SOCIAL_NATIVE_HINTS.some((hint) => value.includes(hint));
}

async function nativeControlRequest(
  ctx: Ctx,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const base = process.env.FOCUSDOCK_NATIVE_COMPANION_URL || "http://127.0.0.1:4318";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${ctx.bridgeToken}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { message: text };
      }
    }
    return { status: response.status, body: parsed };
  } finally {
    clearTimeout(timer);
  }
}

async function nativeControlBinary(
  ctx: Ctx,
  path: string,
): Promise<{ status: number; body: Buffer }> {
  const base = process.env.FOCUSDOCK_NATIVE_COMPANION_URL || "http://127.0.0.1:4318";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${base}${path}`, {
      headers: { authorization: `Bearer ${ctx.bridgeToken}` },
      signal: controller.signal,
    });
    const body = Buffer.from(await response.arrayBuffer());
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function publicSettings(settings: Settings, dataDir: string): unknown {
  return {
    ...settings,
    ai: { ...settings.ai, has_api_key: hasApiKey(dataDir) },
    data_dir: dataDir,
  };
}

function capabilities(ctx: Ctx): unknown {
  const settings = ctx.store.getSettings();
  return {
    protocol: PROTOCOL_VERSION,
    version: APP_VERSION,
    platform: process.platform,
    web: {
      modes: true,
      rules_engine: true,
      ai_proposals: true,
      realtime: true,
      activity_detection: "browser-local only",
    },
    bridge: {
      available: process.platform === "darwin" || process.platform === "win32",
      status: bridgeIsFresh(ctx) ? "connected" : "not_connected",
      last_seen: ctx.bridge.last_seen,
      capabilities: ctx.bridge.capabilities,
      note:
        process.platform === "darwin"
          ? "Optional Swift companion. Not required for the web app."
          : process.platform === "win32"
            ? "Optional Windows companion: foreground events and allowlisted launch; no notification interception."
            : "No native companion for this platform.",
    },
    system_notifications: {
      supported: false,
      reason:
        "Public APIs expose only the app's own notifications; Windows notification reading is not implemented. FocusDock never reads private databases or injects into other apps.",
    },
    accessibility: {
      status: ctx.bridge.capabilities?.accessibility ?? "not_connected",
      note:
        process.platform === "darwin"
          ? "Optional. Without it the bridge reports bundle ids only."
          : "macOS-only capability; not used on Windows.",
    },
    cloud_ai: {
      provider: settings.ai.provider,
      opt_in: settings.ai.cloud_opt_in,
    },
    labels: ["simulated", "product-owned", "connected-official"],
  };
}

function activeMode(store: Store): Mode {
  const modes = store.listModes();
  const runtime = store.getRuntime();
  return store.getMode(runtime.active_mode) ?? modes[0]!;
}

function recordSuggestion(store: Store, classification: Classification): RuntimeState {
  if (classification.decision === "suggest_switch" || classification.decision === "auto_switch") {
    return store.setRuntime({
      last_suggestion_at: nowIso(),
      last_suggested_mode: classification.suggested_mode ?? null,
    });
  }
  return store.getRuntime();
}

function ingestActivity(
  ctx: Ctx,
  input: z.infer<typeof activityInputSchema>,
  sourceOverride?: ActivityEvent["source"],
): ActivityEvent {
  const mode = activeMode(ctx.store);
  const runtime = ctx.store.getRuntime();
  const classification = classifyActivity(input, mode, ctx.store.listModes(), runtime);
  const { event, duplicate } = ctx.store.insertEvent({
    kind: "activity",
    source: sourceOverride ?? input.source,
    source_app: input.source_app,
    timestamp: input.timestamp,
    payload: input.payload,
    classification,
    actual_action: actualActionFor(classification),
    dedupe_key: input.dedupe_key,
  });
  if (duplicate) return event;

  if (classification.decision === "auto_switch" && classification.suggested_mode) {
    const target = ctx.store.getMode(classification.suggested_mode);
    if (target) {
      ctx.store.setRuntime({ active_mode: target.id, manual_lock: false });
      ctx.store.audit("rules", "mode.auto_switch", target.id, { event: event.id });
      ctx.hub.broadcast("mode.changed", { mode: target.id, runtime: ctx.store.getRuntime() });
    }
  } else {
    recordSuggestion(ctx.store, classification);
  }
  ctx.hub.broadcast("event.created", event);
  return event;
}

function ingestNotification(
  ctx: Ctx,
  input: z.infer<typeof notificationInputSchema>,
  sourceOverride?: ActivityEvent["source"],
): { event: ActivityEvent; notification: PendingNotification | null } {
  const mode = activeMode(ctx.store);
  const classification = classifyNotification(input, mode, ctx.store.listModes());
  const { event, duplicate } = ctx.store.insertEvent({
    kind: "notification",
    source: sourceOverride ?? input.source,
    source_app: input.source_app,
    timestamp: input.timestamp,
    payload: input.payload,
    classification,
    actual_action: actualActionFor(classification),
    dedupe_key: input.dedupe_key,
  });
  if (duplicate) {
    const existing = ctx.store.listNotifications("pending").find((n) => n.event_id === event.id) ?? null;
    return { event, notification: existing };
  }

  let notification: PendingNotification | null = null;
  if (["defer", "show", "time_sensitive"].includes(classification.decision)) {
    const wait = classification.decision === "defer" ? mode.notifications.switch_wait_seconds : 0;
    notification = ctx.store.createNotification(event.id, mode.id, wait);
  }
  ctx.hub.broadcast("event.created", event);
  if (notification) ctx.hub.broadcast("notification.queued", notification);
  return { event, notification };
}

function pendingForDock(store: Store): PendingNotification[] {
  const pending = store.listNotifications("pending");
  return pending.sort((a, b) => {
    const rank = (n: PendingNotification) =>
      n.event?.classification.decision === "time_sensitive" ? 0 : 1;
    const diff = rank(a) - rank(b);
    return diff !== 0 ? diff : b.created_at.localeCompare(a.created_at);
  });
}

export type StartOptions = {
  dataDir: string;
  store: Store;
  webDist: string;
  port: number;
  bridgeToken: string;
  bridgeTokenPath: string;
};

export async function startServer(opts: StartOptions): Promise<{
  app: FastifyInstance;
  ctx: Ctx;
  url: string;
}> {
  const ctx: Ctx = {
    store: opts.store,
    dataDir: opts.dataDir,
    webDist: opts.webDist,
    port: opts.port,
    sessions: new SessionManager(),
    bridgeToken: opts.bridgeToken,
    bridgeTokenPath: opts.bridgeTokenPath,
    bridge: {
      connected: false,
      last_seen: null,
      bridge_version: null,
      capabilities: null,
      token_path: opts.bridgeTokenPath,
    },
    limiter: new RateLimiter(),
    hub: new Hub(),
  };

  const app = Fastify({
    logger: false,
    bodyLimit: 64 * 1024,
    trustProxy: false,
  });

  app.removeContentTypeParser("application/json");
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => {
      const text = String(body ?? "").trim();
      if (!text) return done(null, {});
      try {
        done(null, JSON.parse(text));
      } catch {
        done(Object.assign(new Error("Malformed JSON body."), { statusCode: 400 }), undefined);
      }
    },
  );

  app.addHook("onRequest", async (request, reply) => {
    if (!checkHost(request, ctx.port)) {
      return fail(reply, 421, "bad_host", "Host header is not an allowed loopback host.");
    }

    const pathname = request.url.split("?")[0] ?? "/";
    if (pathname === "/api/health") return;

    if (pathname.startsWith("/api/bridge/")) {
      if (!bridgeAuthorized(ctx, request)) {
        return fail(reply, 401, "bridge_unauthorized", "A valid bridge token is required.");
      }
      if (request.headers.origin) {
        return fail(reply, 403, "bridge_origin", "Native bridge requests must not carry an Origin header.");
      }
      return;
    }

    if (pathname.startsWith("/api/")) {
      const session = sessionFromRequest(request, ctx.sessions);
      if (!session) {
        return fail(reply, 401, "unauthenticated", "Open the app from its local URL to start a session.");
      }
      if (isMutating(request.method)) {
        if (!checkOrigin(request, ctx.port, true)) {
          return fail(reply, 403, "bad_origin", "Origin is not allowed.");
        }
        const csrf = request.headers[CSRF_HEADER];
        if (typeof csrf !== "string" || !timingSafeEqual(csrf, session.csrf)) {
          return fail(reply, 403, "bad_csrf", "Missing or invalid CSRF token.");
        }
        const contentType = request.headers["content-type"] ?? "";
        if (request.body !== undefined && !contentType.includes("application/json")) {
          return fail(reply, 415, "json_required", "Use application/json.");
        }
      }
    }
  });

  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("x-frame-options", "DENY");
    if (String(reply.getHeader("content-type") ?? "").includes("text/html")) {
      reply.header(
        "content-security-policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://127.0.0.1:* ws://localhost:*; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      );
      reply.header("cache-control", "no-store");
    }
    return payload;
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "validation_error",
        message: "Request did not match the schema.",
        issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    if (error instanceof ProposalError) {
      return reply.code(422).send({ error: error.code, message: error.message });
    }
    const err = error as Error & { statusCode?: number };
    const status = err.statusCode ?? 500;
    if (status >= 500) {
      console.error(`[focusdock] ${err.name}: ${err.message}`);
      return reply.code(500).send({ error: "internal_error", message: "The local server hit an error." });
    }
    return reply.code(status).send({ error: "request_error", message: err.message });
  });

  // ---------- static shell ----------

  const serveShell = async (request: FastifyRequest, reply: FastifyReply) => {
    ensureSession(ctx, request, reply);
    const index = path.join(ctx.webDist, "index.html");
    if (!fs.existsSync(index)) {
      return reply
        .code(503)
        .type("text/html")
        .send(
          "<!doctype html><meta charset=utf-8><title>FocusDock</title><body style='font-family:system-ui;background:#0d0f14;color:#e8eaf0;padding:48px'><h1>Web assets are not built</h1><p>Run <code>npm run build</code>, then reload.</p></body>",
        );
    }
    return reply.type("text/html").sendFile("index.html");
  };

  app.get("/", serveShell);
  app.get("/dock", serveShell);

  if (fs.existsSync(ctx.webDist)) {
    await app.register(fastifyStatic, {
      root: ctx.webDist,
      prefix: "/",
      index: false,
      cacheControl: false,
    });
  }

  // ---------- health & state ----------

  app.get("/api/health", async () => ({
    status: "ok",
    version: APP_VERSION,
    protocol: PROTOCOL_VERSION,
    time: nowIso(),
  }));

  app.get("/api/capabilities", async () => capabilities(ctx));

  app.get("/api/state", async () => {
    const runtime = ctx.store.getRuntime();
    const modes = ctx.store.listModes();
    return {
      protocol: PROTOCOL_VERSION,
      version: APP_VERSION,
      modes,
      runtime,
      active_mode: runtime.active_mode,
      pending_notifications: pendingForDock(ctx.store),
      settings: publicSettings(ctx.store.getSettings(), ctx.dataDir),
      bridge: { ...ctx.bridge, connected: bridgeIsFresh(ctx) },
      capabilities: capabilities(ctx),
      counts: { events: ctx.store.countEvents(), modes: modes.length },
    };
  });

  // ---------- modes ----------

  app.get("/api/modes", async () => ctx.store.listModes());

  app.post("/api/modes", async (request, reply) => {
    const mode = ctx.store.createMode(request.body);
    ctx.hub.broadcast("modes.changed", ctx.store.listModes());
    return reply.code(201).send(mode);
  });

  app.get("/api/modes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const mode = ctx.store.getMode(id);
    if (!mode) return fail(reply, 404, "not_found", "Mode not found.");
    return mode;
  });

  app.put("/api/modes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const mode = ctx.store.updateMode(id, request.body);
      ctx.hub.broadcast("modes.changed", ctx.store.listModes());
      return mode;
    } catch (error) {
      if (error instanceof Error && error.message === "mode not found") {
        return fail(reply, 404, "not_found", "Mode not found.");
      }
      throw error;
    }
  });

  app.delete("/api/modes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const runtime = ctx.store.getRuntime();
      const deleted = ctx.store.deleteMode(id);
      if (!deleted) return fail(reply, 404, "not_found", "Mode not found.");
      if (runtime.active_mode === id) {
        const next = ctx.store.listModes()[0];
        if (next) ctx.store.setRuntime({ active_mode: next.id, manual_lock: true });
      }
      ctx.hub.broadcast("modes.changed", ctx.store.listModes());
      return { ok: true };
    } catch (error) {
      if (error instanceof Error && error.message.includes("last mode")) {
        return fail(reply, 409, "last_mode", error.message);
      }
      throw error;
    }
  });

  app.post("/api/modes/reorder", async (request) => {
    const body = z.object({ ids: z.array(z.string()).max(64) }).parse(request.body);
    const modes = ctx.store.reorderModes(body.ids);
    ctx.hub.broadcast("modes.changed", modes);
    return modes;
  });

  app.post("/api/modes/:id/activate", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ lock: z.boolean().optional() }).parse(request.body ?? {});
    const mode = ctx.store.getMode(id);
    if (!mode) return fail(reply, 404, "not_found", "Mode not found.");
    const runtime = ctx.store.setRuntime({
      active_mode: id,
      manual_lock: body.lock ?? true,
      last_suggestion_at: null,
      last_suggested_mode: null,
    });
    ctx.store.audit("user", "mode.activate", id, { manual_lock: runtime.manual_lock });
    ctx.hub.broadcast("mode.changed", { mode: id, runtime });
    return { mode, runtime };
  });

  app.post("/api/runtime/lock", async (request) => {
    const body = z.object({ locked: z.boolean() }).parse(request.body);
    const runtime = ctx.store.setRuntime({ manual_lock: body.locked });
    ctx.store.audit("user", "runtime.lock", "runtime", { locked: body.locked });
    ctx.hub.broadcast("runtime.changed", runtime);
    return runtime;
  });

  app.get("/api/modes/:id/versions", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!ctx.store.getMode(id)) return fail(reply, 404, "not_found", "Mode not found.");
    return ctx.store.listVersions(id);
  });

  app.post("/api/modes/:id/rollback", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ version: z.number().int().min(1) }).parse(request.body);
    try {
      const mode = ctx.store.rollbackMode(id, body.version);
      ctx.hub.broadcast("modes.changed", ctx.store.listModes());
      return mode;
    } catch (error) {
      if (error instanceof Error && error.message === "version not found") {
        return fail(reply, 404, "version_not_found", "Version not found.");
      }
      throw error;
    }
  });

  app.post("/api/modes/restore-defaults", async () => {
    const modes = ctx.store.restoreDefaults();
    ctx.hub.broadcast("modes.changed", modes);
    return modes;
  });

  // ---------- events & demo ----------

  app.get("/api/events", async (request) => {
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(500).default(100),
        kind: z.enum(["activity", "notification"]).optional(),
      })
      .parse(request.query);
    return ctx.store.listEvents(query.limit, query.kind);
  });

  app.get("/api/notifications", async (request) => {
    const query = z
      .object({ status: z.enum(["pending", "later", "stayed", "go_social", "dismissed"]).optional() })
      .parse(request.query);
    return query.status ? ctx.store.listNotifications(query.status) : pendingForDock(ctx.store);
  });

  app.post("/api/demo/activity", async (request, reply) => {
    if (!ctx.limiter.hit(`demo:${request.ip}`, 120, 60_000)) {
      return fail(reply, 429, "rate_limited", "Too many demo events; wait a moment.");
    }
    const body = z
      .object({
        app_name: z.string().min(1).max(120),
        app_id: z.string().max(120).optional(),
        stable_seconds: z.number().min(0).max(3600).default(0),
        source_app: z.string().max(120).optional(),
      })
      .parse(request.body);
    const event = ingestActivity(ctx, {
      source: "simulated",
      source_app: body.source_app ?? body.app_name,
      payload: {
        app_name: body.app_name,
        app_id: body.app_id,
        stable_seconds: body.stable_seconds,
        simulated: true,
      },
    });
    return reply.code(201).send(event);
  });

  app.post("/api/demo/notification", async (request, reply) => {
    if (!ctx.limiter.hit(`demo:${request.ip}`, 120, 60_000)) {
      return fail(reply, 429, "rate_limited", "Too many demo events; wait a moment.");
    }
    const body = z
      .object({
        source_app: z.string().min(1).max(120).default("Slack (simulated)"),
        title: z.string().max(200).default("New message"),
        body: z.string().max(400).default(""),
        time_sensitive: z.boolean().default(false),
        category: z.string().max(60).optional(),
        dedupe_key: z.string().max(160).optional(),
      })
      .parse(request.body);
    const result = ingestNotification(ctx, {
      source: "simulated",
      source_app: body.source_app,
      dedupe_key: body.dedupe_key,
      payload: {
        title: body.title,
        body: body.body,
        category: body.category,
        time_sensitive: body.time_sensitive,
        simulated: true,
      },
    });
    return reply.code(201).send(result);
  });

  app.post("/api/demo/burst", async (request, reply) => {
    if (!ctx.limiter.hit(`burst:${request.ip}`, 10, 60_000)) {
      return fail(reply, 429, "rate_limited", "Burst is limited to 10 calls per minute.");
    }
    const body = z.object({ count: z.number().int().min(1).max(100).default(50) }).parse(request.body ?? {});
    let urgent = 0;
    let deferred = 0;
    for (let i = 0; i < body.count; i += 1) {
      const isUrgent = i % 7 === 0;
      if (isUrgent) urgent += 1;
      const result = ingestNotification(ctx, {
        source: "simulated",
        source_app: isUrgent ? "Pager (simulated)" : "Slack (simulated)",
        dedupe_key: `burst-${Date.now()}-${i}`,
        payload: {
          title: isUrgent ? "Incident needs attention" : `Message ${i + 1}`,
          body: isUrgent ? "Production incident, urgent" : "Weekly update",
          time_sensitive: isUrgent,
          simulated: true,
        },
      });
      if (result.notification?.wait_seconds) deferred += 1;
    }
    return { created: body.count, urgent, deferred };
  });

  app.post("/api/notifications/:id/decision", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ action: z.enum(["stay", "later", "dismiss", "go_social"]) }).parse(request.body);
    const notification = ctx.store.getNotification(id);
    if (!notification) return fail(reply, 404, "not_found", "Notification not found.");
    if (notification.status !== "pending") {
      return fail(reply, 409, "already_decided", `Notification is already ${notification.status}.`);
    }

    if (body.action === "go_social") {
      const remaining = Math.ceil((Date.parse(notification.ready_at) - Date.now()) / 1000);
      if (remaining > 0) {
        return reply.code(409).send({
          error: "wait_not_elapsed",
          message: `The ${notification.wait_seconds}s cool-down still has ${remaining}s.`,
          remaining_seconds: remaining,
        });
      }
      const targetId = notification.event?.classification.suggested_mode ?? "social";
      const target = ctx.store.getMode(targetId);
      if (!target) return fail(reply, 409, "no_social_mode", "No Social mode is configured.");
      const updated = ctx.store.decideNotification(id, "go_social");
      const runtime = ctx.store.setRuntime({
        active_mode: target.id,
        manual_lock: true,
        last_suggestion_at: null,
        last_suggested_mode: null,
      });
      ctx.store.audit("user", "notification.go_social", id, { mode: target.id });
      ctx.hub.broadcast("mode.changed", { mode: target.id, runtime });
      ctx.hub.broadcast("notification.decided", updated);
      return { notification: updated, runtime };
    }

    const status = body.action === "stay" ? "stayed" : body.action === "later" ? "later" : "dismissed";
    const updated = ctx.store.decideNotification(id, status);
    ctx.hub.broadcast("notification.decided", updated);
    return { notification: updated, runtime: ctx.store.getRuntime() };
  });

  // ---------- proposals ----------

  app.get("/api/proposals", async () => ctx.store.listProposals());

  app.get("/api/proposals/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const proposal = ctx.store.getProposal(id);
    if (!proposal) return fail(reply, 404, "not_found", "Proposal not found.");
    return proposal;
  });

  app.post("/api/proposals", async (request, reply) => {
    if (!ctx.limiter.hit(`proposal:${request.ip}`, 20, 60_000)) {
      return fail(reply, 429, "rate_limited", "Proposal generation is limited to 20 per minute.");
    }
    const body = z.object({ prompt: z.string().min(3).max(2000) }).parse(request.body);
    const modes = ctx.store.listModes();
    const settings = ctx.store.getSettings();
    try {
      const result = await proposeWithProvider(
        body.prompt,
        modes,
        settings,
        readApiKey(ctx.dataDir),
      );
      const patch = validatePatch(result.patch, modes);
      const { diff } = computeDiff(patch, modes);
      const proposal = ctx.store.createProposal({
        source: result.source,
        prompt: body.prompt,
        summary: result.summary,
        patch,
        diff,
      });
      ctx.store.audit("user", "proposal.create", proposal.id, { source: result.source, ops: patch.length });
      return reply.code(201).send({
        ...proposal,
        fallback_reason: result.fallbackReason ?? null,
        latency_ms: result.latencyMs ?? null,
      });
    } catch (error) {
      if (error instanceof ProposalError) {
        return reply.code(422).send({ error: error.code, message: error.message });
      }
      throw error;
    }
  });

  app.post("/api/proposals/:id/apply", async (request, reply) => {
    const { id } = request.params as { id: string };
    const proposal = ctx.store.getProposal(id);
    if (!proposal) return fail(reply, 404, "not_found", "Proposal not found.");
    if (proposal.status !== "proposed") {
      return fail(reply, 409, "not_proposed", `Proposal is ${proposal.status}.`);
    }
    try {
      const modes = ctx.store.listModes();
      validatePatch(proposal.patch, modes);
      const { diff } = computeDiff(proposal.patch, modes);
      const applied = applyOps(ctx.store, proposal.patch, proposal.source === "rules" ? "rules" : "ai");
      const updated = ctx.store.markProposal(id, "applied", applied);
      ctx.store.audit("user", "proposal.apply", id, { modes: applied, diff });
      ctx.hub.broadcast("modes.changed", ctx.store.listModes());
      ctx.hub.broadcast("proposal.applied", updated);
      return { proposal: updated, modes: ctx.store.listModes() };
    } catch (error) {
      const message = error instanceof Error ? error.message : "apply failed";
      ctx.store.markProposal(id, "failed", [], message);
      if (error instanceof ProposalError) {
        return reply.code(422).send({ error: error.code, message });
      }
      throw error;
    }
  });

  app.post("/api/proposals/:id/reject", async (request, reply) => {
    const { id } = request.params as { id: string };
    const proposal = ctx.store.getProposal(id);
    if (!proposal) return fail(reply, 404, "not_found", "Proposal not found.");
    if (proposal.status !== "proposed") {
      return fail(reply, 409, "not_proposed", `Proposal is ${proposal.status}.`);
    }
    const updated = ctx.store.markProposal(id, "rejected");
    ctx.store.audit("user", "proposal.reject", id, {});
    return updated;
  });

  // ---------- native companion launch (Windows recovery spike) ----------

  app.get("/api/native/apps", async (_request, reply) => {
    if (process.platform !== "win32") {
      return fail(reply, 503, "native_unavailable", "Native launch is only available on Windows in this spike.");
    }
    try {
      const result = await nativeControlRequest(ctx, "/apps");
      if (result.status !== 200) {
        return fail(reply, 503, "native_unavailable", "The Windows companion is not listening.");
      }
      return result.body;
    } catch {
      return fail(reply, 503, "native_unavailable", "The Windows companion is not running.");
    }
  });

  app.get("/api/native/icon/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1).max(128) }).parse(request.params);
    if (process.platform !== "win32") {
      return fail(reply, 503, "native_unavailable", "Native icons are only available on Windows in this spike.");
    }
    try {
      const result = await nativeControlBinary(ctx, `/icon?id=${encodeURIComponent(params.id)}`);
      if (result.status !== 200 || result.body.length === 0) {
        return fail(reply, 404, "icon_not_found", "No icon for this app.");
      }
      reply.header("cache-control", "private, max-age=300");
      return reply.type("image/png").send(result.body);
    } catch {
      return fail(reply, 503, "native_unavailable", "The Windows companion is not running.");
    }
  });

  app.post("/api/native/launch", async (request, reply) => {
    const body = z
      .object({
        id: z.string().min(1).max(128),
        label: z.string().max(80).optional(),
        confirm_social: z.boolean().optional(),
      })
      .parse(request.body);
    if (process.platform !== "win32") {
      return fail(reply, 503, "native_unavailable", "Native launch is only available on Windows in this spike.");
    }

    const active = activeMode(ctx.store);
    const wait = active.notifications.switch_wait_seconds;
    if (
      isSocialNativeLabel(body.label) &&
      active.id !== "social" &&
      active.notifications.social_switch_enabled &&
      wait > 0 &&
      body.confirm_social !== true
    ) {
      return reply.code(409).send({
        error: "social_pause_required",
        message: "Social app launch is paused for focus.",
        wait_seconds: wait,
      });
    }

    try {
      const result = await nativeControlRequest(ctx, "/launch", "POST", { id: body.id });
      if (result.status !== 200) {
        return fail(reply, 502, "native_launch_failed", "The Windows companion rejected the launch.");
      }
      ctx.store.audit("user", "native.launch", "apps", {
        id: body.id,
        label: body.label ?? null,
      });
      return result.body;
    } catch {
      return fail(reply, 503, "native_unavailable", "The Windows companion is not running.");
    }
  });

  // ---------- settings, privacy, data ----------

  app.get("/api/settings", async () => publicSettings(ctx.store.getSettings(), ctx.dataDir));

  app.put("/api/settings", async (request) => {
    const body = z
      .object({
        language: z.enum(["en", "zh"]).optional(),
        ai: aiSettingsPatchSchema.optional(),
        privacy: privacySettingsPatchSchema.optional(),
      })
      .parse(request.body);
    const current = ctx.store.getSettings();
    const next = ctx.store.updateSettings({
      ...current,
      ...(body.language ? { language: body.language } : {}),
      ai: { ...current.ai, ...(body.ai ?? {}) },
      privacy: { ...current.privacy, ...(body.privacy ?? {}) },
    });
    ctx.store.prune(next.privacy.retention_days);
    ctx.hub.broadcast("settings.changed", publicSettings(next, ctx.dataDir));
    return publicSettings(next, ctx.dataDir);
  });

  app.put("/api/settings/ai-key", async (request) => {
    const body = z.object({ api_key: z.string().min(8).max(300).nullable() }).parse(request.body);
    writeApiKey(ctx.dataDir, body.api_key);
    ctx.store.audit("user", "settings.ai_key", "secrets", { present: body.api_key !== null });
    return { has_api_key: hasApiKey(ctx.dataDir) };
  });

  app.get("/api/audit", async (request) => {
    const query = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }).parse(request.query);
    return ctx.store.listAudit(query.limit);
  });

  app.get("/api/export", async (_request, reply) => {
    reply.header("content-disposition", 'attachment; filename="focusdock-export.json"');
    return ctx.store.exportData();
  });

  app.post("/api/import", async (request) => {
    const body = z
      .object({
        format: z.literal("focusdock-export"),
        version: z.number().int().min(1).max(1),
        modes: z
          .array(
            modeInputSchema.extend({
              id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/),
              is_builtin: z.boolean().optional(),
            }),
          )
          .min(1)
          .max(32),
      })
      .parse(request.body);

    ctx.store.db.exec("BEGIN");
    try {
      for (const mode of body.modes) {
        const { id, is_builtin, ...config } = mode;
        if (ctx.store.getMode(id)) {
          ctx.store.replaceModeConfig(id, config, "import", "imported from bundle");
        } else {
          ctx.store.createMode(config, { id, is_builtin: Boolean(is_builtin), source: "import" });
        }
      }
      ctx.store.db.exec("COMMIT");
    } catch (error) {
      ctx.store.db.exec("ROLLBACK");
      throw error;
    }
    ctx.store.audit("user", "data.import", "modes", { count: body.modes.length });
    ctx.hub.broadcast("modes.changed", ctx.store.listModes());
    return { imported: body.modes.length };
  });

  app.post("/api/data/clear-events", async (request) => {
    z.object({ confirm: z.literal(true) }).parse(request.body);
    const deleted = ctx.store.clearEvents();
    ctx.hub.broadcast("data.cleared", { deleted });
    return { deleted };
  });

  app.post("/api/data/reset", async (request) => {
    z.object({ confirm: z.literal("RESET") }).parse(request.body);
    ctx.store.resetAll();
    ctx.hub.broadcast("data.reset", {});
    return { ok: true, modes: ctx.store.listModes() };
  });

  // ---------- bridge ----------

  app.get("/api/bridge/status", async () => ({
    ...ctx.bridge,
    connected: bridgeIsFresh(ctx),
  }));

  app.post("/api/bridge/heartbeat", async (request) => {
    const body = z
      .object({
        bridge_version: z.string().max(40).default("unknown"),
        capabilities: z.record(z.string(), z.string().max(60)).default({}),
      })
      .parse(request.body ?? {});
    ctx.bridge.connected = true;
    ctx.bridge.last_seen = nowIso();
    ctx.bridge.bridge_version = body.bridge_version;
    ctx.bridge.capabilities = body.capabilities;
    ctx.hub.broadcast("bridge.status", { ...ctx.bridge, connected: true });
    return { ok: true, protocol: PROTOCOL_VERSION, mode: ctx.store.getRuntime().active_mode };
  });

  app.post("/api/bridge/events", async (request, reply) => {
    if (!ctx.limiter.hit(`bridge:${request.ip}`, 600, 60_000)) {
      return fail(reply, 429, "rate_limited", "Bridge event rate exceeded.");
    }
    const body = z
      .object({
        kind: z.enum(["activity", "notification"]),
        source_app: z.string().min(1).max(120),
        timestamp: z.string().datetime({ offset: true }).optional(),
        dedupe_key: z.string().max(160).optional(),
        payload: z
          .object({
            app_id: z.string().max(120).optional(),
            app_name: z.string().max(120).optional(),
            title: z.string().max(200).optional(),
            body: z.string().max(400).optional(),
            category: z.string().max(60).optional(),
            time_sensitive: z.boolean().optional(),
            stable_seconds: z.number().min(0).max(86_400).optional(),
          })
          .default({}),
      })
      .parse(request.body);
    ctx.bridge.last_seen = nowIso();
    ctx.bridge.connected = true;
    if (body.kind === "activity") {
      const event = ingestActivity(
        ctx,
        { source: "bridge", source_app: body.source_app, timestamp: body.timestamp, dedupe_key: body.dedupe_key, payload: body.payload },
        "bridge",
      );
      return reply.code(201).send(event);
    }
    const result = ingestNotification(
      ctx,
      { source: "bridge", source_app: body.source_app, timestamp: body.timestamp, dedupe_key: body.dedupe_key, payload: body.payload },
      "bridge",
    );
    return reply.code(201).send(result);
  });

  app.post("/api/bridge/disconnect", async () => {
    ctx.bridge.connected = false;
    ctx.bridge.last_seen = null;
    ctx.bridge.capabilities = null;
    ctx.hub.broadcast("bridge.status", { ...ctx.bridge, connected: false });
    return { ok: true };
  });

  app.post("/api/bridge/rotate-token", async () => {
    const token = crypto.randomBytes(32).toString("base64url");
    writeSecretFile(ctx.bridgeTokenPath, `${token}\n`);
    ctx.bridgeToken = token;
    ctx.bridge.connected = false;
    ctx.bridge.last_seen = null;
    ctx.store.audit("user", "bridge.rotate_token", "bridge", {});
    ctx.hub.broadcast("bridge.status", { ...ctx.bridge, connected: false });
    return { rotated: true, token_path: ctx.bridgeTokenPath };
  });

  // ---------- SPA fallback ----------

  app.setNotFoundHandler(async (request, reply) => {
    if (request.method === "GET" && !request.url.startsWith("/api/") && request.url !== "/api/ws") {
      return serveShell(request, reply);
    }
    return reply.code(404).send({ error: "not_found", message: "No such route." });
  });

  // ---------- realtime ----------

  const wss = new WebSocketServer({ noServer: true });

  app.server.on("upgrade", (request, socket, head) => {
    const rawUrl = request.url ?? "/";
    const pathname = rawUrl.split("?")[0];
    const reject = (status: string) => {
      socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
      socket.destroy();
    };
    if (pathname !== "/api/ws") return reject("404 Not Found");
    if (!isAllowedHost(request.headers.host, ctx.port)) return reject("421 Misdirected Request");
    if (!isAllowedOrigin(request.headers.origin, ctx.port, true)) return reject("403 Forbidden");
    const cookies = parseCookies(request.headers.cookie);
    if (!ctx.sessions.get(cookies[SESSION_COOKIE])) return reject("401 Unauthorized");

    wss.handleUpgrade(request, socket, head, (ws) => {
      ctx.hub.add(ws);
      ws.send(
        JSON.stringify({
          type: "hello",
          data: { protocol: PROTOCOL_VERSION, version: APP_VERSION, time: nowIso() },
        }),
      );
      ws.on("message", (raw) => {
        if (String(raw) === "ping" && ws.readyState === ws.OPEN) ws.send("pong");
      });
    });
  });

  app.addHook("onClose", async () => {
    wss.close();
  });

  const address = await app.listen({ host: "127.0.0.1", port: ctx.port });
  const actualPort = (app.server.address() as { port: number }).port;
  ctx.port = actualPort;
  const url = address;

  return { app, ctx, url };
}

export function removeBridgeToken(pathname: string): void {
  removeSecretFile(pathname);
}

export function readBridgeToken(pathname: string): string | null {
  try {
    return fs.readFileSync(pathname, "utf8").trim() || null;
  } catch {
    return null;
  }
}
