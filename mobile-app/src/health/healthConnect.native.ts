/**
 * Android Health Connect.
 *
 * The system counts steps whether or not STRIDE is running, so this provider
 * only has to *read* an accumulated total. That is why no background service is
 * needed: one read when the app comes back to the foreground recovers every
 * step taken while it was closed.
 *
 * Two things here are easy to get wrong and are the reason for the comments:
 *
 * 1. **Aggregate, never `readRecords`.** A phone, a watch and a third-party app
 *    can all write overlapping Steps records. `aggregateRecord` de-duplicates
 *    them; reading raw records and summing double-counts the overlap.
 * 2. **The permission dialog only appears twice.** After two refusals
 *    `requestPermission` resolves with an empty array and shows nothing at all.
 *    Calling it a third time looks like a broken button, so callers get `false`
 *    and should offer `openSettings()` instead.
 */

import {
  aggregateGroupByPeriod,
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  requestPermission,
  SdkAvailabilityStatus,
} from "react-native-health-connect";

import { localDateKey, localIso, localMidnight } from "./dates";
import type { DailySteps, ProviderStatus, StepProvider } from "./types";

const STEPS_PERMISSION = { accessType: "read", recordType: "Steps" } as const;

/** Health Connect stops showing its dialog after this many asks. */
const MAX_PROMPTS = 2;

let initialised = false;
let prompts = 0;

async function ensureInitialised(): Promise<boolean> {
  if (initialised) return true;
  try {
    initialised = await initialize();
    return initialised;
  } catch {
    return false;
  }
}

async function hasStepsPermission(): Promise<boolean> {
  try {
    const granted = await getGrantedPermissions();
    return granted.some((p) => p.recordType === "Steps" && p.accessType === "read");
  } catch {
    return false;
  }
}

export const healthConnectProvider: StepProvider = {
  id: "health_connect",
  countsInBackground: true,

  async status(): Promise<ProviderStatus> {
    let sdk: number;
    try {
      sdk = await getSdkStatus();
    } catch {
      return "unavailable";
    }

    if (sdk === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return "needs_update";
    }
    if (sdk !== SdkAvailabilityStatus.SDK_AVAILABLE) return "unavailable";
    if (!(await ensureInitialised())) return "unavailable";

    // The granted set is the source of truth, re-read every launch. The app
    // used to keep its own AsyncStorage flag for this, which drifted the moment
    // a user changed the permission from system settings.
    return (await hasStepsPermission()) ? "ready" : "needs_permission";
  },

  async request(): Promise<boolean> {
    if (!(await ensureInitialised())) return false;
    if (await hasStepsPermission()) return true;

    if (prompts >= MAX_PROMPTS) return false;
    prompts += 1;

    try {
      const granted = await requestPermission([STEPS_PERMISSION]);
      return granted.some((p) => p.recordType === "Steps");
    } catch {
      return false;
    }
  },

  async readToday(): Promise<number> {
    if (!(await ensureInitialised())) return 0;
    const result = await aggregateRecord({
      recordType: "Steps",
      timeRangeFilter: {
        operator: "between",
        startTime: localIso(localMidnight()),
        endTime: localIso(new Date()),
      },
    });
    return result.COUNT_TOTAL ?? 0;
  },

  async readDays(days: number): Promise<DailySteps[]> {
    if (!(await ensureInitialised())) return [];

    const buckets = await aggregateGroupByPeriod({
      recordType: "Steps",
      timeRangeFilter: {
        operator: "between",
        startTime: localIso(localMidnight(-(days - 1))),
        endTime: localIso(new Date()),
      },
      timeRangeSlicer: { period: "DAYS", length: 1 },
    });

    return buckets.map((bucket) => ({
      // The bucket boundary is already local midnight, so its date is the day.
      date: localDateKey(new Date(bucket.startTime)),
      steps: bucket.result.COUNT_TOTAL ?? 0,
    }));
  },

  async openSettings(): Promise<void> {
    await openHealthConnectSettings();
  },
};
