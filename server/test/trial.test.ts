import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defaultModes } from "../src/domain/defaults";
import { call, createSession, createTestApp, type Session, type TestApp } from "./helpers";

let app: TestApp;
let session: Session;
beforeAll(async () => {
  app = await createTestApp();
  session = await createSession(app.base);
});
afterAll(async () => app.close());

describe("Windows trial defaults", () => {
  it("seeds only bookmarks on Windows until the user adds catalog apps", () => {
    const defaults = defaultModes("win32");
    expect(defaults).toHaveLength(6);
    expect(defaults.every((mode) => mode.pinned_items.every((item) => item.kind === "bookmark"))).toBe(true);
    expect(defaults.find((mode) => mode.id === "meeting")!.pinned_items).toEqual([]);
    expect(defaultModes("darwin").some((mode) => mode.pinned_items.some((item) => item.kind === "app"))).toBe(true);
  });
});

describe("continuous confirmed mode transitions", () => {
  const event = async (appId: string, stable: number) => {
    const response = await fetch(`${app.base}/api/bridge/events`, {
      method: "POST",
      headers: { authorization: `Bearer ${app.bridgeToken}`, "content-type": "application/json" },
      body: JSON.stringify({ kind: "activity", source_app: appId, payload: { app_id: appId, app_name: appId, stable_seconds: stable } }),
    });
    expect(response.status).toBe(201);
  };

  it("confirms two switches without silently turning on manual lock", async () => {
    await event("code.exe", 15);
    let state = await call(app.base, "/api/state", { session });
    expect(state.body.runtime.last_suggested_mode).toBe("building");
    const confirm = await call(app.base, "/api/modes/building/activate", { method: "POST", session, body: {} });
    expect(confirm.body.runtime.manual_lock).toBe(false);
    // Cooldown remains active after confirming a suggestion.
    await event("zotero.exe", 15);
    state = await call(app.base, "/api/state", { session });
    expect(state.body.runtime.last_suggested_mode).toBe(null);
    app.store.setRuntime({ last_suggestion_at: new Date(Date.now() - 61000).toISOString() });
    await event("zotero.exe", 15);
    state = await call(app.base, "/api/state", { session });
    expect(state.body.runtime.last_suggested_mode).toBe("research");
    const second = await call(app.base, "/api/modes/research/activate", { method: "POST", session, body: {} });
    expect(second.body.runtime.active_mode).toBe("research");
    expect(second.body.runtime.manual_lock).toBe(false);
  });

  it("suppresses suggestions only after an explicit lock", async () => {
    await call(app.base, "/api/runtime/lock", { method: "POST", session, body: { locked: true } });
    app.store.setRuntime({ last_suggestion_at: null });
    await event("code.exe", 15);
    const state = await call(app.base, "/api/state", { session });
    expect(state.body.runtime.manual_lock).toBe(true);
    expect(state.body.runtime.last_suggested_mode).toBe(null);
    await call(app.base, "/api/runtime/lock", { method: "POST", session, body: { locked: false } });
    await event("code.exe", 15);
    const unlocked = await call(app.base, "/api/state", { session });
    expect(unlocked.body.runtime.last_suggested_mode).toBe("building");
  });
});
