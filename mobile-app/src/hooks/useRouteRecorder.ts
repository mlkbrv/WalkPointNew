/**
 * Web stub. `expo-location` has a web implementation, but the vite build has no
 * business asking for a browser geolocation prompt, and the Track screen's map
 * is native-only anyway. Same `.native.ts` / `.ts` split used elsewhere.
 */

import type { Point } from "../utils/geo";

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
  return {
    recording: false,
    points: [],
    distanceKm: 0,
    error: null,
    async start() {
      return false;
    },
    async stop() {
      return null;
    },
  };
}
