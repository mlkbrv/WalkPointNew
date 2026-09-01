/**
 * Starts and stops route recording, and exposes what has been recorded.
 *
 * The recording itself happens in `src/location/routeTask`, outside React,
 * because the OS delivers location batches to a task that can outlive the
 * component tree. This hook only drives it and subscribes to the buffer.
 *
 * Recording is opt-in: steps are counted passively by the system, but GPS costs
 * battery and is location data, so it runs only when switched on — and Android
 * shows a persistent notification for as long as it does.
 */

import { useCallback, useEffect, useState } from "react";
import * as Location from "expo-location";

import {
  ROUTE_TASK,
  readRouteBuffer,
  resetRouteBuffer,
  subscribeToRoute,
} from "../location/routeTask";
import { simplify, type Point } from "../utils/geo";

export interface RecordedRoute {
  coordinates: Point[];
  t: number[];
  distanceKm: number;
}

export interface RouteRecorder {
  recording: boolean;
  points: Point[];
  distanceKm: number;
  error: string | null;
  start: () => Promise<boolean>;
  stop: () => Promise<RecordedRoute | null>;
}

export function useRouteRecorder(): RouteRecorder {
  const [recording, setRecording] = useState(false);
  const [snapshot, setSnapshot] = useState(readRouteBuffer);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeToRoute(() => setSnapshot(readRouteBuffer())), []);

  // A service can outlive the app; on mount, adopt whatever is already running
  // rather than showing "off" while the notification says otherwise.
  useEffect(() => {
    void Location.hasStartedLocationUpdatesAsync(ROUTE_TASK)
      .then(setRecording)
      .catch(() => undefined);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setError("Location access is needed to record a route.");
      return false;
    }

    resetRouteBuffer();
    try {
      await Location.startLocationUpdatesAsync(ROUTE_TASK, {
        accuracy: Location.Accuracy.High,
        distanceInterval: 5,
        timeInterval: 3000,
        // Without this the OS suspends updates as soon as the screen goes off,
        // and a walk recorded with the phone in a pocket would be a few points
        // long. With it, no background-location permission is required.
        foregroundService: {
          notificationTitle: "STRIDE is recording your route",
          notificationBody: "Tap to open. Turn off recording to stop.",
          notificationColor: "#7C3AED",
        },
        pausesUpdatesAutomatically: false,
      });
      setRecording(true);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start recording.");
      return false;
    }
  }, []);

  const stop = useCallback(async (): Promise<RecordedRoute | null> => {
    try {
      if (await Location.hasStartedLocationUpdatesAsync(ROUTE_TASK)) {
        await Location.stopLocationUpdatesAsync(ROUTE_TASK);
      }
    } catch {
      // Already stopped, or the task was never registered.
    }
    setRecording(false);

    const recorded = readRouteBuffer();
    if (recorded.coordinates.length < 2) return null;

    // Thinned for the wire, but the distance is the one measured from every
    // accepted fix — a simplified line is shorter than the walk actually was.
    const thinned = simplify(recorded.coordinates, 5);
    const kept = new Set(thinned.map((p) => `${p[0]},${p[1]}`));
    const t = recorded.t.filter((_, i) => {
      const p = recorded.coordinates[i];
      return p && kept.has(`${p[0]},${p[1]}`);
    });

    return {
      coordinates: thinned,
      t: t.slice(0, thinned.length),
      distanceKm: recorded.distanceKm,
    };
  }, []);

  return {
    recording,
    points: snapshot.coordinates,
    distanceKm: snapshot.distanceKm,
    error,
    start,
    stop,
  };
}
