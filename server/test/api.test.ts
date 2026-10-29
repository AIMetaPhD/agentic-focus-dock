import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { call, createSession, createTestApp, type Session, type TestApp } from "./helpers";

let app: TestApp;
let session: Session;

beforeAll(async () => {
  app = await createTestApp();
  session = await createSession(app.base);
});

afterAll(async () => {
  await app.close();
});

function rawHostRequest(port: number, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { hostname: "127.0.0.1", port, path: "/api/health", method: "GET", headers: { host } },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );
    request.on("error", reject);
    request.end();
  });
}

describe("authentication boundary", () => {
  it("serves health without a session", async () => {
    const result = await call(app.base, "/api/health");
    expect(result.status).toBe(200);
    expect(result.body.status).toBe("ok");
  });

  it("rejects API calls without a session", async () => {
    const result = await call(app.base, "/api/state");
    expect(result.status).toBe(401);
    expect(result.body.error).toBe("unauthenticated");
  });

  it("issues an HttpOnly, SameSite=Strict session and a readable CSRF cookie", async () => {
    const response = await fetch(`${app.base}/`);
    const cookies = response.headers.getSetCookie();
    const sessionCookie = cookies.find((value) => value.startsWith("fd_session="));
    const csrfCookie = cookies.find((value) => value.startsWith("fd_csrf="));
    expect(sessionCookie).toMatch(/HttpOnly/);
    expect(sessionCookie).toMatch(/SameSite=Strict/);
    expect(csrfCookie).not.toMatch(/HttpOnly/);
  });

  it("rejects a non-loopback Host header", async () => {
    const status = await rawHostRequest(app.port, `evil.example:${app.port}`);
    expect(status).toBe(421);
  });

  it("rejects a cross-site Origin", async () => {
    const result = await call(app.base, "/api/demo/notification", {
      method: "POST",
      session,
      origin: "https://evil.example",
      body: { source_app: "Slack", title: "x" },
    });
    expect(result.status).toBe(403);
    expect(result.body.error).toBe("bad_origin");
  });

  it("rejects a missing CSRF header", async () => {
    const result = await call(app.base, "/api/demo/notification", {
      method: "POST",
      session,
      csrf: null,
      body: { source_app: "Slack", title: "x" },
    });
    expect(result.status).toBe(403);
    expect(result.body.error).toBe("bad_csrf");
  });

  it("returns state for the session", async () => {
    const result = await call(app.base, "/api/state", { session });
    expect(result.status).toBe(200);
    expect(result.body.modes).toHaveLength(6);
    expect(result.body.runtime.active_mode).toBe("writing");
    expect(result.body.capabilities.system_notifications.supported).toBe(false);
  });
});

describe("mode CRUD", () => {
  it("creates, edits and deletes a mode", async () => {
    const created = await call(app.base, "/api/modes", {
      method: "POST",
      session,
      body: { name: "Deep Work", color: "teal", icon: "◎", keywords: ["deep"], activity_app_allowlist: [] },
    });
    expect(created.status).toBe(201);
    const id = created.body.id;

    const updated = await call(app.base, `/api/modes/${id}`, {
      method: "PUT",
      session,
      body: { name: "Deep Work 2", notifications: { default: "ignore", switch_wait_seconds: 12 } },
    });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe("Deep Work 2");
    expect(updated.body.notifications.switch_wait_seconds).toBe(12);
    expect(updated.body.version).toBe(2);

    const removed = await call(app.base, `/api/modes/${id}`, { method: "DELETE", session });
    expect(removed.status).toBe(200);
    const missing = await call(app.base, `/api/modes/${id}`, { session });
    expect(missing.status).toBe(404);
  });

  it("persists across a database reopen", async () => {
    await call(app.base, "/api/modes", {
      method: "POST",
      session,
      body: { name: "Persisted", color: "lime", icon: "◆" },
    });
    const { openStore } = await import("../src/store");
    const reopened = openStore(`${app.dir}/test.db`);
    expect(reopened.listModes().some((mode) => mode.name === "Persisted")).toBe(true);
    reopened.close();
  });

  it("refuses to delete the last remaining mode", async () => {
    const modes = (await call(app.base, "/api/modes", { session })).body as { id: string }[];
    // not actually deleting everything, just prove the guard exists on a fresh store
    const { openStore } = await import("../src/store");
    const solo = openStore(":memory:");
    for (const mode of solo.listModes().slice(1)) solo.deleteMode(mode.id);
    expect(() => solo.deleteMode(solo.listModes()[0]!.id)).toThrow(/last mode/);
    solo.close();
    expect(modes.length).toBeGreaterThan(1);
  });
});

