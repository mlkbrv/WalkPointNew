/**
 * Web stub for the Health Connect provider.
 *
 * `react-native-health-connect` is Android-only and throws on import elsewhere,
 * so the vite web build needs this. Same `.native.ts` / `.ts` split the token
 * store already uses — the bundler picks by extension and nothing branches on
 * `Platform.OS` at runtime.
 */

import type { DailySteps, ProviderStatus, StepProvider } from "./types";

export const healthConnectProvider: StepProvider = {
  id: "health_connect",
  countsInBackground: false,
  async status(): Promise<ProviderStatus> {
    return "unavailable";
  },
  async request(): Promise<boolean> {
    return false;
  },
  async readToday(): Promise<number> {
    return 0;
  },
  async readDays(): Promise<DailySteps[]> {
    return [];
  },
};
