import type { NavigatorScreenParams } from "@react-navigation/native";

export enum ScreenId {
  Home = "Home",
  Track = "Track",
  Scoreboard = "Scoreboard",
  Store = "Store",
  Profile = "Profile",
  ConnectedDevices = "ConnectedDevices",
  HelpSupport = "HelpSupport",
  SupportChat = "SupportChat",
  Inbox = "Inbox",
  BrandStore = "BrandStore",
  CouponDetail = "CouponDetail",
  SecureVerification = "SecureVerification",
  WorkoutSummary = "WorkoutSummary",
  Wallet = "Wallet",
  PerformanceReport = "PerformanceReport",
  Login = "Login",
  Register = "Register",
  ForgotPassword = "ForgotPassword",
  EditProfile = "EditProfile",
  CreateCoupon = "CreateCoupon",
  MerchantManager = "MerchantManager",
  MerchantScanner = "MerchantScanner",
  HealthSetup = "HealthSetup",
  Stories = "Stories",
}

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
export interface UserStats {
  stepsToday: number;
  stepsGoal: number;
  weightKg: number;
  heightCm: number;
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
  Auth: undefined;
  /** Nested: the tab navigator, so callers can target a specific tab. */
  Main: NavigatorScreenParams<MainTabParamList>;
  Profile: undefined;
  ConnectedDevices: undefined;
  HelpSupport: undefined;
  SupportChat: undefined;
  BrandStore: { partnerId: string };
  CouponDetail: { couponId: string };
  SecureVerification: { voucherId: string };
  Wallet: undefined;
  WorkoutSummary: undefined;
  PerformanceReport: undefined;
  EditProfile: undefined;
  CreateCoupon: undefined;
  MerchantManager: undefined;
  MerchantScanner: undefined;
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
  InboxTab: undefined;
  ScoreboardTab: undefined;
  StoreTab: undefined;
};
