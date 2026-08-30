/**
 * Local UI state — and nothing else.
 *
 * This context used to hold a parallel copy of the product: a coin balance
 * computed on the device, a list of owned coupons, a merchant catalogue, an
 * inbox. All of that is the server's, and is read through `ServerDataContext`.
 * Keeping a second copy here meant the two could disagree, and the one the user
 * saw was the one that was wrong.
 *
 * What is genuinely local lives here: the toast queue, the body measurements and
 * step goal a user sets on this device, and which fitness sources they have
 * connected. Steps come from `HealthContext` (the device's sensors) and are
 * mirrored into `userStats` for the screens that read them.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { UserStats } from "../types";
import { useHealth } from "./HealthContext";

const STATE_KEY = "@stride/app_state_v4";

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [
    h > 0 ? String(h).padStart(2, "0") : null,
    String(m).padStart(2, "0"),
    String(s).padStart(2, "0"),
  ]
    .filter(Boolean)
    .join(":");
}

type Toast = { id: string; message: string; emoji?: string } | null;

export interface DeviceLink {
  id: string;
  name: string;
  connected: boolean;
  lastSync?: string;
}

type StrideContextValue = {
  userStats: UserStats;
  setUserStats: React.Dispatch<React.SetStateAction<UserStats>>;
  toast: Toast;
  showToast: (message: string, emoji?: string) => void;
  dismissToast: () => void;
  devices: DeviceLink[];
  toggleDevice: (id: string) => void;
  syncDevice: (id: string) => Promise<void>;
};

const StrideContext = createContext<StrideContextValue | null>(null);

/** Body measurements and the goal are per-device settings, not server records. */
const DEFAULT_STATS: UserStats = {
  stepsToday: 0,
  stepsGoal: 10_000,
  weightKg: 70,
  heightCm: 175,

};

const DEFAULT_DEVICES: DeviceLink[] = [
  { id: "health_connect", name: "Health Connect", connected: false },
  { id: "apple", name: "Apple Health", connected: false },
];

export function StrideProvider({ children }: { children: React.ReactNode }) {
  const health = useHealth();
  const [hydrated, setHydrated] = useState(false);
  const [userStats, setUserStats] = useState<UserStats>(DEFAULT_STATS);
  const [devices, setDevices] = useState<DeviceLink[]>(DEFAULT_DEVICES);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STATE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.userStats) setUserStats({ ...DEFAULT_STATS, ...parsed.userStats });
          if (parsed.devices) setDevices(parsed.devices);
        }
      } catch {
        // A corrupt cache is not worth failing to start over; defaults are fine.
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STATE_KEY, JSON.stringify({ userStats, devices })).catch(
      () => undefined,
    );
  }, [hydrated, userStats, devices]);

  // The sensors are the source; this mirror exists so screens do not each have
  // to reach into HealthContext for one number.
  useEffect(() => {
    if (!hydrated) return;
    setUserStats((prev) =>
      prev.stepsToday === health.stepsToday ? prev : { ...prev, stepsToday: health.stepsToday },
    );
  }, [health.stepsToday, hydrated]);

  const showToast = useCallback((message: string, emoji?: string) => {
    setToast({ id: String(Date.now()), message, emoji });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  /**
   * Only Health Connect is a real integration. Turning it "on" means asking the
   * OS for permission, so a refusal has to leave the switch off rather than
   * showing a connection that does not exist.
   */
  const syncDevice = useCallback(
    async (id: string) => {
      if (id !== "health_connect") {
        showToast("Not available on this device yet", "🚧");
        return;
      }
      const granted = await health.requestPermission();
      if (!granted) {
        setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, connected: false } : d)));
        showToast("Health permission was declined", "🔒");
        return;
      }
      setDevices((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, connected: true, lastSync: new Date().toISOString() } : d,
        ),
      );
      showToast("Health Connect synced", "📡");
    },
    [health, showToast],
  );

  const toggleDevice = useCallback(
    (id: string) => {
      const device = devices.find((d) => d.id === id);
      if (!device) return;
      if (device.connected) {
        setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, connected: false } : d)));
        return;
      }
      void syncDevice(id);
    },
    [devices, health, syncDevice],
  );

  const value = useMemo<StrideContextValue>(
    () => ({
      userStats,
      setUserStats,
      toast,
      showToast,
      dismissToast,
      devices,
      toggleDevice,
      syncDevice,
    }),
    [userStats, toast, showToast, dismissToast, devices, toggleDevice, syncDevice],
  );

  return <StrideContext.Provider value={value}>{children}</StrideContext.Provider>;
}

export function useStride() {
  const ctx = useContext(StrideContext);
  if (!ctx) throw new Error("useStride must be used within StrideProvider");
  return ctx;
}
