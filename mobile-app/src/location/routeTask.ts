/** Web stub: there is no background location task in a browser tab. */

import type { Point } from "../utils/geo";

export const ROUTE_TASK = "stride-route-recording";

export function resetRouteBuffer(): void {}

export function readRouteBuffer(): {
  coordinates: Point[];
  t: number[];
  distanceKm: number;
} {
  return { coordinates: [], t: [], distanceKm: 0 };
}

export function subscribeToRoute(_fn: () => void): () => void {
  return () => {};
}
