/**
 * Where the device is, for centring a map that has no route to show yet.
 *
 * Checks the permission without asking for it. The Track tab opens straight
 * onto a map, and a system dialog fired by merely looking at a screen is the
 * kind of prompt people deny out of reflex — after which the map is worse off
 * than before. So the permission is requested only when someone taps the
 * locate button, which is an unambiguous request to be located.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

import type { Point } from "../utils/geo";

type DeviceLocation = {
  /** `[lng, lat]`, the order MapLibre wants — not the `latitude, longitude` Expo returns. */
  point: Point | null;
  granted: boolean;
  locating: boolean;
  /** Ask for the permission if needed, then fix a position. */
  locate: () => Promise<void>;
};

function toPoint(position: Location.LocationObject): Point {
  return [position.coords.longitude, position.coords.latitude];
}

export function useDeviceLocation(): DeviceLocation {
  const [point, setPoint] = useState<Point | null>(null);
  const [granted, setGranted] = useState(false);
  const [locating, setLocating] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** The last known fix first: it returns immediately, where a fresh one can
   *  take several seconds under a roof, leaving the map on empty ocean. */
  const settle = useCallback(async () => {
    const known = await Location.getLastKnownPositionAsync();
    if (known && alive.current) setPoint(toPoint(known));

    const fresh = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    if (alive.current) setPoint(toPoint(fresh));
  }, []);

  useEffect(() => {
    void (async () => {
      const status = await Location.getForegroundPermissionsAsync();
      if (!status.granted || !alive.current) return;
      setGranted(true);
      try {
        await settle();
      } catch {
        // No fix available. The map stays where it is rather than jumping.
      }
    })();
  }, [settle]);

  const locate = useCallback(async () => {
    setLocating(true);
    try {
      const status = await Location.requestForegroundPermissionsAsync();
      if (!status.granted) return;
      if (alive.current) setGranted(true);
      await settle();
    } catch {
      // Denied, or no fix. Silent: the button simply does not move the map.
    } finally {
      if (alive.current) setLocating(false);
    }
  }, [settle]);

  return { point, granted, locating, locate };
}
