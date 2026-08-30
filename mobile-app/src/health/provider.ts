/**
 * Picking the step source, and remembering which one was picked.
 *
 * Health Connect is preferred on Android because it is the only source that
 * counts while the app is closed. When it is missing or refused, the raw
 * pedometer is used and honestly labelled — the app tells the user that steps
 * are only counted while it is open, rather than quietly under-reporting.
 *
 * On iOS the pedometer *is* the good source (`CMPedometer` counts in the
 * background), so there is nothing to fall back from.
 */

import { Platform } from "react-native";

import { healthConnectProvider } from "./healthConnect";
import { pedometerProvider } from "./pedometer";
import type { ProviderStatus, StepProvider } from "./types";

export interface ResolvedProvider {
  provider: StepProvider;
  status: ProviderStatus;
  /** True when Health Connect could be used but is not — worth offering to fix. */
  degraded: boolean;
}

export async function resolveProvider(): Promise<ResolvedProvider> {
  if (Platform.OS !== "android") {
    return {
      provider: pedometerProvider,
      status: await pedometerProvider.status(),
      degraded: false,
    };
  }

  const hcStatus = await healthConnectProvider.status();
  if (hcStatus === "ready" || hcStatus === "needs_permission") {
    return { provider: healthConnectProvider, status: hcStatus, degraded: false };
  }

  // "unavailable" or "needs_update": fall back, but say so.
  return {
    provider: pedometerProvider,
    status: await pedometerProvider.status(),
    degraded: true,
  };
}

export { healthConnectProvider, pedometerProvider };
export type { ProviderStatus, StepProvider } from "./types";
