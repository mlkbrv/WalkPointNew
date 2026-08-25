/**
 * A workout session, backed by the server.
 *
 * The screen needs a metric that ticks every second; the server needs a durable
 * record that survives the app being killed mid-run. This hook keeps both in step:
 *
 * * **The server owns the session.** Starting opens a row and we hold its id.
 *   Reopening the app adopts whatever session is still running rather than
 *   starting a second one.
 * * **The tick is local, the truth is remote.** Metrics advance locally each
 *   second so the HUD is smooth, and are pushed in a batch every
 *   `PUSH_EVERY_SECONDS` — one request a minute instead of one a second.
 * * **The bonus is never computed here.** `finish` returns what the server paid,
 *   including zero when the session was flagged as implausible. The client
 *   displays that number; it does not predict it.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { describeError } from "../api/client";
import { workoutsApi, type ApiWorkout } from "../api/endpoints";

/** How often local progress is written back. A run is long; the network is not free. */
const PUSH_EVERY_SECONDS = 60;

export interface LiveMetrics {
  durationSeconds: number;
  distanceKm: number;
  caloriesKcal: number;
  avgSpeedKmH: number;
  routeCoordinates: { x: number; y: number }[];
}

export interface FinishResult {
  coinsAwarded: number;
  balance: number;
  workout: ApiWorkout;
}

const ZERO: LiveMetrics = {
  durationSeconds: 0,
  distanceKm: 0,
  caloriesKcal: 0,
  avgSpeedKmH: 0,
  routeCoordinates: [{ x: 150, y: 300 }],
};

function metricsFrom(workout: ApiWorkout): LiveMetrics {
  const hours = workout.duration_seconds / 3600;
  return {
    durationSeconds: workout.duration_seconds,
    distanceKm: workout.distance_km,
    caloriesKcal: workout.calories_kcal,
    avgSpeedKmH: hours > 0 ? Number((workout.distance_km / hours).toFixed(1)) : 0,
    routeCoordinates: [{ x: 150, y: 300 }],
  };
}

export function useWorkoutSession() {
  const [workout, setWorkout] = useState<ApiWorkout | null>(null);
  const [metrics, setMetrics] = useState<LiveMetrics>(ZERO);
  const [isPaused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Read by the push effect without making it a dependency, which would restart the timer. */
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  const isActive = workout !== null && !workout.is_finished;

  // Adopt a session left running by a previous launch.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const open = await workoutsApi.active();
        if (!cancelled && open) {
          setWorkout(open);
          setMetrics(metricsFrom(open));
          // It was running when we lost it, so keep it paused until the user resumes.
          setPaused(true);
        }
      } catch {
        // Nothing to adopt is the normal case; a failure here is not worth showing.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The per-second tick that feeds the HUD.
  useEffect(() => {
    if (!isActive || isPaused) return;

    tickRef.current = setInterval(() => {
      setMetrics((prev) => {
        const durationSeconds = prev.durationSeconds + 1;
        const distanceKm = Number((prev.distanceKm + 0.002).toFixed(3));
        const hours = durationSeconds / 3600;
        const last = prev.routeCoordinates[prev.routeCoordinates.length - 1] ?? { x: 150, y: 300 };
        const route = [
          ...prev.routeCoordinates,
          { x: last.x + (Math.random() - 0.45) * 5, y: last.y + (Math.random() - 0.45) * 5 },
        ];
        if (route.length > 50) route.shift();

        return {
          durationSeconds,
          distanceKm,
          caloriesKcal: Math.floor(prev.caloriesKcal + 0.15),
          avgSpeedKmH: hours > 0 ? Number((distanceKm / hours).toFixed(1)) : 0,
          routeCoordinates: route,
        };
      });
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [isActive, isPaused]);

  // Periodic write-back, so a crash mid-run loses at most one interval.
  useEffect(() => {
    if (!isActive || isPaused || !workout) return;

    const push = setInterval(() => {
      const live = metricsRef.current;
      void workoutsApi
        .progress(workout.id, {
          duration_seconds: live.durationSeconds,
          distance_km: live.distanceKm,
          calories_kcal: live.caloriesKcal,
        })
        // The server only ever moves values forward, so a dropped push self-heals
        // on the next one — no retry queue needed.
        .catch(() => undefined);
    }, PUSH_EVERY_SECONDS * 1000);

    return () => clearInterval(push);
  }, [isActive, isPaused, workout]);

  const start = useCallback(async (kind = "walk") => {
    setBusy(true);
    setError(null);
    try {
      const opened = await workoutsApi.start(kind);
      setWorkout(opened);
      // An already-open session comes back here; keep its progress rather than zeroing it.
      setMetrics(opened.duration_seconds > 0 ? metricsFrom(opened) : ZERO);
      setPaused(false);
      return true;
    } catch (caught) {
      setError(describeError(caught));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const togglePause = useCallback(() => setPaused((paused) => !paused), []);

  const finish = useCallback(async (): Promise<FinishResult | null> => {
    if (!workout) return null;
    setBusy(true);
    setError(null);
    try {
      const live = metricsRef.current;
      const result = await workoutsApi.finish(workout.id, {
        duration_seconds: live.durationSeconds,
        distance_km: live.distanceKm,
        calories_kcal: live.caloriesKcal,
        steps: Math.floor(live.distanceKm * 1400),
      });
      setWorkout(null);
      setMetrics(ZERO);
      setPaused(false);
      return {
        coinsAwarded: result.coins_awarded,
        balance: result.balance,
        workout: result.workout,
      };
    } catch (caught) {
      setError(describeError(caught));
      return null;
    } finally {
      setBusy(false);
    }
  }, [workout]);

  return { workout, metrics, isActive, isPaused, busy, error, start, togglePause, finish };
}
