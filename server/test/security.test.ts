import WebSocket from "ws";
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

function probeWebSocket(
  port: number,
  headers: Record<string, string>,
): Promise<{ opened: boolean; status?: number }> {
  return new Promise((resolve) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/ws`, { headers });
    const timer = setTimeout(() => {
      socket.terminate();
      resolve({ opened: false });
    }, 4000);
    socket.on("open", () => {
      clearTimeout(timer);
      socket.close();
      resolve({ opened: true });
    });
    socket.on("unexpected-response", (_request, response) => {
      clearTimeout(timer);
      response.resume();
      resolve({ opened: false, status: response.statusCode });
    });
    socket.on("error", () => {
      clearTimeout(timer);
      resolve({ opened: false });
    });
  });
}

describe("WebSocket origin policy", () => {
  it("accepts the local origin with a session", async () => {
    const result = await probeWebSocket(app.port, {
      cookie: session.cookie,
      origin: app.base,
    });
    expect(result.opened).toBe(true);
  });

  it("rejects an evil origin even with a valid cookie", async () => {
    const result = await probeWebSocket(app.port, {
      cookie: session.cookie,
      origin: "https://evil.example",
    });
    expect(result.opened).toBe(false);
    expect(result.status).toBe(403);
  });

  it("rejects a connection without a session", async () => {
    const result = await probeWebSocket(app.port, { origin: app.base });
    expect(result.opened).toBe(false);
    expect(result.status).toBe(401);
  });
});

describe("secret handling", () => {
  it("never puts the bridge token into the HTML shell or exports", async () => {
    const shell = await fetch(`${app.base}/`).then((response) => response.text());
    expect(shell).not.toContain(app.bridgeToken);
    const exported = await call(app.base, "/api/export", { session });
    expect(JSON.stringify(exported.body)).not.toContain(app.bridgeToken);
  });

  it("stores the API key outside the database and never returns it", async () => {
    const saved = await call(app.base, "/api/settings/ai-key", {
      method: "PUT",
      session,
      body: { api_key: "sk-test-1234567890" },
    });
    expect(saved.status).toBe(200);
    expect(saved.body.has_api_key).toBe(true);

    const settings = await call(app.base, "/api/settings", { session });
    expect(JSON.stringify(settings.body)).not.toContain("sk-test-1234567890");

    const { openStore } = await import("../src/store");
    const reopened = openStore(`${app.dir}/test.db`);
    const rows = reopened.db.prepare("SELECT * FROM settings").all();
    expect(JSON.stringify(rows)).not.toContain("sk-test-1234567890");
    reopened.close();

    const removed = await call(app.base, "/api/settings/ai-key", {
      method: "PUT",
      session,
      body: { api_key: null },
    });
    expect(removed.body.has_api_key).toBe(false);
  });

  it("rejects oversized bodies", async () => {
    const big = "x".repeat(70 * 1024);
    const result = await call(app.base, "/api/demo/notification", {
      method: "POST",
      session,
      rawBody: JSON.stringify({ source_app: "Slack", title: big }),
    });
    expect(result.status).toBe(413);
  });

  it("does not expose server errors as stack traces", async () => {
    const malformed = await call(app.base, "/api/demo/notification", {
      method: "POST",
      session,
      rawBody: "{not json",
    });
    expect(malformed.status).toBe(400);
    expect(JSON.stringify(malformed.body)).not.toMatch(/at .*\.ts:/);
  });
});
