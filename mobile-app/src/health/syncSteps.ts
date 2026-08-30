/**
 * Read the current step total and send it, with no React involved.
 *
 * Deliberately context-free so it can also run from a headless background task,
 * where there is no component tree to read a context from. `useStepSync` is a
 * thin wrapper over this.
 */

import { stepsApi } from "../api/endpoints";
import { localDateKey } from "./dates";
import { resolveProvider } from "./provider";

export interface SyncOutcome {
  synced: boolean;
  steps: number;
  /** Which source the number came from — this is what the server records. */
  source: string;
}

/**
 * Sync today's steps once.
 *
 * Also uploads the preceding days when the source can supply them, because
 * Health Connect keeps counting while the app is closed: after a few days away
 * the server is missing days the device can still account for. `/v1/steps/sync`
 * is idempotent per `(user, date)`, so re-sending a day already recorded costs
 * nothing and awards nothing twice.
 */
export async function syncStepsOnce(historyDays = 3): Promise<SyncOutcome> {
  const { provider, status } = await resolveProvider();
  if (status !== "ready") {
    return { synced: false, steps: 0, source: provider.id };
  }

  const today = localDateKey(new Date());
  let todaySteps = 0;

  if (provider.countsInBackground && historyDays > 1) {
    const days = await provider.readDays(historyDays);
    for (const day of days) {
      if (day.steps <= 0) continue;
      try {
        await stepsApi.sync(day.date, day.steps, provider.id);
        if (day.date === today) todaySteps = day.steps;
      } catch {
        // One failed day must not abandon the rest; the next sync retries it.
      }
    }
    // A source that reports no bucket for today still has a live total.
    if (todaySteps === 0) {
      todaySteps = await provider.readToday();
      if (todaySteps > 0) {
        await stepsApi.sync(today, todaySteps, provider.id).catch(() => undefined);
      }
    }
  } else {
    todaySteps = await provider.readToday();
    if (todaySteps > 0) {
      await stepsApi.sync(today, todaySteps, provider.id);
    }
  }

  return { synced: todaySteps > 0, steps: todaySteps, source: provider.id };
}
