import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { FastifyReply, FastifyRequest } from "fastify";
import { isAllowedHost, isAllowedOrigin } from "./config";

export const SESSION_COOKIE = "fd_session";
export const CSRF_COOKIE = "fd_csrf";
export const CSRF_HEADER = "x-focusdock-csrf";

export type Session = { id: string; csrf: string; created: number };

export class SessionManager {
  private sessions = new Map<string, Session>();

  issue(): Session {
    const session: Session = {
      id: crypto.randomBytes(32).toString("base64url"),
      csrf: crypto.randomBytes(24).toString("base64url"),
      created: Date.now(),
    };
    this.sessions.set(session.id, session);
    if (this.sessions.size > 64) {
      const oldest = [...this.sessions.values()].sort((a, b) => a.created - b.created)[0];
      if (oldest) this.sessions.delete(oldest.id);
    }
    return session;
  }

  get(id: string | undefined): Session | null {
    if (!id) return null;
    const session = this.sessions.get(id);
    if (!session) return null;
    if (Date.now() - session.created > 24 * 3600_000) {
      this.sessions.delete(id);
      return null;
    }
    return session;
  }

  clear(): void {
    this.sessions.clear();
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function sessionFromRequest(request: FastifyRequest, sessions: SessionManager): Session | null {
  const cookies = parseCookies(request.headers.cookie);
  return sessions.get(cookies[SESSION_COOKIE]);
}

export function setSessionCookies(reply: FastifyReply, session: Session): void {
  const maxAge = 24 * 3600;
  reply.header("set-cookie", [
    `${SESSION_COOKIE}=${session.id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`,
    `${CSRF_COOKIE}=${session.csrf}; SameSite=Strict; Path=/; Max-Age=${maxAge}`,
  ]);
}

export function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function checkHost(request: FastifyRequest, port: number): boolean {
  return isAllowedHost(request.headers.host, port);
}

export function checkOrigin(request: FastifyRequest, port: number, requireOrigin: boolean): boolean {
  return isAllowedOrigin(request.headers.origin, port, requireOrigin);
}

export function writeSecretFile(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, content, { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* Windows: best effort; documented in SECURITY.md */
  }
}

export function removeSecretFile(file: string): void {
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}

type Bucket = { count: number; resetAt: number };

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  hit(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (bucket.count >= limit) return false;
    bucket.count += 1;
    return true;
  }
}
