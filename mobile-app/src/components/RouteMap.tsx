/**
 * Web build: no basemap, just the route's shape.
 *
 * MapLibre's React Native binding is a native module with no web
 * implementation — importing it here would break the web bundle outright, the
 * same way `react-native-pager-view` silently took the whole tab bar out. The
 * native map lives in `RouteMap.native.tsx`; the bundler picks by extension and
 * nothing branches on `Platform.OS` at runtime.
 *
 * Falling back to `RouteTrace` rather than an empty box: the shape of the walk
 * is the part that carries information, and it is the same drawing this screen
 * showed before there was a map at all.
 */

import { RouteTrace } from "./RouteTrace";
import type { Point } from "../utils/geo";

export function RouteMap({
  points,
  height = 260,
}: {
  points: Point[];
  height?: number;
  /** Accepted for parity with the native map, unused here — there is no
   *  basemap to move and nothing to centre on. */
  follow?: boolean;
  center?: Point | null;
  onLocate?: () => void;
  locating?: boolean;
}) {
  return <RouteTrace points={points} height={height} />;
}
