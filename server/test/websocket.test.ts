import { once } from "node:events";
import WebSocket from "ws";
import { describe, expect, it } from "vitest";
import { createSession, createTestApp } from "./helpers";

describe("realtime shutdown", () => {
  it("terminates connected WebSocket clients when the server closes", async () => {
    const local = await createTestApp();
    const session = await createSession(local.base);
    const socket = new WebSocket(`${local.base.replace("http", "ws")}/api/ws`, {
      headers: { cookie: session.cookie, origin: local.base },
    });

    await once(socket, "open");
    const closed = once(socket, "close");
    await local.close();
    await expect(closed).resolves.toBeDefined();
  });
});
