/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { 
  ScreenId, 
  UserStats, 
  LeaderboardUser, 
  PartnerBrand, 
  Coupon, 
  NotificationItem, 
  ActiveWorkout 
} from "../types";
import { 
  initialUserStats, 
  leaderboardUsers, 
  partnerBrands, 
  couponsList, 
  initialNotifications 
} from "../utils/mockData";

export function useStrideState() {
  // Navigation
  const [screenHistory, setScreenHistory] = useState<ScreenId[]>([ScreenId.Home]);
  const currentScreen = screenHistory[screenHistory.length - 1] || ScreenId.Home;

  const navigateTo = (screen: ScreenId) => {
    setScreenHistory((prev) => [...prev, screen]);
  };

  const navigateBack = () => {
    if (screenHistory.length > 1) {
      setScreenHistory((prev) => prev.slice(0, -1));
    }
  };

  const navigateToTab = (screen: ScreenId) => {
    // Reset navigation context for primary tabs
    setScreenHistory([screen]);
  };

  // User Stats & Tokens
  const [userStats, setUserStats] = useState<UserStats>(initialUserStats);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>(leaderboardUsers);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  
  // Purchased Rewards
  const [userCoupons, setUserCoupons] = useState<Coupon[]>([
    {
      id: "wallet_starbucks_latte",
      title: "50% Off Starbucks Latte",
      brandId: "starbucks",
      brandName: "Starbucks",
      logo: "https://images.unsplash.com/photo-1561040772-7970493097fe?auto=format&fit=crop&w=100&q=80",
      category: "COFFEE",
      stepsCost: 3500,
      image: "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=100&q=80"
    },
    {
      id: "wallet_gift_card",
      title: "$20 Digital Gift Card",
      brandId: "nike",
      brandName: "Nike Store",
      logo: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=100&q=80",
      category: "APPAREL",
      stepsCost: 12000,
      image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=100&q=80"
    },
    {
      id: "wallet_guest_pass",
      title: "1-Week Guest Pass",
      brandId: "gymshark",
      brandName: "Gymshark HQ",
      logo: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=100&q=80",
      category: "FITNESS",
      stepsCost: 15000,
      image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=100&q=80"
    },
    {
      id: "wallet_nutrition",
      title: "15% Off Nutrition",
      brandId: "nutrition",
      brandName: "Nutrition Co.",
      logo: "https://images.unsplash.com/photo-1610970881699-44a5587caa9a?auto=format&fit=crop&w=100&q=80",
      category: "HEALTH",
      stepsCost: 2000,
      image: "https://images.unsplash.com/photo-1610970881699-44a5587caa9a?auto=format&fit=crop&w=100&q=80"
    }
  ]);

  // Selected details
  const [selectedBrand, setSelectedBrand] = useState<PartnerBrand | null>(partnerBrands[0]);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(couponsList[0]);
  const [selectedNotificationCode, setSelectedNotificationCode] = useState<string | null>(null);

  // Active workout summary cache
  const [lastWorkoutSummary, setLastWorkoutSummary] = useState<{
    distanceKm: number;
    durationFormatted: string;
    caloriesKcal: number;
    avgSpeed: number;
    tokensEarned: number;
    steps?: number;
    date?: string;
    id?: string;
  } | null>(null);

  // Historical workouts list
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([
    {
      id: "hist_1",
      date: "Jun 15, 2026 • 08:42 AM",
      steps: 12432,
      distanceKm: 8.4,
      duration: "01:24:15",
      caloriesKcal: 532,
      avgSpeed: 6.0,
      tokensEarned: 250
    },
    {
      id: "hist_2",
      date: "Jun 13, 2026 • 07:15 AM",
      steps: 8320,
      distanceKm: 6.2,
      duration: "00:48:10",
      caloriesKcal: 410,
      avgSpeed: 7.7,
      tokensEarned: 180
    },
    {
      id: "hist_3",
      date: "Jun 11, 2026 • 06:30 PM",
      steps: 10450,
      distanceKm: 7.8,
      duration: "01:05:40",
      caloriesKcal: 512,
      avgSpeed: 7.1,
      tokensEarned: 210
    }
  ]);

  const addWorkoutToHistory = (wData: any) => {
    if (!wData) return;
    setWorkoutHistory((prev) => {
      const exists = prev.some((h) => h.id === wData.id);
      if (exists) return prev;
      return [
        {
          id: wData.id || `hist_${Date.now()}`,
          date: wData.date || "Just Now",
          steps: wData.steps || Math.floor(wData.distanceKm * 1450) || 4500,
          distanceKm: wData.distanceKm,
          duration: wData.durationFormatted || wData.duration,
          caloriesKcal: wData.caloriesKcal,
          avgSpeed: wData.avgSpeed || 5.2,
          tokensEarned: wData.tokensEarned
        },
        ...prev
      ];
    });
  };

  // Active Workout Engine
  const [workout, setWorkout] = useState<ActiveWorkout>({
    isActive: false,
    isPaused: false,
    durationSeconds: 0,
    distanceKm: 0,
    caloriesKcal: 0,
    avgSpeedKmH: 0,
    routeCoordinates: [],
    mapView: "neon"
  });

  const workoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-step physical simulator (simulates running/walking)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (userStats.pedometerActive) {
      interval = setInterval(() => {
        // Gently add random steps to keep the metrics active and alive
        setUserStats((prev) => {
          const added = Math.floor(Math.random() * 4) + 1; // 1-4 steps
          const newSteps = prev.stepsToday + added;
          const distanceValue = Number((newSteps * 0.00075).toFixed(2));
          const caloriesValue = Math.floor(newSteps * 0.04);
          
          // Also update the weekly chart today slot
          const updatedWeekly = prev.weeklySteps.map((w) => {
            if (w.isToday) {
              return { ...w, steps: newSteps };
            }
            return w;
          });

          return {
            ...prev,
            stepsToday: newSteps,
            weeklySteps: updatedWeekly
          };
        });
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [userStats.pedometerActive]);

  // Sync our steps with our self record on the leaderboard list
  useEffect(() => {
    setLeaderboard((prev) =>
      prev.map((user) => {
        if (user.isSelf) {
          return { ...user, steps: userStats.stepsToday };
        }
        return user;
      }).sort((a, b) => b.steps - a.steps)
    );
  }, [userStats.stepsToday]);

  // Active tracking timer
  useEffect(() => {
    if (workout.isActive && !workout.isPaused) {
      workoutTimerRef.current = setInterval(() => {
        setWorkout((prev) => {
          const nextSeconds = prev.durationSeconds + 1;
          
          // Generate realistic progressive coordinate offset
          const lastCoord = prev.routeCoordinates[prev.routeCoordinates.length - 1] || { x: 150, y: 300 };
          const movementX = (Math.random() - 0.45) * 5;
          const movementY = (Math.random() - 0.45) * 5;
          const nextCoords = [...prev.routeCoordinates, { x: lastCoord.x + movementX, y: lastCoord.y + movementY }];
          if (nextCoords.length > 50) nextCoords.shift(); // keep trail lean

          // Progressive parameters
          const nextDistance = prev.distanceKm + 0.002; // adds 2 meters every second
          const nextCal = prev.caloriesKcal + 0.15; // calories
          const speedHz = Number((3.6 * (nextDistance / (nextSeconds / 3600))).toFixed(1)) || 5.2;

          return {
            ...prev,
            durationSeconds: nextSeconds,
            distanceKm: Number(nextDistance.toFixed(2)),
            caloriesKcal: Math.floor(nextCal),
            avgSpeedKmH: speedHz,
            routeCoordinates: nextCoords
          };
        });

        // Add corresponding simulated steps to the main pedometer
        setUserStats((prev) => {
          const addedSteps = Math.floor(Math.random() * 3) + 2; // 2-4 steps per second when running
          const newSteps = prev.stepsToday + addedSteps;
          const updatedWeekly = prev.weeklySteps.map((w) => {
            if (w.isToday) return { ...w, steps: newSteps };
            return w;
          });
          return {
            ...prev,
            stepsToday: newSteps,
            weeklySteps: updatedWeekly
          };
        });

      }, 1000);
    } else {
      if (workoutTimerRef.current) {
        clearInterval(workoutTimerRef.current);
      }
    }

    return () => {
      if (workoutTimerRef.current) clearInterval(workoutTimerRef.current);
    };
  }, [workout.isActive, workout.isPaused]);

  // Workout Actions
  const startWorkout = () => {
    setWorkout({
      isActive: true,
      isPaused: false,
      durationSeconds: 0,
      distanceKm: 0,
      caloriesKcal: 0,
      avgSpeedKmH: 0,
      routeCoordinates: [{ x: 150, y: 300 }],
      mapView: "neon"
    });
  };

  const togglePauseWorkout = () => {
    setWorkout((prev) => ({ ...prev, isPaused: !prev.isPaused }));
  };

  const finishWorkout = () => {
    // Determine realistic simulated stats or fallback values
    const finalDistance = workout.distanceKm || 3.84;
    const finalSeconds = workout.durationSeconds || 2535; // 42 min 15 sec
    const finalCalories = workout.caloriesKcal || 312;
    const finalSpeed = workout.avgSpeedKmH || 5.2;
    const minFormatted = formatDuration(finalSeconds);

    // Dynamic token calc with a floor to match the high-contrast mock designs dynamically
    const tokensEarned = Math.max(180, Math.floor(finalDistance * 65));
    const finalSteps = Math.floor(finalDistance * 1480) || 5683;

    setLastWorkoutSummary({
      id: `w_sum_${Date.now()}`,
      distanceKm: finalDistance,
      durationFormatted: minFormatted,
      caloriesKcal: finalCalories,
      avgSpeed: finalSpeed,
      tokensEarned: tokensEarned,
      steps: finalSteps,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + " • " + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    });

    // Add tokens to wallet
    setUserStats((prev) => ({
      ...prev,
      totalTokens: prev.totalTokens + tokensEarned
    }));

    // Trigger congratulations alert
    const newAlert: NotificationItem = {
      id: `notify_workout_${Date.now()}`,
      title: "Workout Summary Ready",
      body: `You completed a ${finalDistance}km workout, earned ${tokensEarned} Step-Tokens!`,
      timeAgo: "Just now",
      category: "milestone",
      read: false
    };

    setNotifications((prev) => [newAlert, ...prev]);

    // Shut down workout
    setWorkout((prev) => ({ ...prev, isActive: false }));
    navigateTo(ScreenId.WorkoutSummary);
  };

  // Settings permission toggle
  const togglePermissions = () => {
    setUserStats((prev) => ({
      ...prev,
      pedometerActive: !prev.pedometerActive
    }));
  };

  // Confirm Purchase action
  const confirmPurchaseReward = (cost: number, couponItem: Coupon) => {
    if (userStats.totalTokens >= cost) {
      // Deduct steps balance
      setUserStats((prev) => ({
        ...prev,
        totalTokens: prev.totalTokens - cost
      }));

      // Add to user vouchers
      setUserCoupons((prev) => [couponItem, ...prev]);

      // Push success notification
      const newNotif: NotificationItem = {
        id: `notify_purch_${Date.now()}`,
        title: "Voucher Purchased successfully!",
        body: `Your ${couponItem.title} is now active. Present security code at vendor.`,
        timeAgo: "1s ago",
        category: "coupon",
        read: false
      };
      setNotifications((prev) => [newNotif, ...prev]);

      // Route directly to secure verification page
      setSelectedCoupon(couponItem);
      navigateTo(ScreenId.SecureVerification);
      return true;
    }
    return false;
  };

  // Clear single notification
  const readNotification = (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const clearNotifications = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const triggerMockStepsBoost = (amt: number) => {
    setUserStats((prev) => {
      const target = prev.stepsToday + amt;
      return {
        ...prev,
        stepsToday: target,
        totalTokens: prev.totalTokens + Math.floor(amt * 0.1),
        weeklySteps: prev.weeklySteps.map((w) => w.isToday ? { ...w, steps: target } : w)
      };
    });
  };

  return {
    screenHistory,
    currentScreen,
    navigateTo,
    navigateBack,
    navigateToTab,
    userStats,
    setUserStats,
    leaderboard,
    notifications,
    userCoupons,
    selectedBrand,
    setSelectedBrand,
    selectedCoupon,
    setSelectedCoupon,
    selectedNotificationCode,
    setSelectedNotificationCode,
    lastWorkoutSummary,
    workoutHistory,
    addWorkoutToHistory,
    workout,
    startWorkout,
    togglePauseWorkout,
    finishWorkout,
    togglePermissions,
    confirmPurchaseReward,
    readNotification,
    clearNotifications,
    triggerMockStepsBoost,
    setWorkout
  };
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [
    h > 0 ? String(h).padStart(2, "0") : null,
    String(m).padStart(2, "0"),
    String(s).padStart(2, "0")
  ].filter(Boolean).join(":");
}