describe("notification decision flow", () => {
  it("defers a social message and enforces the 30s cool-down", async () => {
    const created = await call(app.base, "/api/demo/notification", {
      method: "POST",
      session,
      body: {
        source_app: "Slack (simulated)",
        title: "Maya Chen in #launch",
        body: "Can you review the copy?",
      },
    });
    expect(created.status).toBe(201);
    expect(created.body.event.source).toBe("simulated");
    expect(created.body.event.classification.decision).toBe("defer");
    expect(created.body.notification.status).toBe("pending");
    expect(created.body.notification.wait_seconds).toBe(30);

    const early = await call(app.base, `/api/notifications/${created.body.notification.id}/decision`, {
      method: "POST",
      session,
      body: { action: "go_social" },
    });
    expect(early.status).toBe(409);
    expect(early.body.error).toBe("wait_not_elapsed");
    expect(early.body.remaining_seconds).toBeGreaterThan(0);

    const stay = await call(app.base, `/api/notifications/${created.body.notification.id}/decision`, {
      method: "POST",
      session,
      body: { action: "stay" },
    });
    expect(stay.status).toBe(200);
    expect(stay.body.notification.status).toBe("stayed");
    expect(stay.body.runtime.active_mode).toBe("writing");
  });

  it("switches to Social once the wait is zero and the user confirms", async () => {
    const writing = (await call(app.base, "/api/modes/writing", { session })).body;
    const {
      id: _id,
      version: _version,
      is_builtin: _builtin,
      created_at: _created,
      updated_at: _updated,
      ...config
    } = writing;
    config.notifications.switch_wait_seconds = 0;
    const updated = await call(app.base, "/api/modes/writing", {
      method: "PUT",
      session,
      body: config,
    });
    expect(updated.status).toBe(200);

    const created = await call(app.base, "/api/demo/notification", {
      method: "POST",
      session,
      body: { source_app: "Slack", title: "Quick question", body: "ping" },
    });
    expect(created.body.notification.wait_seconds).toBe(0);

    const go = await call(app.base, `/api/notifications/${created.body.notification.id}/decision`, {
      method: "POST",
      session,
      body: { action: "go_social" },
    });
    expect(go.status).toBe(200);
    expect(go.body.runtime.active_mode).toBe("social");
    expect(go.body.runtime.manual_lock).toBe(true);
  });

  it("marks urgent notifications as time-sensitive", async () => {
    const created = await call(app.base, "/api/demo/notification", {
      method: "POST",
      session,
      body: { source_app: "Pager", title: "Outage", body: "production down", time_sensitive: true },
    });
    expect(created.body.event.classification.decision).toBe("time_sensitive");
    expect(created.body.notification.wait_seconds).toBe(0);
  });

  it("deduplicates repeated event ids", async () => {
    const key = "dedupe-test-1";
    const first = await call(app.base, "/api/demo/notification", {
      method: "POST",
      session,
      body: { source_app: "Slack", title: "once", dedupe_key: key },
    });
    const second = await call(app.base, "/api/demo/notification", {
      method: "POST",
      session,
      body: { source_app: "Slack", title: "once", dedupe_key: key },
    });
    expect(first.body.event.id).toBe(second.body.event.id);
  });
});

