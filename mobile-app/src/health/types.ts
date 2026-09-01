/**
 * One interface over every way this app can learn how many steps were taken.
 *
 * There are three, and they are genuinely different in what they can promise:
 *
 * * **Health Connect** (Android) — the system keeps the total whether or not
 *   Stepoint is running, so a single read on resume recovers everything missed.
 * * **Core Motion** (iOS) — `CMPedometer` likewise counts in the background and
 *   can be queried for a historical range.
 * * **Foreground pedometer** — the raw step-counter sensor, subscribed to while
 *   the app is open. It is the fallback when Health Connect is absent, and it
 *   is honestly worse: nothing is counted while the app is closed.
 *
 * The `id` travels to the server as `source` on every sync so the data's
 * provenance is recorded rather than assumed. Before this existed the client
 * hardcoded `"health_connect"` regardless of where the number came from.
 */

export type StepSourceId = "health_connect" | "core_motion" | "pedometer_foreground";

export type ProviderStatus =
  /** Ready to read. */
  | "ready"
  /** Installed and available, but the user has not granted step access. */
  | "needs_permission"
  /** Present but too old — Health Connect needs updating from the Play Store. */
  | "needs_update"
  /** Not available on this device at all. */
  | "unavailable";

export interface DailySteps {
  /** `YYYY-MM-DD` in the device's local time. */
  date: string;
  steps: number;
}

export interface StepProvider {
  readonly id: StepSourceId;
  /** True when this source keeps counting with the app closed. */
  readonly countsInBackground: boolean;

  status(): Promise<ProviderStatus>;
  /**
   * Ask for access. Returns whether it was granted.
   *
   * Health Connect only shows its dialog twice; after that it resolves with
   * nothing and no UI, so callers must be prepared for a silent `false` and
   * send the user to settings instead of asking again.
   */
  request(): Promise<boolean>;
  /** Steps since local midnight. */
  readToday(): Promise<number>;
  /** One entry per day, oldest first, for the last `days` days including today. */
  readDays(days: number): Promise<DailySteps[]>;
  /** Opens the system screen where access can be granted, if there is one. */
  openSettings?(): Promise<void>;
}
