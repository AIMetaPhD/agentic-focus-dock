import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { openStore, type Store } from "../src/store";
import { startServer, type Ctx } from "../src/server";
import { writeSecretFile } from "../src/security";

export type TestApp = {
  app: FastifyInstance;
  ctx: Ctx;
  base: string;
  port: number;
  dir: string;
  store: Store;
  bridgeToken: string;
  close: () => Promise<void>;
};

export async function createTestApp(): Promise<TestApp> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "focusdock-test-"));
  const webDist = path.join(dir, "web");
  fs.mkdirSync(webDist, { recursive: true });
  fs.writeFileSync(
    path.join(webDist, "index.html"),
    "<!doctype html><title>test</title><div id=root></div>",
  );
  const store = openStore(path.join(dir, "test.db"));
  const bridgeToken = crypto.randomBytes(16).toString("base64url");
  const bridgeTokenPath = path.join(dir, "bridge-token");
  writeSecretFile(bridgeTokenPath, `${bridgeToken}\n`);

  const { app, ctx, url } = await startServer({
    dataDir: dir,
    store,
    webDist,
    port: 0,
    bridgeToken,
    bridgeTokenPath,
  });
  const port = (app.server.address() as { port: number }).port;

  return {
    app,
    ctx,
    base: url,
    port,
    dir,
    store,
    bridgeToken,
    close: async () => {
      await app.close();
      store.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

export type Session = { cookie: string; csrf: string; origin: string };

export async function createSession(base: string): Promise<Session> {
  const response = await fetch(`${base}/`, { redirect: "manual" });
  const setCookies = response.headers.getSetCookie();
  const pairs = setCookies.map((value) => value.split(";")[0]!);
  const cookie = pairs.join("; ");
  const csrf = /fd_csrf=([^;]+)/.exec(cookie)?.[1] ?? "";
  if (!csrf) throw new Error(`no csrf cookie issued: ${setCookies.join(" | ")}`);
  return { cookie, csrf, origin: base };
}

export type RequestOptions = {
  method?: string;
  body?: unknown;
  session?: Session | null;
  origin?: string | null;
  csrf?: string | null;
  headers?: Record<string, string>;
  rawBody?: string;
};

export async function call(
  base: string,
  pathname: string,
  options: RequestOptions = {},
): Promise<{ status: number; body: any; headers: Headers }> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { accept: "application/json", ...options.headers };
  if (options.session) headers.cookie = options.session.cookie;
  if (method !== "GET") {
    headers["content-type"] = "application/json";
    if (options.origin !== null) headers.origin = options.origin ?? options.session?.origin ?? base;
    if (options.csrf !== null) headers["x-focusdock-csrf"] = options.csrf ?? options.session?.csrf ?? "";
  }
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers,
    body:
      method === "GET"
        ? undefined
        : options.rawBody ?? JSON.stringify(options.body ?? {}),
    redirect: "manual",
  });
  const text = await response.text();
  let body: any = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, body, headers: response.headers };
}
