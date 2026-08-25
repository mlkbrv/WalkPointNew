/**
 * The single place this app talks to the API from.
 *
 * Two things it exists to get right:
 *
 * 1. **The error envelope.** The API always fails as `{"error": {code, message}}`,
 *    so callers get an `ApiError` carrying `code` and can branch on
 *    `INSUFFICIENT_COINS` vs `SOLD_OUT` instead of matching message strings.
 * 2. **Single-flight refresh.** Refresh tokens rotate server-side — the presented
 *    one is revoked on use. Firing two refreshes concurrently would therefore log
 *    the user out. On a 401 the first caller refreshes and everyone else waits on
 *    the same promise, then all replay.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

const ACCESS_KEY = 'stride.admin.access';
const REFRESH_KEY = 'stride.admin.refresh';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/** Fires when the session cannot be recovered, so the app can route to login. */
type SessionLostHandler = () => void;
let onSessionLost: SessionLostHandler = () => {};
export function setSessionLostHandler(handler: SessionLostHandler) {
  onSessionLost = handler;
}

let refreshInFlight: Promise<boolean> | null = null;

async function runRefresh(): Promise<boolean> {
  const refreshToken = tokens.refresh;
  if (!refreshToken) return false;

  const response = await fetch(`${BASE_URL}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    tokens.clear();
    return false;
  }

  const body = await response.json();
  tokens.set(body.access_token, body.refresh_token);
  return true;
}

function refreshOnce(): Promise<boolean> {
  // Everyone who hits a 401 while a refresh is running waits on that same call.
  refreshInFlight ??= runRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Internal: prevents a refreshed request from trying to refresh again. */
  retry?: boolean;
};

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, retry = false } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const access = tokens.access;
  if (access) headers.Authorization = `Bearer ${access}`;

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (response.status === 401 && !retry && tokens.refresh) {
    if (await refreshOnce()) {
      return request<T>(path, { ...options, retry: true });
    }
    onSessionLost();
    throw new ApiError('UNAUTHORIZED', 'Your session expired. Sign in again.', 401);
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = payload?.error;
    throw new ApiError(
      detail?.code ?? 'ERROR',
      detail?.message ?? `Request failed (${response.status})`,
      response.status,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
