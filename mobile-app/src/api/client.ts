/**
 * The only place this app talks HTTP.
 *
 * Screens never call it directly — they go through a context, which calls this.
 * That is what keeps the native build and the Vite web build identical.
 *
 * Three things it exists to get right:
 *
 * 1. **The error envelope.** The API always fails as `{"error": {code, message}}`,
 *    so callers get an `ApiError` carrying `code` and can branch on
 *    `INSUFFICIENT_COINS` vs `SOLD_OUT` instead of matching message strings.
 * 2. **Single-flight refresh.** Refresh tokens rotate server-side — the presented
 *    one is revoked on use — so two concurrent refreshes would log the user out.
 *    On a 401 the first caller refreshes and everyone else waits on that promise.
 * 3. **Timeouts.** A phone on a dead network otherwise hangs a screen forever.
 */

import Constants from "expo-constants";

import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "./tokens";

const DEFAULT_TIMEOUT_MS = 15000;

function resolveBaseUrl(): string {
  // `process` does not exist in the browser, so it is guarded rather than read.
  const fromEnv =
    typeof process !== "undefined" ? process.env?.EXPO_PUBLIC_API_BASE_URL : undefined;
  const configured =
    (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ?? fromEnv;

  if (configured) return String(configured).replace(/\/$/, "");

  // Web dev runs behind the Vite proxy, so a relative base is same-origin.
  return "";
}

const BASE_URL = resolveBaseUrl();

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** True when retrying later could plausibly succeed. */
  get isTransient(): boolean {
    return this.status === 0 || this.status >= 500 || this.code === "RATE_LIMITED";
  }
}

type SessionLostHandler = () => void;
let onSessionLost: SessionLostHandler = () => {};

export function setSessionLostHandler(handler: SessionLostHandler): void {
  onSessionLost = handler;
}

let refreshInFlight: Promise<boolean> | null = null;

async function runRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${BASE_URL}/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) {
      await clearTokens();
      return false;
    }
    const body = await response.json();
    await saveTokens(body.access_token, body.refresh_token);
    return true;
  } catch {
    // A network blip is not an invalid session: keep the tokens and fail this call.
    return false;
  }
}

function refreshOnce(): Promise<boolean> {
  refreshInFlight ??= runRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Caller-owned cancellation, e.g. a screen unmounting. */
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Skips the Authorization header for the public catalogue. */
  anonymous?: boolean;
  retry?: boolean;
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    query,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    anonymous = false,
    retry = false,
  } = options;

  // A file upload has to go as multipart. The Content-Type is left unset on
  // purpose in that case: fetch generates it along with the boundary token,
  // and a hand-written header would omit the boundary and make the body
  // unparseable at the other end.
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";

  const access = getAccessToken();
  if (!anonymous && access) headers.Authorization = `Bearer ${access}`;

  // Combine the caller's cancellation with our own timeout.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener("abort", abortFromCaller);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (caught) {
    if (signal?.aborted) throw caught;
    throw new ApiError("NETWORK_ERROR", "No connection. Check your network and try again.", 0);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
  }

  if (response.status === 401 && !anonymous && !retry && getRefreshToken()) {
    if (await refreshOnce()) {
      return request<T>(path, { ...options, retry: true });
    }
    onSessionLost();
    throw new ApiError("UNAUTHORIZED", "Your session expired. Sign in again.", 401);
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = payload?.error;
    throw new ApiError(
      detail?.code ?? "ERROR",
      detail?.message ?? `Request failed (${response.status})`,
      response.status,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"], options?: RequestOptions) =>
    request<T>(path, { ...options, query }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};

/**
 * Turn a stored media key into something `Image` can actually fetch.
 *
 * The API returns keys — `avatar/3f2a.png`, `coupon/91bd.jpg` — and the files
 * are served from `{base}/media/{key}`. Screens were passing the raw key
 * straight to `Image`, which silently renders nothing, and the only reason
 * this was not obvious is that a partner pasting a full https link works by
 * accident. Absolute URLs pass through untouched, so both keep working.
 */
export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^(https?:|data:|file:|content:|ph:)/.test(path)) return path;
  return `${BASE_URL}/media/${path.replace(/^\/+/, "")}`;
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
