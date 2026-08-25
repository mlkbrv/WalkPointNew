import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import {
  Coupon,
  MerchantCoupon,
  NotificationItem,
  PartnerBrand,
  UserStats,
} from "../types";
import {
  couponsList,
  initialNotifications,
  initialUserStats,
  partnerBrands,
} from "../utils/mockData";
import { useHealth } from "./HealthContext";
import { useAuth } from "./AuthContext";
import { balanceFromParts } from "../utils/metrics";

const STATE_KEY = "@stride/app_state_v3";

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h > 0 ? String(h).padStart(2, "0") : null, String(m).padStart(2, "0"), String(s).padStart(2, "0")]
    .filter(Boolean)
    .join(":");
}

type Toast = { id: string; message: string; emoji?: string } | null;

type StrideContextValue = {
  userStats: UserStats;
  setUserStats: React.Dispatch<React.SetStateAction<UserStats>>;
  notifications: NotificationItem[];
  userCoupons: Coupon[];
  merchantCoupons: MerchantCoupon[];
  selectedBrand: PartnerBrand | null;
  setSelectedBrand: (b: PartnerBrand | null) => void;
  selectedCoupon: Coupon | null;
  setSelectedCoupon: (c: Coupon | null) => void;
  togglePermissions: () => void;
  confirmPurchaseReward: (cost: number, couponItem: Coupon) => boolean;
  readNotification: (id: string) => void;
  clearNotifications: () => void;
  triggerMockStepsBoost: (amt: number) => void;
  flushToRealHealth: () => void;
  toast: Toast;
  showToast: (message: string, emoji?: string) => void;
  dismissToast: () => void;
  createMerchantCoupon: (data: Omit<MerchantCoupon, "id" | "createdAt" | "redemptions" | "views" | "published"> & { published?: boolean }) => void;
  toggleMerchantCoupon: (id: string) => void;
  redeemMerchantCode: (code: string) => { ok: boolean; message: string };
  devices: { id: string; name: string; connected: boolean; lastSync?: string }[];
  toggleDevice: (id: string) => void;
  syncDevice: (id: string) => Promise<void>;
};

const StrideContext = createContext<StrideContextValue | null>(null);

function applySteps(prev: UserStats, steps: number): UserStats {
  const safe = Math.max(0, steps);
  return {
    ...prev,
    stepsToday: safe,
    totalTokens: balanceFromParts(safe, prev.bonusTokens, prev.spentTokens),
    weeklySteps: prev.weeklySteps.map((w) => (w.isToday ? { ...w, steps: safe } : w)),
  };
}

