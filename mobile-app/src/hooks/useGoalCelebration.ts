/**
 * Fires the goal-reached screen once on the day the goal is crossed.
 *
 * Keyed by local date, so it can fire again tomorrow but not twice today —
 * including across a restart, which is why the mark is persisted rather than
 * held in state. Steps are read on every resume, so an in-memory flag would
 * re-congratulate on every app switch for the rest of the evening.
 *
 * It also marks the day as already celebrated when the goal is *already* met at
 * the moment this first runs, so installing the app at 9pm on a 12,000-step day
 * does not open on a celebration for something the app did not witness.
 */

import { useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { localDateKey } from "../health/dates";

const KEY = "@stride/goal_celebrated_v1";

export function useGoalCelebration(
  steps: number,
  goal: number,
  onReached: () => void,
): void {
  /** null while storage is still being read. */
  const celebratedFor = useRef<string | null>(null);
  const armed = useRef(false);

  useEffect(() => {
    void (async () => {
      try {
        celebratedFor.current = (await AsyncStorage.getItem(KEY)) ?? "";
      } catch {
        celebratedFor.current = "";
      }
    })();
  }, []);

  useEffect(() => {
    if (celebratedFor.current === null) return;
    if (goal <= 0) return;

    const today = localDateKey(new Date());
    if (celebratedFor.current === today) return;

    // The first reading of the day only arms the check. Without this a cold
    // start already past the goal would celebrate immediately, every launch.
    if (!armed.current) {
      armed.current = true;
      if (steps >= goal) {
        celebratedFor.current = today;
        AsyncStorage.setItem(KEY, today).catch(() => undefined);
      }
      return;
    }

    if (steps >= goal) {
      celebratedFor.current = today;
      AsyncStorage.setItem(KEY, today).catch(() => undefined);
      onReached();
    }
  }, [steps, goal, onReached]);
}
