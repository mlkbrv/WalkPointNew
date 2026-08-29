import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { Pedometer } from "expo-sensors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

export type HealthStatus = "checking" | "available" | "unavailable" | "denied";

type HealthContextValue = {
  status: HealthStatus;
  /** Steps recorded by the device today. The only source there is. */
  stepsToday: number;
  isTracking: boolean;
  needsPermission: boolean;
  needsHealthConnectWall: boolean;
  healthConnectReady: boolean;
  hydrated: boolean;
  permissionMessage: string;
  refreshAvailability: () => Promise<boolean>;
  requestPermissions: () => Promise<boolean>;
  connectHealthConnect: () => Promise<boolean>;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  syncRealStepsNow: () => Promise<number>;
};

const HC_GATE_KEY = "@stride/health_connect_gate_v1";
const HealthContext = createContext<HealthContextValue | null>(null);

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<HealthStatus>("checking");
  const [stepsToday, setStepsToday] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [healthConnectReady, setHealthConnectReady] = useState(Platform.OS !== "android");
  const subRef = useRef<{ remove: () => void } | null>(null);
  const sessionBaseRef = useRef(0);

  const needsPermission = status === "denied" || status === "unavailable";
  const needsHealthConnectWall = Platform.OS === "android" && hydrated && !healthConnectReady;

  const stopTracking = useCallback(() => {
    subRef.current?.remove();
    subRef.current = null;
    setIsTracking(false);
  }, []);

  const markHealthConnectReady = useCallback(async (ready: boolean) => {
    setHealthConnectReady(ready);
    if (Platform.OS === "android") {
      await AsyncStorage.setItem(HC_GATE_KEY, JSON.stringify({ ready }));
    }
  }, []);

  const refreshAvailability = useCallback(async () => {
    try {
      const available = await Pedometer.isAvailableAsync();
      if (!available) {
        setStatus("unavailable");
        setPermissionMessage(
          Platform.OS === "ios"
            ? "Motion & Fitness unavailable. Enable it in Settings."
            : "Health Connect / step sensors unavailable. Install Health Connect and allow Steps."
        );
        if (Platform.OS === "android") await markHealthConnectReady(false);
        return false;
      }
      setStatus((prev) => (prev === "denied" ? prev : "available"));
      setPermissionMessage(
        Platform.OS === "android"
          ? "Grant Health Connect Steps access to continue."
          : "Pedometer ready. Grant activity permission to sync live steps."
      );
      return true;
    } catch {
      setStatus("unavailable");
      setPermissionMessage("Unable to access motion sensors.");
      if (Platform.OS === "android") await markHealthConnectReady(false);
      return false;
    }
  }, [markHealthConnectReady]);

  const syncRealStepsNow = useCallback(async () => {
    try {
      const available = await Pedometer.isAvailableAsync();
      if (!available) {
        setStatus("unavailable");
        setStepsToday(0);
        if (Platform.OS === "android") await markHealthConnectReady(false);
        return 0;
      }
      if (Platform.OS === "android") {
        const end = new Date();
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        try {
          const result = await Pedometer.getStepCountAsync(start, end);
          const steps = Math.max(0, result.steps || 0);
          sessionBaseRef.current = steps;
          setStepsToday(steps);
        } catch {
          sessionBaseRef.current = 0;
          setStepsToday(0);
        }
        setStatus("available");
        return sessionBaseRef.current;
      }
      const end = new Date();
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const result = await Pedometer.getStepCountAsync(start, end);
      const steps = Math.max(0, result.steps || 0);
      sessionBaseRef.current = steps;
      setStepsToday(steps);
      setStatus("available");
      return steps;
    } catch {
      setStatus("denied");
      setPermissionMessage(
        Platform.OS === "android"
          ? "Permission denied. Open Health Connect → App permissions → allow STRIDE Steps."
          : "Permission denied. Settings → Privacy → Motion & Fitness → enable STRIDE."
      );
      setStepsToday(0);
      if (Platform.OS === "android") await markHealthConnectReady(false);
      return 0;
    }
  }, [markHealthConnectReady]);

  const requestPermissions = useCallback(async () => {
    const available = await refreshAvailability();
    if (!available) return false;
    try {
      const perm = await Pedometer.requestPermissionsAsync();
      if (perm.status !== "granted") {
        setStatus("denied");
        setPermissionMessage(
          Platform.OS === "android"
            ? "Steps permission denied. Enable Health Connect Steps for STRIDE."
            : "Motion permission denied."
        );
        if (Platform.OS === "android") await markHealthConnectReady(false);
        return false;
      }
    } catch {
      setStatus("denied");
      if (Platform.OS === "android") await markHealthConnectReady(false);
      return false;
    }
    await syncRealStepsNow();
    setStatus("available");
    if (Platform.OS === "android") await markHealthConnectReady(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return true;
  }, [refreshAvailability, syncRealStepsNow, markHealthConnectReady]);

  const startTracking = useCallback(async () => {
    stopTracking();
    if (Platform.OS === "android" && !healthConnectReady) {
      setIsTracking(false);
      return;
    }
    const steps = await syncRealStepsNow();
    try {
      const available = await Pedometer.isAvailableAsync();
      if (!available) {
        setStatus("unavailable");
        setIsTracking(false);
        if (Platform.OS === "android") await markHealthConnectReady(false);
        return;
      }
      sessionBaseRef.current = steps;
      subRef.current = Pedometer.watchStepCount((result) => {
        setStepsToday(sessionBaseRef.current + Math.max(0, result.steps || 0));
      });
      setIsTracking(true);
      setStatus("available");
    } catch {
      setStatus("denied");
      setIsTracking(false);
      if (Platform.OS === "android") await markHealthConnectReady(false);
    }
  }, [stopTracking, syncRealStepsNow, healthConnectReady, markHealthConnectReady]);

  const connectHealthConnect = useCallback(async () => {
    if (Platform.OS !== "android") return true;
    const ok = await requestPermissions();
    if (!ok) return false;
    stopTracking();
    const steps = await syncRealStepsNow();
    try {
      const available = await Pedometer.isAvailableAsync();
      if (!available) {
        setStatus("unavailable");
        await markHealthConnectReady(false);
        return false;
      }
      sessionBaseRef.current = steps;
      subRef.current = Pedometer.watchStepCount((result) => {
        setStepsToday(sessionBaseRef.current + Math.max(0, result.steps || 0));
      });
      setIsTracking(true);
      setStatus("available");
      return true;
    } catch {
      setStatus("denied");
      await markHealthConnectReady(false);
      return false;
    }
  }, [requestPermissions, stopTracking, syncRealStepsNow, markHealthConnectReady]);

  useEffect(() => {
    (async () => {
      try {
        const rawGate = await AsyncStorage.getItem(HC_GATE_KEY);
        if (Platform.OS === "android") {
          let gateReady = false;
          if (rawGate) {
            try {
              gateReady = !!JSON.parse(rawGate).ready;
            } catch {
              gateReady = false;
            }
          }
          setHealthConnectReady(gateReady);
          await refreshAvailability();
          if (gateReady) {
            const perm = await Pedometer.getPermissionsAsync();
            if (perm.status !== "granted") {
              setHealthConnectReady(false);
              await AsyncStorage.setItem(HC_GATE_KEY, JSON.stringify({ ready: false }));
            } else {
              await syncRealStepsNow();
            }
          }
        } else {
          setHealthConnectReady(true);
          await refreshAvailability();
          await syncRealStepsNow();
        }
      } finally {
        setHydrated(true);
      }
    })();
    return () => stopTracking();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (Platform.OS === "android" && !healthConnectReady) {
      stopTracking();
      return;
    }
    startTracking();
    // `startTracking` is recreated whenever tracking state moves; depending on it
    // here would restart the subscription in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, healthConnectReady]);

  const value = useMemo(
    () => ({
      status,
      stepsToday,
      isTracking,
      needsPermission,
      needsHealthConnectWall,
      healthConnectReady,
      hydrated,
      permissionMessage,
      refreshAvailability,
      requestPermissions,
      connectHealthConnect,
      startTracking,
      stopTracking,
      syncRealStepsNow,
    }),
    [
      status,
      stepsToday,
      isTracking,
      needsPermission,
      needsHealthConnectWall,
      healthConnectReady,
      hydrated,
      permissionMessage,
      refreshAvailability,
      requestPermissions,
      connectHealthConnect,
      startTracking,
      stopTracking,
      syncRealStepsNow,
    ]
  );

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealth() {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error("useHealth must be used within HealthProvider");
  return ctx;
}