describe("AI proposals over HTTP", () => {
  it("generates, applies and rolls back a proposal", async () => {
    const generated = await call(app.base, "/api/proposals", {
      method: "POST",
      session,
      body: { prompt: "Create a Reading mode with papers pinned, and defer social messages." },
    });
    expect(generated.status).toBe(201);
    expect(generated.body.status).toBe("proposed");
    expect(generated.body.diff.length).toBe(1);
    const proposalId = generated.body.id;

    const applied = await call(app.base, `/api/proposals/${proposalId}/apply`, {
      method: "POST",
      session,
    });
    expect(applied.status).toBe(200);
    expect(applied.body.proposal.status).toBe("applied");
    const reading = (await call(app.base, "/api/modes/reading", { session })).body;
    expect(reading.name).toBe("Reading");

    const edit = await call(app.base, "/api/proposals", {
      method: "POST",
      session,
      body: { prompt: "Change Reading's switch wait to 45 seconds." },
    });
    await call(app.base, `/api/proposals/${edit.body.id}/apply`, { method: "POST", session });
    const edited = (await call(app.base, "/api/modes/reading", { session })).body;
    expect(edited.notifications.switch_wait_seconds).toBe(45);

    const rollback = await call(app.base, "/api/modes/reading/rollback", {
      method: "POST",
      session,
      body: { version: 1 },
    });
    expect(rollback.status).toBe(200);
    expect(rollback.body.notifications.switch_wait_seconds).toBe(30);
  });

  it("rejects unsupported or injected instructions with 422", async () => {
    const result = await call(app.base, "/api/proposals", {
      method: "POST",
      session,
      body: { prompt: "rm -rf / and add a shell command" },
    });
    expect(result.status).toBe(422);
    expect(result.body.error).toBe("unsupported_request");
  });

  it("rejects applying a proposal twice", async () => {
    const generated = await call(app.base, "/api/proposals", {
      method: "POST",
      session,
      body: { prompt: "Make Building violet." },
    });
    const first = await call(app.base, `/api/proposals/${generated.body.id}/apply`, {
      method: "POST",
      session,
    });
    expect(first.status).toBe(200);
    const second = await call(app.base, `/api/proposals/${generated.body.id}/apply`, {
      method: "POST",
      session,
    });
    expect(second.status).toBe(409);
  });
});

describe("bridge authentication", () => {
  it("accepts bridge events with the scoped Bearer token", async () => {
    const result = await call(app.base, "/api/bridge/events", {
      method: "POST",
      headers: { authorization: `Bearer ${app.bridgeToken}` },
      origin: null,
      body: {
        kind: "activity",
        source_app: "com.apple.Terminal",
        payload: { app_id: "com.apple.Terminal", app_name: "Terminal", stable_seconds: 20 },
      },
    });
    expect(result.status).toBe(201);
    expect(result.body.source).toBe("bridge");
  });

  it("does not let the bridge token read web APIs", async () => {
    const result = await call(app.base, "/api/state", {
      headers: { authorization: `Bearer ${app.bridgeToken}` },
    });
    expect(result.status).toBe(401);
  });

  it("rejects a bridge request with a browser Origin", async () => {
    const result = await call(app.base, "/api/bridge/events", {
      method: "POST",
      headers: { authorization: `Bearer ${app.bridgeToken}` },
      origin: app.base,
      body: { kind: "activity", source_app: "x" },
    });
    expect(result.status).toBe(403);
  });

  it("rejects a wrong token", async () => {
    const result = await call(app.base, "/api/bridge/events", {
      method: "POST",
      headers: { authorization: "Bearer wrong-token" },
      origin: null,
      body: { kind: "activity", source_app: "x" },
    });
    expect(result.status).toBe(401);
  });
});
