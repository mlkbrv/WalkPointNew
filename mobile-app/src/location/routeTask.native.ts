/**
 * The background location task, and the buffer it writes into.
 *
 * This has to live at module scope, imported for its side effect before any
 * component mounts: `TaskManager.defineTask` must have run by the time the OS
 * hands a location batch back, which can happen after the JS context is
 * recreated with no React tree at all. Defining it inside a hook would work
 * until exactly the case it exists for.
 *
 * Because the task can run without React, it cannot set state. It appends to a
 * module-level buffer and notifies subscribers; the hook reads from there.
 *
 * Why a foreground service rather than `ACCESS_BACKGROUND_LOCATION`: the
 * background permission requires a Play Console declaration and a
 * human-reviewed demo video, and walking apps are routinely refused. A
 * foreground service started while the app is open keeps GPS alive with the
 * screen off, needs no such review, and shows a persistent notification — which
 * is the honest way to tell someone their location is being recorded.
 */

import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { haversineMetres, type Point } from "../utils/geo";

export const ROUTE_TASK = "stride-route-recording";

/** A fix worse than this is noise, not a position. */
const MAX_ACCURACY_M = 30;
/** Faster than this between fixes is a vehicle or a GPS jump, not a walk. */
const MAX_SPEED_MS = 8;
/** A runaway session must not exhaust memory. */
const MAX_POINTS = 20_000;

interface Buffer {
  coordinates: Point[];
  /** Seconds from the first accepted fix. */
  t: number[];
  metres: number;
  startedAt: number;
  last: { point: Point; at: number } | null;
}

let buffer: Buffer = emptyBuffer();
const listeners = new Set<() => void>();

function emptyBuffer(): Buffer {
  return { coordinates: [], t: [], metres: 0, startedAt: 0, last: null };
}

export function resetRouteBuffer(): void {
  buffer = emptyBuffer();
  buffer.startedAt = Date.now();
  listeners.forEach((fn) => fn());
}

export function readRouteBuffer(): {
  coordinates: Point[];
  t: number[];
  distanceKm: number;
} {
  return {
    coordinates: buffer.coordinates,
    t: buffer.t,
    distanceKm: Number((buffer.metres / 1000).toFixed(3)),
  };
}

export function subscribeToRoute(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Accept or reject one fix. Exported so the filtering can be tested directly. */
export function ingestFix(
  point: Point,
  at: number,
  accuracy: number | null | undefined,
): boolean {
  if (accuracy != null && accuracy > MAX_ACCURACY_M) return false;
  if (buffer.coordinates.length >= MAX_POINTS) return false;
  if (buffer.startedAt === 0) buffer.startedAt = at;

  if (buffer.last) {
    const gapSeconds = Math.max(0.001, (at - buffer.last.at) / 1000);
    const step = haversineMetres(buffer.last.point, point);
    if (step / gapSeconds > MAX_SPEED_MS) return false;
    buffer.metres += step;
  }

  buffer.last = { point, at };
  buffer.coordinates.push(point);
  buffer.t.push(Math.round((at - buffer.startedAt) / 1000));
  listeners.forEach((fn) => fn());
  return true;
}

TaskManager.defineTask(ROUTE_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  for (const fix of locations ?? []) {
    ingestFix(
      [fix.coords.longitude, fix.coords.latitude],
      fix.timestamp || Date.now(),
      fix.coords.accuracy,
    );
  }
});
