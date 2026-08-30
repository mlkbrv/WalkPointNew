/**
 * The raw step-counter sensor, via `expo-sensors`.
 *
 * Two very different roles depending on platform, and the difference is not
 * cosmetic:
 *
 * * **iOS** — backed by `CMPedometer`, which counts in the background and can be
 *   queried for a past range. That is a real source, not a degraded one.
 * * **Android** — `getStepCountAsync` throws `NotSupportedException`
 *   unconditionally, so there is no history and no baseline: all this can offer
 *   is a live subscription that starts at zero when the app opens. Steps taken
 *   while the app is closed are lost. It exists only as the fallback when
 *   Health Connect is missing, and the UI has to say so.
 */

import { Platform } from "react-native";
import { Pedometer } from "expo-sensors";

import { localDateKey, localMidnight } from "./dates";
import type { DailySteps, ProviderStatus, StepProvider } from "./types";

const isIOS = Platform.OS === "ios";

/** Steps seen since this process subscribed. Android's only possible answer. */
let sessionSteps = 0;
let subscription: { remove: () => void } | null = null;

function subscribe(): void {
  if (subscription) return;
  subscription = Pedometer.watchStepCount((result) => {
    sessionSteps = Math.max(0, result.steps || 0);
  });
}

export function stopPedometer(): void {
  subscription?.remove();
  subscription = null;
}

export const pedometerProvider: StepProvider = {
  id: isIOS ? "core_motion" : "pedometer_foreground",
  countsInBackground: isIOS,

  async status(): Promise<ProviderStatus> {
    try {
      if (!(await Pedometer.isAvailableAsync())) return "unavailable";
    } catch {
      return "unavailable";
    }
    try {
      const perm = await Pedometer.getPermissionsAsync();
      return perm.granted ? "ready" : "needs_permission";
    } catch {
      return "needs_permission";
    }
  },

  async request(): Promise<boolean> {
    try {
      const perm = await Pedometer.requestPermissionsAsync();
      if (perm.status !== "granted") return false;
      if (!isIOS) subscribe();
      return true;
    } catch {
      return false;
    }
  },

  async readToday(): Promise<number> {
    if (isIOS) {
      try {
        const result = await Pedometer.getStepCountAsync(localMidnight(), new Date());
        return Math.max(0, result.steps || 0);
      } catch {
        return 0;
      }
    }
    // Android: never call getStepCountAsync — it throws on every device.
    subscribe();
    return sessionSteps;
  },

  async readDays(days: number): Promise<DailySteps[]> {
    if (!isIOS) {
      // No history exists on Android through this API. Reporting only today is
      // honest; inventing the other days would not be.
      return [{ date: localDateKey(new Date()), steps: sessionSteps }];
    }

    const out: DailySteps[] = [];
    for (let offset = days - 1; offset >= 0; offset--) {
      const start = localMidnight(-offset);
      const end = offset === 0 ? new Date() : localMidnight(-(offset - 1));
      try {
        const result = await Pedometer.getStepCountAsync(start, end);
        out.push({ date: localDateKey(start), steps: Math.max(0, result.steps || 0) });
      } catch {
        // A day the system cannot answer for is skipped, not zeroed: a zero
        // would be uploaded and would look like a day with no walking.
      }
    }
    return out;
  },
};
