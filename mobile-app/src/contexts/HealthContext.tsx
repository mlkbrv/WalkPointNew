/**
 * Where step counts come from.
 *
 * This used to claim Health Connect and deliver something else. The only source
 * was `expo-sensors`, whose `getStepCountAsync` throws unconditionally on
 * Android — so the daily baseline was permanently zero and `stepsToday` was
 * really "steps since the JS subscription attached". Killing the app reset the
 * day to nothing, steps taken while it was closed were never counted, and the
 * server was told `source: "health_connect"` regardless. A "Health Connect
 * required" wall gated the whole app on an AsyncStorage boolean that the
 * ACTIVITY_RECOGNITION dialog flipped.
 *
 * Now a provider is resolved (`src/health/provider.ts`), its own permission
 * state is the source of truth, and whichever source is actually in use is
 * named to the server on every sync.
 *
 * There is no manual on/off switch any more. Counting is passive: the system
 * accumulates steps and the app reads the total. A switch that silently stopped
 * counting was a way to lose data, not a feature.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState } from "react-native";

import { resolveProvider, type ProviderStatus, type StepProvider } from "../health/provider";

type HealthContextValue = {
  /** Steps today, from whichever source is in use. */
  stepsToday: number;
  provider: StepProvider | null;
  status: ProviderStatus;
  /** True once the first resolution has finished. */
  hydrated: boolean;
  /**
   * Android only: Health Connect is unavailable and the raw sensor is standing
   * in, so steps are counted only while the app is open. Screens should say so.
   */
  degraded: boolean;
  /** Whether this source keeps counting with the app closed. */
  countsInBackground: boolean;
  needsPermission: boolean;
  requestPermission: () => Promise<boolean>;
  openSettings: () => Promise<void>;
  refresh: () => Promise<void>;
};

const HealthContext = createContext<HealthContextValue | null>(null);

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProvider] = useState<StepProvider | null>(null);
  const [status, setStatus] = useState<ProviderStatus>("unavailable");
  const [degraded, setDegraded] = useState(false);
  const [stepsToday, setStepsToday] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    const resolved = await resolveProvider();
    setProvider(resolved.provider);
    setStatus(resolved.status);
    setDegraded(resolved.degraded);

    if (resolved.status === "ready") {
      try {
        setStepsToday(await resolved.provider.readToday());
      } catch {
        // A read that fails leaves the previous total rather than showing 0,
        // which would look like the user undid a day's walking.
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Returning to the app is the moment the accumulated total is worth re-reading:
  // Health Connect and Core Motion both counted while we were away.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const requestPermission = useCallback(async () => {
    if (!provider) return false;
    const granted = await provider.request();
    await refresh();
    return granted;
  }, [provider, refresh]);

  const openSettings = useCallback(async () => {
    await provider?.openSettings?.();
  }, [provider]);

  const value = useMemo<HealthContextValue>(
    () => ({
      stepsToday,
      provider,
      status,
      hydrated,
      degraded,
      countsInBackground: provider?.countsInBackground ?? false,
      needsPermission: status === "needs_permission",
      requestPermission,
      openSettings,
      refresh,
    }),
    [stepsToday, provider, status, hydrated, degraded, requestPermission, openSettings, refresh],
  );

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealth() {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error("useHealth must be used within HealthProvider");
  return ctx;
}
