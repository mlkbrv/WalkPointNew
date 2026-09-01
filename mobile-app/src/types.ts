import type { NavigatorScreenParams } from "@react-navigation/native";

// `ScreenId` used to live here: a parallel list of route names that nothing
// imported, still naming three merchant screens deleted when partners moved to
// the web console, and using un-suffixed tab names that never matched the real
// routes. The param lists below are the only route names.

export type UserRole = "consumer" | "merchant";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  memberSince: string;
  businessName?: string;
}

export interface UserPreferences {
  notificationsEnabled: boolean;
  privacyVisible: boolean;
  emailAlerts: boolean;
  marketingPush: boolean;
}

/**
 * Per-device settings plus the live step count.
 *
 * The coin fields that used to live here (`totalTokens`, `bonusTokens`,
 * `spentTokens`) are gone: a balance is `SUM(coin_transactions)` on the server,
 * and a second copy on the device could only ever be a stale guess. Read it from
 * `useServerData().wallet`. Weekly steps come from `GET /v1/steps/history`.
 */
/** How lengths and masses are shown. Stored values are always metric. */
export type UnitSystem = "metric" | "imperial";

export type Gender = "man" | "woman" | "unspecified";

export interface UserStats {
  stepsToday: number;
  stepsGoal: number;
  weightKg: number;
  heightCm: number;
  // Collected during onboarding. They live on the device, like the rest of this
  // object — the server has no column for any of them.
  gender: Gender;
  ageYears: number;
  sedentary: boolean;
  unitSystem: UnitSystem;
}

export interface LeaderboardUser {
  rank: number;
  name: string;
  steps: number;
  avatar: string;
  isSelf?: boolean;
  statusText?: string;
  elevated?: boolean;
}

export interface StoryFrame {
  id: string;
  image: string;
  caption: string;
}

export interface BrandStory {
  id: string;
  brandId: string;
  name: string;
  logo: string;
  category: string;
  timeAgo: string;
  stepsPrice: number;
  shortDesc: string;
  fullDesc: string;
  frames: StoryFrame[];
}

export interface PartnerBrand {
  id: string;
  name: string;
  logo: string;
  category: string;
  coverImage: string;
  stepsPrice: number;
  shortDesc: string;
  fullDesc: string;
  expiresInDays: number;
  progressPercent: number;
}

export interface Coupon {
  id: string;
  title: string;
  brandId: string;
  brandName: string;
  logo: string;
  category: string;
  stepsCost: number;
  image: string;
  discountPercent?: number;
  expiresAt?: string;
  redemptionCode?: string;
  used?: boolean;
}

export interface MerchantCoupon extends Coupon {
  published: boolean;
  redemptions: number;
  views: number;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timeAgo: string;
  category: "alert" | "milestone" | "coupon" | "summary";
  actionType?: "reclaim" | "view_coupon" | "none";
  couponCode?: string;
  read: boolean;
}

export interface ActiveWorkout {
  isActive: boolean;
  isPaused: boolean;
  durationSeconds: number;
  distanceKm: number;
  caloriesKcal: number;
  avgSpeedKmH: number;
  routeCoordinates: { x: number; y: number }[];
  mapView: "neon" | "satellite" | "slate";
}

export interface DeviceConnection {
  id: string;
  name: string;
  connected: boolean;
  lastSync?: string;
}

export type RootStackParamList = {
  /** Nested: the tab navigator, so callers can target a specific tab. */
  Main: NavigatorScreenParams<MainTabParamList>;
  // Inbox and Scoreboard used to be tabs. They moved off the bar to make room
  // for Report and Account: the inbox is reached from the bell in Home's header
  // and a row in Account, the board from Account.
  Inbox: undefined;
  Scoreboard: undefined;
  History: undefined;
  ConnectedDevices: undefined;
  HelpSupport: undefined;
  SupportChat: undefined;
  BrandStore: { partnerId: string };
  CouponDetail: { couponId: string };
  SecureVerification: { voucherId: string };
  Wallet: undefined;
  WorkoutSummary: undefined;
  EditProfile: undefined;
  HealthSetup: undefined;
  Stories: { startId: string };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  TrackTab: undefined;
  ReportTab: undefined;
  StoreTab: undefined;
  AccountTab: undefined;
};
