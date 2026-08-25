import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { Pedometer } from "expo-sensors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

export type HealthStatus = "checking" | "available" | "unavailable" | "denied";

type HealthContextValue = {
  status: HealthStatus;
  mockMode: boolean;
  realSteps: number;
  mockSteps: number;
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
  setMockMode: (enabled: boolean) => Promise<void>;
  boostMockSteps: (amount: number) => void;
  syncRealStepsNow: () => Promise<number>;
};

const MOCK_KEY = "@stride/health_mock_v2";
const HC_GATE_KEY = "@stride/health_connect_gate_v1";
const HealthContext = createContext<HealthContextValue | null>(null);

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<HealthStatus>("checking");
  const [mockMode, setMockModeState] = useState(false);
  const [realSteps, setRealSteps] = useState(0);
  const [mockSteps, setMockSteps] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [healthConnectReady, setHealthConnectReady] = useState(Platform.OS !== "android");
  const subRef = useRef<{ remove: () => void } | null>(null);
  const sessionBaseRef = useRef(0);
  const realStepsRef = useRef(0);

  const stepsToday = mockMode ? mockSteps : realSteps;
  const needsPermission = !mockMode && (status === "denied" || status === "unavailable");
  const needsHealthConnectWall =
    Platform.OS === "android" &&
    hydrated &&
    !mockMode &&
    !healthConnectReady;

  useEffect(() => {
    realStepsRef.current = realSteps;
  }, [realSteps]);

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
        setRealSteps(0);
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
          setRealSteps(steps);
        } catch {
          sessionBaseRef.current = 0;
          setRealSteps(0);
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
      setRealSteps(steps);
      setStatus("available");
      return steps;
    } catch {
      setStatus("denied");
      setPermissionMessage(
        Platform.OS === "android"
          ? "Permission denied. Open Health Connect → App permissions → allow STRIDE Steps."
          : "Permission denied. Settings → Privacy → Motion & Fitness → enable STRIDE."
      );
      setRealSteps(0);
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
    if (mockMode) {
      setIsTracking(true);
      return;
    }
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
        setRealSteps(sessionBaseRef.current + Math.max(0, result.steps || 0));
      });
      setIsTracking(true);
      setStatus("available");
    } catch {
      setStatus("denied");
      setIsTracking(false);
      if (Platform.OS === "android") await markHealthConnectReady(false);
    }
  }, [mockMode, stopTracking, syncRealStepsNow, healthConnectReady, markHealthConnectReady]);

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
        setRealSteps(sessionBaseRef.current + Math.max(0, result.steps || 0));
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

  const setMockMode = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        if (typeof __DEV__ === "undefined" || !__DEV__) {
          return;
        }
        stopTracking();
        const seed = realStepsRef.current;
        setMockSteps(seed);
        setMockModeState(true);
        setIsTracking(true);
        await AsyncStorage.setItem(MOCK_KEY, JSON.stringify({ enabled: true, mockSteps: seed }));
        await Haptics.selectionAsync();
        return;
      }
      setMockModeState(false);
      setMockSteps(0);
      await AsyncStorage.setItem(MOCK_KEY, JSON.stringify({ enabled: false, mockSteps: 0 }));
      const live = await syncRealStepsNow();
      setRealSteps(live);
      stopTracking();
      if (Platform.OS === "android" && !healthConnectReady) {
        setIsTracking(false);
        return;
      }
      try {
        const available = await Pedometer.isAvailableAsync();
        if (available) {
          sessionBaseRef.current = live;
          subRef.current = Pedometer.watchStepCount((result) => {
            setRealSteps(sessionBaseRef.current + Math.max(0, result.steps || 0));
          });
          setIsTracking(true);
          setStatus("available");
        }
      } catch {
        setStatus("denied");
        setIsTracking(false);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [stopTracking, syncRealStepsNow, healthConnectReady]
  );

  const boostMockSteps = useCallback(
    (amount: number) => {
      if (!mockMode) return;
      setMockSteps((s) => Math.max(0, s + amount));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [mockMode]
  );

  useEffect(() => {
    (async () => {
      try {
        const [rawMock, rawGate] = await Promise.all([
          AsyncStorage.getItem(MOCK_KEY),
          AsyncStorage.getItem(HC_GATE_KEY),
        ]);
        let enabled = false;
        if (rawMock) {
          const parsed = JSON.parse(rawMock);
          enabled = !!parsed.enabled && typeof __DEV__ !== "undefined" && __DEV__;
          if (enabled) {
            setMockModeState(true);
            setMockSteps(Math.max(0, Number(parsed.mockSteps) || 0));
          } else if (parsed.enabled) {
            await AsyncStorage.setItem(MOCK_KEY, JSON.stringify({ enabled: false, mockSteps: 0 }));
          }
        }
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
          if (gateReady && !enabled) {
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
          if (!enabled) await syncRealStepsNow();
        }
      } finally {
        setHydrated(true);
      }
    })();
    return () => stopTracking();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(MOCK_KEY, JSON.stringify({ enabled: mockMode, mockSteps })).catch(() => undefined);
  }, [hydrated, mockMode, mockSteps]);

  useEffect(() => {
    if (!hydrated) return;
    if (mockMode) {
      setIsTracking(true);
      return;
    }
    if (Platform.OS === "android" && !healthConnectReady) {
      stopTracking();
      return;
    }
    startTracking();
  }, [hydrated, mockMode, healthConnectReady]);

  const value = useMemo(
    () => ({
      status,
      mockMode,
      realSteps,
      mockSteps,
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
      setMockMode,
      boostMockSteps,
      syncRealStepsNow,
    }),
    [
      status,
      mockMode,
      realSteps,
      mockSteps,
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
      setMockMode,
      boostMockSteps,
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
