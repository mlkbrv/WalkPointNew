/** Typed wrappers over the API, grouped by the screen area each serves. */

import { api } from "./client";

// --- shapes -----------------------------------------------------------------

export interface ApiTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface ApiUser {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  role: "user" | "partner" | "superadmin";
  city: string;
  country: string;
  avatar_path: string | null;
  referral_code: string;
  is_active: boolean;
}

export interface ApiAuthResponse {
  user: ApiUser;
  tokens: ApiTokens;
  is_new_user: boolean;
}

export interface ApiDailySteps {
  id: string;
  date: string;
  steps: number;
  coins_awarded: number;
  is_suspicious: boolean;
  suspicion_reason: string;
  source: string;
}

export interface ApiStepSync {
  day: ApiDailySteps;
  coins_awarded: number;
  balance: number;
  is_suspicious: boolean;
  reason: string;
}

export interface ApiStepRules {
  minimum_steps_threshold: number;
  reward_at_threshold: number;
  reward_per_extra_thousand_steps: number;
  hard_cap_steps_per_day: number;
  max_sync_age_days: number;
}

export interface ApiWallet {
  balance: number;
  earned_total: number;
  spent_total: number;
}

export interface ApiLedgerEntry {
  id: string;
  amount: number;
  source: string;
  note: string;
  reference_id: string | null;
  created_at: string;
}

