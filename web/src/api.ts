export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: unknown;

  constructor(status: number, code: string, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
};

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { accept: "application/json" };
  let body: string | undefined;

  if (method !== "GET") {
    headers["content-type"] = "application/json";
    headers["x-focusdock-csrf"] = getCookie("fd_csrf");
    body = JSON.stringify(options.body ?? {});
  }

  const response = await fetch(path, {
    method,
    headers,
    body,
    credentials: "same-origin",
    cache: "no-store",
  });

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const record = (data ?? {}) as { error?: string; message?: string };
    throw new ApiError(
      response.status,
      record.error ?? `http_${response.status}`,
      record.message ?? `Request failed with ${response.status}.`,
      data,
    );
  }
  return data as T;
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
