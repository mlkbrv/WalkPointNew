/** Typed wrappers, grouped by the audience each endpoint serves. */

import { api } from './client';
import type {
  AuthResponse,
  Branch,
  Coupon,
  CouponSales,
  EconomySettings,
  FAQEntry,
  FlaggedDay,
  ModerationQueue,
  Partner,
  PartnerStats,
  RedemptionRecord,
  StaffThread,
  StaffTicketPage,
  Story,
  SupportMessage,
  SupportQueueCounts,
  TicketStatus,
  UserPublic,
  ScanPreview,
  ScanResult,
} from './types';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/v1/auth/staff/login', { email, password }),
  me: () => api.get<UserPublic>('/v1/auth/me'),
  logout: (refresh_token: string) => api.post<unknown>('/v1/auth/logout', { refresh_token }),
};

// --- superadmin --------------------------------------------------------------

export const adminApi = {
  queue: () => api.get<ModerationQueue>('/v1/admin/queue'),

  pendingPartners: () => api.get<Partner[]>('/v1/admin/partners/pending'),
  approvePartner: (id: string) => api.post<Partner>(`/v1/admin/partners/${id}/approve`),
  rejectPartner: (id: string, reason: string) =>
    api.post<Partner>(`/v1/admin/partners/${id}/reject`, { reason }),
  suspendPartner: (id: string, reason: string) =>
    api.post<Partner>(`/v1/admin/partners/${id}/suspend`, { reason }),

  pendingCoupons: () => api.get<Coupon[]>('/v1/admin/coupons/pending'),
  approveCoupon: (id: string) => api.post<Coupon>(`/v1/admin/coupons/${id}/approve`),
  rejectCoupon: (id: string, reason: string) =>
    api.post<Coupon>(`/v1/admin/coupons/${id}/reject`, { reason }),

  pendingStories: () => api.get<Story[]>('/v1/admin/stories/pending'),
  approveStory: (id: string) => api.post<Story>(`/v1/admin/stories/${id}/approve`),
  rejectStory: (id: string, reason: string) =>
    api.post<Story>(`/v1/admin/stories/${id}/reject`, { reason }),

  flaggedDays: () => api.get<FlaggedDay[]>('/v1/admin/steps/flagged'),
  approveFlaggedDay: (id: string) =>
    api.post<{ day_id: string; coins_awarded: number; balance: number }>(
      `/v1/admin/steps/flagged/${id}/approve`,
    ),
  rejectFlaggedDay: (id: string, reason: string) =>
    api.post<FlaggedDay>(`/v1/admin/steps/flagged/${id}/reject`, { reason }),

  economy: () => api.get<EconomySettings>('/v1/admin/economy'),
  updateEconomy: (changes: Partial<EconomySettings>) =>
    api.patch<EconomySettings>('/v1/admin/economy', changes),

  adjustLedger: (user_id: string, amount: number, note: string) =>
    api.post<{ user_id: string; amount: number; balance: number }>('/v1/admin/ledger/adjust', {
      user_id,
      amount,
      note,
    }),

  broadcast: (payload: {
    title: string;
    body: string;
    role?: string;
    notification_type?: string;
  }) =>
    api.post<{ recipients: number }>('/v1/admin/notifications/broadcast', {
      title: payload.title,
      body: payload.body,
      role: payload.role || null,
      notification_type: payload.notification_type ?? 'generic',
    }),
};

export const supportAdminApi = {
  counts: () => api.get<SupportQueueCounts>('/v1/admin/support/queue'),
  tickets: (ticket_status?: TicketStatus, cursor?: string) =>
    api.get<StaffTicketPage>('/v1/admin/support/tickets', { ticket_status, cursor, limit: 50 }),
  thread: (id: string) => api.get<StaffThread>(`/v1/admin/support/tickets/${id}`),
  reply: (id: string, body: string) =>
    api.post<SupportMessage>(`/v1/admin/support/tickets/${id}/reply`, { body }),
  close: (id: string) => api.post<unknown>(`/v1/admin/support/tickets/${id}/close`),
  reopen: (id: string) => api.post<unknown>(`/v1/admin/support/tickets/${id}/reopen`),

  faq: () => api.get<FAQEntry[]>('/v1/support/faq'),
  createFaq: (entry: Omit<FAQEntry, 'id'>) => api.post<FAQEntry>('/v1/admin/support/faq', entry),
  updateFaq: (id: string, changes: Partial<Omit<FAQEntry, 'id'>>) =>
    api.patch<FAQEntry>(`/v1/admin/support/faq/${id}`, changes),
  deleteFaq: (id: string) => api.delete<unknown>(`/v1/admin/support/faq/${id}`),
};

// --- partner -----------------------------------------------------------------

export const businessApi = {
  profile: () => api.get<Partner>('/v1/business/profile'),
  updateProfile: (changes: Partial<Partner>) => api.patch<Partner>('/v1/business/profile', changes),
  stats: () => api.get<PartnerStats>('/v1/business/stats'),

  branches: () => api.get<Branch[]>('/v1/business/branches'),
  createBranch: (data: { name: string; address?: string; phone?: string }) =>
    api.post<Branch>('/v1/business/branches', data),
  deleteBranch: (id: string) => api.delete<unknown>(`/v1/business/branches/${id}`),

  coupons: () => api.get<Coupon[]>('/v1/business/coupons'),
  createCoupon: (data: Record<string, unknown>) => api.post<Coupon>('/v1/business/coupons', data),
  updateCoupon: (id: string, changes: Record<string, unknown>) =>
    api.patch<Coupon>(`/v1/business/coupons/${id}`, changes),
  submitCoupon: (id: string) => api.post<Coupon>(`/v1/business/coupons/${id}/submit`),
  withdrawCoupon: (id: string) => api.post<Coupon>(`/v1/business/coupons/${id}/withdraw`),
  deleteCoupon: (id: string) => api.delete<unknown>(`/v1/business/coupons/${id}`),
  couponSales: (id: string) => api.get<CouponSales>(`/v1/redemptions/coupons/${id}/sales`),

  stories: () => api.get<Story[]>('/v1/business/stories'),
  createStory: (data: { media_type: string; media_path: string; caption: string }) =>
    api.post<Story>('/v1/business/stories', data),
  submitStory: (id: string) => api.post<Story>(`/v1/business/stories/${id}/submit`),
  withdrawStory: (id: string) => api.post<Story>(`/v1/business/stories/${id}/withdraw`),
  deleteStory: (id: string) => api.delete<unknown>(`/v1/business/stories/${id}`),

  redemptions: () => api.get<RedemptionRecord[]>('/v1/redemptions'),

  /**
   * Look at a code without consuming it.
   *
   * The identifier is the coupon's `qr_token`, not the voucher id — the mobile
   * scanner that this replaces sent the wrong one, which is why redemption
   * never worked there.
   */
  previewCode: (qr_token: string) =>
    api.post<ScanPreview>('/v1/redemptions/preview', { qr_token }),

  /** Burn the voucher. Not idempotent by design: a second scan must fail. */
  redeemCode: (qr_token: string) =>
    api.post<ScanResult>('/v1/redemptions/scan', { qr_token }),
};
