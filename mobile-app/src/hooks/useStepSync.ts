/**
 * Pushes the day's step total to the server.
 *
 * The client reports steps; the server decides coins. Nothing here computes a
 * reward — it reads the pedometer total the app already tracks and posts it, then
 * reports back what the server credited.
 *
 * Syncing is throttled and idempotent by design: `POST /v1/steps/sync` credits the
 * difference between what the day has earned and what it has already been paid, so
 * an extra call costs a round trip and nothing else.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { ApiError } from "../api/client";
import { stepsApi } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { useHealth } from "../contexts/HealthContext";
import { useServerData } from "../contexts/ServerDataContext";

/** Don't sync more often than this, however chatty the pedometer is. */
const MIN_INTERVAL_MS = 60_000;

/** Below this many new steps a sync cannot change the reward, so it is skipped. */
const MIN_STEP_DELTA = 100;

export interface StepSyncState {
  syncing: boolean;
  lastSyncedSteps: number | null;
  lastAwarded: number | null;
  flagged: boolean;
  flagReason: string;
  error: string | null;
}

export function useStepSync() {
  const { user } = useAuth();
  const health = useHealth();
  const { refreshWallet } = useServerData();

  const [state, setState] = useState<StepSyncState>({
    syncing: false,
    lastSyncedSteps: null,
    lastAwarded: null,
    flagged: false,
    flagReason: "",
    error: null,
  });

  const lastSyncAt = useRef(0);
  const lastSentSteps = useRef(0);
  const inFlight = useRef(false);

  const steps = health.stepsToday ?? 0;

  const sync = useCallback(
    async (options: { force?: boolean } = {}) => {
      if (!user || inFlight.current) return;

      const now = Date.now();
      const sinceLast = now - lastSyncAt.current;
      const delta = steps - lastSentSteps.current;

      if (!options.force) {
        if (sinceLast < MIN_INTERVAL_MS) return;
        if (delta < MIN_STEP_DELTA) return;
      }
      if (steps <= 0) return;

      inFlight.current = true;
      setState((current) => ({ ...current, syncing: true, error: null }));

      try {
        const result = await stepsApi.sync(new Date().toISOString().slice(0, 10), steps);
        lastSyncAt.current = Date.now();
        lastSentSteps.current = steps;

        setState({
          syncing: false,
          lastSyncedSteps: result.day.steps,
          lastAwarded: result.coins_awarded,
          flagged: result.is_suspicious,
          flagReason: result.reason,
          error: null,
        });

        // The response carries the new balance, but the wallet screen also shows
        // earned/spent totals, so refresh the whole thing rather than patch one field.
        if (result.coins_awarded > 0) void refreshWallet();
      } catch (caught) {
        setState((current) => ({
          ...current,
          syncing: false,
          error: caught instanceof ApiError ? caught.message : "Could not sync steps.",
        }));
      } finally {
        inFlight.current = false;
      }
    },
    [user, steps, refreshWallet],
  );

  // Sync when the step count moves.
  useEffect(() => {
    void sync();
  }, [sync]);

  // And when the app comes back to the foreground, which is when a day's total
  // has usually jumped while nothing was listening.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void sync({ force: true });
    });
    return () => subscription.remove();
  }, [sync]);

  return { ...state, syncNow: () => sync({ force: true }) };
}
