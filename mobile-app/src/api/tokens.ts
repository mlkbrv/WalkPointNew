/**
 * The JWT pair, read and written through the platform's own storage.
 *
 * Device builds land in Keychain / Keystore via `tokenStore.native.ts`; the web
 * build falls back to AsyncStorage. Nothing here branches on platform — the
 * bundler picks the implementation by file extension.
 */

import store from "./tokenStore";

const ACCESS_KEY = "stride.access_token";
const REFRESH_KEY = "stride.refresh_token";

/**
 * Cached in memory so the request path does not await storage on every call.
 * Storage stays the source of truth across restarts; this is only a read cache.
 */
let cachedAccess: string | null = null;
let cachedRefresh: string | null = null;
let hydrated = false;

export async function hydrateTokens(): Promise<void> {
  if (hydrated) return;
  const [access, refresh] = await Promise.all([store.get(ACCESS_KEY), store.get(REFRESH_KEY)]);
  cachedAccess = access;
  cachedRefresh = refresh;
  hydrated = true;
}

export function getAccessToken(): string | null {
  return cachedAccess;
}

export function getRefreshToken(): string | null {
  return cachedRefresh;
}

export async function saveTokens(access: string, refresh: string): Promise<void> {
  cachedAccess = access;
  cachedRefresh = refresh;
  hydrated = true;
  await Promise.all([store.set(ACCESS_KEY, access), store.set(REFRESH_KEY, refresh)]);
}

export async function clearTokens(): Promise<void> {
  cachedAccess = null;
  cachedRefresh = null;
  hydrated = true;
  await Promise.all([store.remove(ACCESS_KEY), store.remove(REFRESH_KEY)]);
}
