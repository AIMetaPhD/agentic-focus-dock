import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { AppState } from "./types";

export function useAppState() {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const timer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await api<AppState>("/api/state");
      setState(next);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load state.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const heartbeatRefresh = window.setInterval(() => void refresh(), 5000);

    let socket: WebSocket | null = null;
    let closed = false;
    let retry: number | null = null;
    let attempt = 0;

    const connect = () => {
      if (closed) return;
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${location.host}/api/ws`);
      socket.onopen = () => {
        attempt = 0;
        setLive(true);
      };
      socket.onclose = () => {
        setLive(false);
        if (closed) return;
        attempt += 1;
        retry = window.setTimeout(connect, Math.min(1000 * 2 ** attempt, 15000));
      };
      socket.onerror = () => {
        setLive(false);
      };
      socket.onmessage = (event) => {
        if (event.data === "pong") return;
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void refresh(), 120);
      };
    };

    connect();
    return () => {
      closed = true;
      window.clearInterval(heartbeatRefresh);
      if (retry) window.clearTimeout(retry);
      if (timer.current) window.clearTimeout(timer.current);
      socket?.close();
    };
  }, [refresh]);

  return { state, setState, refresh, error, live };
}

export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