export interface ApiPage<T> {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface ApiStore {
  id: string;
  company_name: string;
  description: string;
  logo_path: string | null;
  website: string;
  contact_phone: string;
  social_links: Record<string, unknown>;
}

export interface ApiCoupon {
  id: string;
  partner_id: string;
  category_id: string | null;
  title: string;
  description: string;
  rules: string;
  image_path: string | null;
  cost_coins: number;
  quantity_remaining: number;
  is_single_use: boolean;
  starts_at: string;
  ends_at: string;
}

export interface ApiVoucher {
  id: string;
  coupon_id: string;
  qr_token: string;
  status: "active" | "used" | "expired";
  cost_paid: number;
  used_at: string | null;
  created_at: string;
  coupon: ApiCoupon;
}

export interface ApiStory {
  id: string;
  partner_id: string;
  media_type: "image" | "video";
  media_path: string;
  caption: string;
  published_at: string | null;
  expires_at: string | null;
}

export interface ApiNotification {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface ApiSupportMessage {
  id: string;
  sender: "user" | "admin";
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface ApiSupportThread {
  ticket_id: string;
  subject: string;
  status: "open" | "closed";
  created_at: string;
  last_message_at: string | null;
  messages: ApiSupportMessage[];
}

export interface ApiFaqEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
}


export interface ApiLeaderboardEntry {
  rank: number;
  user_id: string;
  name: string;
  steps: number;
  avatar_url: string | null;
  is_self: boolean;
}

export interface ApiLeaderboard {
  period: string;
  items: ApiLeaderboardEntry[];
  self: { rank: number | null; steps: number };
}

/** A recorded path, in GeoJSON coordinate order: longitude first. */
export interface ApiWorkoutRoute {
  v: number;
  coordinates: [number, number][];
  /** Seconds elapsed from the workout's start, one per coordinate. */
  t: number[];
  /** Distance measured before simplification — a thinned line is shorter. */
  dist_km: number;
}

export interface ApiWorkout {
  id: string;
  kind: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number;
  distance_km: number;
  steps: number;
  calories_kcal: number;
  is_finished: boolean;
  bonus_paid: number;
  is_suspicious: boolean;
}

/** One workout with its path. The list endpoint deliberately omits the route. */
export interface ApiWorkoutDetail extends ApiWorkout {
  route: ApiWorkoutRoute | null;
}

export interface ApiWorkoutFinished {
  workout: ApiWorkout;
  coins_awarded: number;
  balance: number;
}

export interface ApiWeeklySummary {
  sessions: number;
  distance_km: number;
  duration_seconds: number;
  calories_kcal: number;
  coins: number;
}

// --- endpoints ---------------------------------------------------------------

export const authApi = {
  register: (email: string, password: string, full_name: string, referral_code = "") =>
    api.post<ApiAuthResponse>(
      "/v1/auth/register",
      { email, password, full_name, referral_code },
      { anonymous: true },
    ),
  login: (email: string, password: string) =>
    api.post<ApiAuthResponse>("/v1/auth/login", { email, password }, { anonymous: true }),
  requestSms: (phone: string) =>
    api.post<{ message: string }>("/v1/auth/sms/request", { phone }, { anonymous: true }),
  verifySms: (phone: string, code: string, referral_code = "") =>
    api.post<ApiAuthResponse>(
      "/v1/auth/sms/verify",
      { phone, code, referral_code },
      { anonymous: true },
    ),
  logout: (refresh_token: string) => api.post<unknown>("/v1/auth/logout", { refresh_token }),
  me: () => api.get<ApiUser>("/v1/auth/me"),
  updateProfile: (patch: { full_name?: string; city?: string; country?: string }) =>
    api.patch<ApiUser>("/v1/auth/me", patch),

  /**
   * `uri` is the local file the image picker handed back.
   *
   * React Native's FormData takes this `{ uri, name, type }` shape rather than
   * a Blob — the file is never read into JS, the native layer streams it. The
   * cast is unavoidable: the DOM typings for FormData know nothing about it.
   */
  uploadAvatar: (uri: string) => {
    const extension = (uri.split(".").pop() || "jpg").toLowerCase();
    const type = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
    const form = new FormData();
    form.append("file", { uri, name: `avatar.${extension}`, type } as unknown as Blob);
    return api.put<ApiUser>("/v1/auth/me/avatar", form);
  },
};

export const stepsApi = {
  /**
   * `source` is required, not defaulted.
   *
   * It used to default to `"health_connect"`, so every sync claimed that origin
   * whatever had actually produced the number — including the raw sensor
   * fallback. Making the caller name it means the server records provenance
   * instead of a guess.
   */
  sync: (date: string, steps: number, source: string) =>
    api.post<ApiStepSync>("/v1/steps/sync", { date, steps, source }),
  today: () => api.get<ApiDailySteps | null>("/v1/steps/today"),
  history: (days = 7) =>
    api.get<{ days: ApiDailySteps[]; total_steps: number; total_coins: number }>(
      "/v1/steps/history",
      { days },
    ),
  rules: () => api.get<ApiStepRules>("/v1/steps/rules"),
};

export const walletApi = {
  summary: () => api.get<ApiWallet>("/v1/wallet"),
  ledger: (cursor?: string, limit = 20) =>
    api.get<ApiPage<ApiLedgerEntry>>("/v1/wallet/ledger", { cursor, limit }),
  vouchers: (status?: string) => api.get<ApiVoucher[]>("/v1/wallet/vouchers", { status }),
  voucher: (id: string) => api.get<ApiVoucher>(`/v1/wallet/vouchers/${id}`),
};

export const catalogueApi = {
  stores: (search = "") => api.get<ApiStore[]>("/v1/partners", { search }, { anonymous: true }),
  store: (id: string) => api.get<ApiStore>(`/v1/partners/${id}`, undefined, { anonymous: true }),
  coupons: (partner_id?: string, limit = 20) =>
    api.get<ApiCoupon[]>("/v1/coupons", { partner_id, limit }, { anonymous: true }),
  coupon: (id: string) => api.get<ApiCoupon>(`/v1/coupons/${id}`, undefined, { anonymous: true }),
  purchase: (id: string) =>
    api.post<{ voucher: ApiVoucher; balance: number }>(`/v1/coupons/${id}/purchase`),
};

export const storiesApi = {
  feed: () => api.get<ApiStory[]>("/v1/stories", undefined, { anonymous: true }),
  markSeen: (id: string) => api.post<{ message: string }>(`/v1/stories/${id}/seen`),
};

export const inboxApi = {
  list: (cursor?: string) =>
    api.get<ApiPage<ApiNotification> & { unread: number }>("/v1/notifications", { cursor }),
  unreadCount: () => api.get<{ unread: number }>("/v1/notifications/unread-count"),
  markRead: (id: string) => api.post<ApiNotification>(`/v1/notifications/${id}/read`),
  markAllRead: () => api.post<{ marked: number }>("/v1/notifications/read-all"),
  registerPushToken: (device_id: string, push_token: string, platform: string) =>
    api.post<unknown>("/v1/notifications/push-token", { device_id, push_token, platform }),
  revokePushToken: (device_id: string) =>
    api.post<unknown>("/v1/notifications/push-token/revoke", { device_id }),
};

export const supportApi = {
  thread: () => api.get<ApiSupportThread | null>("/v1/support/thread"),
  send: (body: string) => api.post<ApiSupportMessage>("/v1/support/messages", { body }),
  badge: () => api.get<{ unread: number; has_open_thread: boolean }>("/v1/support/badge"),
  faq: () => api.get<ApiFaqEntry[]>("/v1/support/faq", undefined, { anonymous: true }),
};

export const leaderboardApi = {
  get: (period: "daily" | "weekly" = "daily") =>
    api.get<ApiLeaderboard>("/v1/leaderboard", { period }),
};

export const workoutsApi = {
  start: (kind = "walk") => api.post<ApiWorkout>("/v1/workouts", { kind }),
  active: () => api.get<ApiWorkout | null>("/v1/workouts/active"),
  last: () => api.get<ApiWorkout | null>("/v1/workouts/last"),
  history: (limit = 30) => api.get<ApiWorkout[]>("/v1/workouts", { limit }),
  summary: () => api.get<ApiWeeklySummary>("/v1/workouts/summary"),
  detail: (id: string) => api.get<ApiWorkoutDetail>(`/v1/workouts/${id}`),
  progress: (
    id: string,
    data: {
      duration_seconds?: number;
      distance_km?: number;
      steps?: number;
      calories_kcal?: number;
      route?: ApiWorkoutRoute;
    },
  ) => api.patch<ApiWorkout>(`/v1/workouts/${id}`, data),
  finish: (
    id: string,
    data: {
      duration_seconds?: number;
      distance_km?: number;
      steps?: number;
      calories_kcal?: number;
      /** Sent once, on finish — not on every progress ping. */
      route?: ApiWorkoutRoute;
    },
  ) => api.post<ApiWorkoutFinished>(`/v1/workouts/${id}/finish`, data),
};
