/**
 * Whether this install has been through the intake questions.
 *
 * Deliberately per-device rather than per-account, and stored separately from
 * `userStats`: the answers themselves live in that object and every one of them
 * has a usable default, so "have we asked?" cannot be inferred from the values.
 * Checking `stepsGoal === 10000` instead would re-ask anyone who genuinely chose
 * ten thousand.
 *
 * `undefined` means "not read yet" and is distinct from `false`, so the caller
 * can hold the splash rather than flashing onboarding at someone who has
 * already finished it.
 */

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@stride/onboarded_v1";

export function useOnboarding(): {
  onboarded: boolean | undefined;
  complete: () => void;
} {
  const [onboarded, setOnboarded] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    void (async () => {
      try {
        setOnboarded((await AsyncStorage.getItem(KEY)) === "1");
      } catch {
        // A storage failure must not lock anyone out of the app; showing the
        // questions again is the harmless direction to fail in.
        setOnboarded(false);
      }
    })();
  }, []);

  const complete = useCallback(() => {
    setOnboarded(true);
    AsyncStorage.setItem(KEY, "1").catch(() => undefined);
  }, []);

  return { onboarded, complete };
}
