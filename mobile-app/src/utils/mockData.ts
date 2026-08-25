/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LeaderboardUser, PartnerBrand, Coupon, NotificationItem, UserStats } from "../types";

export const initialUserStats: UserStats = {
  stepsToday: 0,
  stepsGoal: 16000,
  weightKg: 75,
  heightCm: 180,
  pedometerActive: true,
  totalTokens: 0,
  bonusTokens: 0,
  spentTokens: 0,
  weeklySteps: [
    { day: "M", steps: 0 },
    { day: "T", steps: 0 },
    { day: "W", steps: 0 },
    { day: "T", steps: 0 },
    { day: "F", steps: 0, isToday: true },
    { day: "S", steps: 0 },
    { day: "S", steps: 0 },
  ],
  streakDays: 0,
};

export const leaderboardUsers: LeaderboardUser[] = [
  {
    rank: 1,
    name: "Marcus T.",
    steps: 21800,
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
    elevated: true,
    statusText: "King of Stride! 🔥"
  },
  {
    rank: 2,
    name: "Sarah K.",
    steps: 18400,
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80",
    elevated: true,
    statusText: "Smashed goals!"
  },
  {
    rank: 3,
    name: "Alex M.",
    steps: 17900,
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80",
    elevated: true,
    statusText: "Beast mode on"
  },
  {
    rank: 4,
    name: "James L.",
    steps: 15820,
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
    statusText: "Yesterday: 12.1k"
  },
  {
    rank: 5,
    name: "Maya W.",
    steps: 14200,
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
    statusText: "On a streak!"
  },
  {
    rank: 6,
    name: "Chris P.",
    steps: 13950,
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80",
    statusText: "Level 24"
  },
  // Felix (Us) is rank 12
  {
    rank: 12,
    name: "You",
    steps: 0,
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
    isSelf: true,
    statusText: "Start walking! ⚡"
  },
  {
    rank: 13,
    name: "Emil S.",
    steps: 12380,
    avatar: "https://images.unsplash.com/photo-1489980508314-941910ded1f4?auto=format&fit=crop&w=150&q=80",
    statusText: "Gaining on you!"
  }
];

export const partnerBrands: PartnerBrand[] = [
  {
    id: "starbucks",
    name: "Starbucks",
    logo: "https://images.unsplash.com/photo-1561040772-7970493097fe?auto=format&fit=crop&w=100&q=80",
    category: "Coffee",
    coverImage: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=500&q=80",
    stepsPrice: 3500,
    shortDesc: "Redeem your steps for premium coffee vouchers.",
    fullDesc: "Redeem your hard-earned steps for a Grande beverage of your choice at any participating Starbucks location. Whether you're craving a classic Caffe Latte or a seasonal favorite, STRIDE rewards your commitment to a healthier lifestyle.",
    expiresInDays: 3,
    progressPercent: 70
  },
  {
    id: "mcdonalds",
    name: "McDonald's",
    logo: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=100&q=80",
    category: "Food",
    coverImage: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=80",
    stepsPrice: 5000,
    shortDesc: "Fuel up after a heavy workout session.",
    fullDesc: "Redeem for a mouth-watering Free Big Mac. Hand-crafted, multi-tiered burger filled with fresh lettuce, special sauce, cheese, and real-beef patties. Perfect post-run cheat day reward!",
    expiresInDays: 5,
    progressPercent: 50
  },
  {
    id: "nike",
    name: "Nike Store",
    logo: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=100&q=80",
    category: "Apparel",
    coverImage: "https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=500&q=80",
    stepsPrice: 12000,
    shortDesc: "Exclusive access to athletic footwear gear.",
    fullDesc: "Get 20% off your next checkout online or in-store on selected Pegasus and Infinity Run collections. Your movement is your currency.",
    expiresInDays: 7,
    progressPercent: 95
  },
  {
    id: "gymshark",
    name: "Gymshark",
    logo: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=100&q=80",
    category: "Fitness",
    coverImage: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=500&q=80",
    stepsPrice: 15000,
    shortDesc: "Premium pass to local Gymshark wellness HQ.",
    fullDesc: "Enjoy a fully-catered 1-Month Premium Access Pass including weight training, interactive high-intensity interval groups, and cold-plunge recovery sectors.",
    expiresInDays: 14,
    progressPercent: 12
  }
];

export const couponsList: Coupon[] = [
  {
    id: "coupon_macchiato",
    title: "Free Large Caramel Macchiato",
    brandId: "starbucks",
    brandName: "Starbucks",
    logo: "https://images.unsplash.com/photo-1561040772-7970493097fe?auto=format&fit=crop&w=100&q=80",
    category: "BEVERAGE REWARD",
    stepsCost: 5000,
    image: "https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&w=400&q=80"
  },
  {
    id: "coupon_bogo",
    title: "Buy 1 Get 1 Free on all Beverages",
    brandId: "starbucks",
    brandName: "Starbucks",
    logo: "https://images.unsplash.com/photo-1561040772-7970493097fe?auto=format&fit=crop&w=100&q=80",
    category: "BOGO DEAL",
    stepsCost: 3000,
    image: "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=400&q=80"
  },
  {
    id: "coupon_pastry",
    title: "Free Morning Pastry",
    brandId: "starbucks",
    brandName: "Starbucks",
    logo: "https://images.unsplash.com/photo-1561040772-7970493097fe?auto=format&fit=crop&w=100&q=80",
    category: "BAKERY REWARD",
    stepsCost: 2500,
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80"
  }
];

export const initialNotifications: NotificationItem[] = [
  {
    id: "notify_overtake",
    title: "Emil just overtook you on the Leaderboard!",
    body: "Emil S. reached rank 11 with 12,380 steps. Hit your stride to take back your place!",
    timeAgo: "2m ago",
    category: "alert",
    actionType: "reclaim",
    read: false
  },
  {
    id: "notify_goal",
    title: "Goal Reached!",
    body: "You smashed your 16,000 steps goal today! Keep the momentum.",
    timeAgo: "3h ago",
    category: "milestone",
    read: false
  },
  {
    id: "notify_coupon",
    title: "New Coupon Added!",
    body: "Starbucks is now offering a 50% discount voucher. Tap to copy details.",
    timeAgo: "1d ago",
    category: "coupon",
    actionType: "view_coupon",
    couponCode: "STRIDE50OFF",
    read: true
  },
  {
    id: "notify_summary",
    title: "Weekly Summary Available",
    body: "Your weekly summary for Oct 12 - Oct 18 is ready to view. See your Peak Performance statistics.",
    timeAgo: "1d ago",
    category: "summary",
    read: true
  }
];