export function StrideProvider({ children }: { children: React.ReactNode }) {
  const health = useHealth();
  const { user } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [userStats, setUserStats] = useState<UserStats>(initialUserStats);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [userCoupons, setUserCoupons] = useState<Coupon[]>([]);
  const [merchantCoupons, setMerchantCoupons] = useState<MerchantCoupon[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<PartnerBrand | null>(partnerBrands[0]);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(couponsList[0]);
  const [toast, setToast] = useState<Toast>(null);
  const [devices, setDevices] = useState([
    { id: "apple", name: "Apple Health", connected: false, lastSync: undefined as string | undefined },
    { id: "health_connect", name: "Health Connect", connected: false, lastSync: undefined as string | undefined },
    { id: "fitbit", name: "Fitbit", connected: false, lastSync: undefined as string | undefined },
  ]);
  const milestoneRef = useRef(false);
  const prevMockRef = useRef(health.mockMode);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STATE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.userStats) {
            const s = parsed.userStats as UserStats;
            setUserStats({
              ...initialUserStats,
              ...s,
              bonusTokens: s.bonusTokens ?? 0,
              spentTokens: s.spentTokens ?? 0,
              totalTokens: balanceFromParts(s.stepsToday ?? 0, s.bonusTokens ?? 0, s.spentTokens ?? 0),
            });
          }
          if (parsed.userCoupons) setUserCoupons(parsed.userCoupons);
          if (parsed.notifications) setNotifications(parsed.notifications);
          if (parsed.merchantCoupons) setMerchantCoupons(parsed.merchantCoupons);
          if (parsed.devices) setDevices(parsed.devices);
        }
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(
      STATE_KEY,
      JSON.stringify({ userStats, userCoupons, notifications, merchantCoupons, devices })
    ).catch(() => undefined);
  }, [hydrated, userStats, userCoupons, notifications, merchantCoupons, devices]);

  useEffect(() => {
    if (!hydrated) return;
    if (prevMockRef.current && !health.mockMode) {
      setUserStats((prev) => applySteps({ ...prev, bonusTokens: 0, spentTokens: 0 }, health.realSteps));
      setUserCoupons([]);
      setToast({ id: String(Date.now()), message: "Mock data flushed — live health sync", emoji: "📡" });
    }
    prevMockRef.current = health.mockMode;
  }, [health.mockMode, health.realSteps, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    setUserStats((prev) => {
      if (prev.stepsToday === health.stepsToday) {
        const nextTokens = balanceFromParts(health.stepsToday, prev.bonusTokens, prev.spentTokens);
        if (nextTokens === prev.totalTokens) return prev;
        return { ...prev, totalTokens: nextTokens };
      }
      return applySteps(prev, health.stepsToday);
    });
  }, [health.stepsToday, hydrated]);

  useEffect(() => {
    if (userStats.stepsToday >= userStats.stepsGoal && !milestoneRef.current) {
      milestoneRef.current = true;
      setToast({ id: String(Date.now()), message: "Daily goal smashed!", emoji: "🎉" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNotifications((prev) => [
        {
          id: `notify_goal_${Date.now()}`,
          title: "Goal Reached!",
          body: `You hit ${userStats.stepsGoal.toLocaleString()} steps today!`,
          timeAgo: "Just now",
          category: "milestone",
          read: false,
        },
        ...prev,
      ]);
    }
    if (userStats.stepsToday < userStats.stepsGoal) milestoneRef.current = false;
  }, [userStats.stepsToday, userStats.stepsGoal]);

  const showToast = useCallback((message: string, emoji?: string) => {
    setToast({ id: String(Date.now()), message, emoji });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const togglePermissions = useCallback(() => {
    setUserStats((prev) => {
      const next = !prev.pedometerActive;
      if (next) health.startTracking();
      else health.stopTracking();
      return { ...prev, pedometerActive: next };
    });
  }, [health]);

  const confirmPurchaseReward = useCallback(
    (cost: number, couponItem: Coupon) => {
      if (userStats.totalTokens < cost) {
        showToast("Not enough tokens", "😔");
        return false;
      }
      const code = `${couponItem.brandId.slice(0, 3).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const withCode = { ...couponItem, id: `${couponItem.id}_${Date.now()}`, redemptionCode: code };
      setUserStats((prev) => {
        const spentTokens = prev.spentTokens + cost;
        return {
          ...prev,
          spentTokens,
          totalTokens: balanceFromParts(prev.stepsToday, prev.bonusTokens, spentTokens),
        };
      });
      setUserCoupons((prev) => [withCode, ...prev]);
      setSelectedCoupon(withCode);
      setNotifications((prev) => [
        {
          id: `notify_purch_${Date.now()}`,
          title: "Voucher purchased!",
          body: `${couponItem.title} is now in your wallet.`,
          timeAgo: "1s ago",
          category: "coupon",
          read: false,
        },
        ...prev,
      ]);
      showToast("Reward unlocked!", "✨");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    },
    [userStats.totalTokens, showToast]
  );

  const clearNotifications = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const triggerMockStepsBoost = useCallback(
    (amt: number) => {
      if (!health.mockMode) {
        showToast("Enable Developer Mock Mode first", "🛠️");
        return;
      }
      health.boostMockSteps(amt);
      showToast(`+${amt.toLocaleString()} mock steps`, "⚡");
    },
    [health, showToast]
  );

  const flushToRealHealth = useCallback(() => {
    setUserStats((prev) => applySteps({ ...prev, bonusTokens: 0, spentTokens: 0 }, health.realSteps));
    setUserCoupons([]);
  }, [health.realSteps]);

  const readNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const createMerchantCoupon = useCallback(
    (data: Omit<MerchantCoupon, "id" | "createdAt" | "redemptions" | "views" | "published"> & { published?: boolean }) => {
      const item: MerchantCoupon = {
        ...data,
        id: `mc_${Date.now()}`,
        createdAt: new Date().toISOString(),
        redemptions: 0,
        views: 0,
        published: data.published ?? true,
        redemptionCode: data.redemptionCode || `MCH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      };
      setMerchantCoupons((prev) => [item, ...prev]);
      showToast("Coupon published", "🏪");
    },
    [showToast]
  );

  const toggleMerchantCoupon = useCallback((id: string) => {
    setMerchantCoupons((prev) => prev.map((c) => (c.id === id ? { ...c, published: !c.published } : c)));
  }, []);

  const redeemMerchantCode = useCallback(
    (code: string) => {
      const normalized = code.trim().toUpperCase();
      const owned = userCoupons.find((c) => (c.redemptionCode || "").toUpperCase() === normalized && !c.used);
      const merchant = merchantCoupons.find((c) => (c.redemptionCode || "").toUpperCase() === normalized);
      if (owned) {
        setUserCoupons((prev) => prev.map((c) => (c.id === owned.id ? { ...c, used: true } : c)));
        if (merchant) {
          setMerchantCoupons((prev) => prev.map((c) => (c.id === merchant.id ? { ...c, redemptions: c.redemptions + 1 } : c)));
        }
        showToast("Coupon validated!", "✅");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return { ok: true, message: `Validated: ${owned.title}` };
      }
      if (merchant) {
        setMerchantCoupons((prev) => prev.map((c) => (c.id === merchant.id ? { ...c, redemptions: c.redemptions + 1 } : c)));
        showToast("Merchant code accepted", "✅");
        return { ok: true, message: `Redeemed: ${merchant.title}` };
      }
      showToast("Invalid code", "❌");
      return { ok: false, message: "Code not found or already used." };
    },
    [userCoupons, merchantCoupons, showToast]
  );

  const toggleDevice = useCallback((id: string) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, connected: !d.connected, lastSync: !d.connected ? "Just now" : d.lastSync } : d))
    );
  }, []);

  const syncDevice = useCallback(async (id: string) => {
    await new Promise((r) => setTimeout(r, 1200));
    setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, connected: true, lastSync: "Just now" } : d)));
    if (id === "health_connect") {
      await health.requestPermissions();
      await health.startTracking();
    }
    showToast("Device synced", "📡");
  }, [health, showToast]);

  useEffect(() => {
    if (hydrated && userStats.pedometerActive) {
      health.startTracking();
    }
  }, [hydrated]);

  const value = useMemo(
    () => ({
      userStats,
      setUserStats,
      notifications,
      userCoupons,
      merchantCoupons,
      selectedBrand,
      setSelectedBrand,
      selectedCoupon,
      setSelectedCoupon,
      togglePermissions,
      confirmPurchaseReward,
      readNotification,
      clearNotifications,
      triggerMockStepsBoost,
      flushToRealHealth,
      toast,
      showToast,
      dismissToast,
      createMerchantCoupon,
      toggleMerchantCoupon,
      redeemMerchantCode,
      devices,
      toggleDevice,
      syncDevice,
    }),
    [
      userStats,
      notifications,
      userCoupons,
      merchantCoupons,
      selectedBrand,
      selectedCoupon,
      togglePermissions,
      confirmPurchaseReward,
      readNotification,
      clearNotifications,
      triggerMockStepsBoost,
      flushToRealHealth,
      toast,
      showToast,
      dismissToast,
      createMerchantCoupon,
      toggleMerchantCoupon,
      redeemMerchantCode,
      devices,
      toggleDevice,
      syncDevice,
    ]
  );

  return <StrideContext.Provider value={value}>{children}</StrideContext.Provider>;
}

export function useStride() {
  const ctx = useContext(StrideContext);
  if (!ctx) throw new Error("useStride must be used within StrideProvider");
  return ctx;
}
