/**
 * Keeps the server's step total current.
 *
 * A thin React wrapper over `syncStepsOnce`, which is deliberately
 * context-free so the same code can run from a headless background task.
 *
 * The interesting change from the previous version is what it no longer does.
 * It used to read a local step counter that reset whenever the app restarted,
 * and post it with a hardcoded `source: "health_connect"` regardless of where
 * the number came from. Now the provider reports its own identity, and — for
 * sources that count in the background — the last few days are re-sent, because
 * days can accumulate while the app is closed. `/v1/steps/sync` is idempotent
 * per `(user, date)`, so re-sending a recorded day awards nothing twice.
 */

import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useAuth } from "../contexts/AuthContext";
import { useHealth } from "../contexts/HealthContext";
import { useServerData } from "../contexts/ServerDataContext";
import { syncStepsOnce } from "../health/syncSteps";

/** Never sync more often than this, however many times the app is resumed. */
const MIN_INTERVAL_MS = 60_000;

export function useStepSync(): void {
  const { user } = useAuth();
  const { status, stepsToday } = useHealth();
  const { refreshWallet } = useServerData();

  const lastRunAt = useRef(0);
  const lastSentSteps = useRef(-1);
  const inFlight = useRef(false);

  const sync = useCallback(
    async (force = false) => {
      if (!user || status !== "ready" || inFlight.current) return;
      if (!force && Date.now() - lastRunAt.current < MIN_INTERVAL_MS) return;

      inFlight.current = true;
      lastRunAt.current = Date.now();
      try {
        const outcome = await syncStepsOnce();
        // The balance only moves when the step count did.
        if (outcome.synced && outcome.steps !== lastSentSteps.current) {
          lastSentSteps.current = outcome.steps;
          void refreshWallet();
        }
      } catch {
        // A failed sync is retried on the next resume; steps are not lost,
        // because the device keeps the total, not this app.
      } finally {
        inFlight.current = false;
      }
    },
    [user, status, refreshWallet],
  );

  useEffect(() => {
    void sync();
  }, [sync, stepsToday]);

  // Resuming is the moment the provider has news: it counted while we were away.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void sync(true);
    });
    return () => subscription.remove();
  }, [sync]);
}
