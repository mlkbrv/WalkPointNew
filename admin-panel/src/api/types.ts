/** Response shapes, mirroring the Pydantic schemas in `backend/app/schemas`. */

export type UserRole = 'user' | 'partner' | 'superadmin';
export type ModerationStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export type PartnerStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type TicketStatus = 'open' | 'closed';
export type MessageSender = 'user' | 'admin';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserPublic {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  role: UserRole;
  city: string;
  country: string;
  avatar_path: string | null;
  referral_code: string;
  is_active: boolean;
}

export interface AuthResponse {
  user: UserPublic;
  tokens: TokenPair;
  is_new_user: boolean;
}

// --- partners ---------------------------------------------------------------

export interface Partner {
  id: string;
  owner_id: string;
  company_name: string;
  description: string;
  logo_path: string | null;
  website: string;
  contact_phone: string;
  contact_email: string;
  social_links: Record<string, unknown>;
  status: PartnerStatus;
  rejection_reason: string;
  created_at: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  latitude: string | null;
  longitude: string | null;
  phone: string;
  working_hours: Record<string, unknown>;
  is_active: boolean;
}

export interface PartnerStats {
  live_coupons: number;
  pending_coupons: number;
  live_stories: number;
  coupons_purchased: number;
  coupons_redeemed: number;
}

// --- content ----------------------------------------------------------------

export interface Coupon {
  id: string;
  partner_id: string;
  category_id: string | null;
  title: string;
  description: string;
  rules: string;
  image_path: string | null;
  cost_coins: number;
  quantity_remaining: number;
  quantity_total: number;
  quantity_redeemed: number;
  is_single_use: boolean;
  starts_at: string;
  ends_at: string;
  status: ModerationStatus;
  rejection_reason: string;
  published_at: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Story {
  id: string;
  partner_id: string;
  media_type: 'image' | 'video';
  media_path: string;
  caption: string;
  published_at: string | null;
  expires_at: string | null;
  status: ModerationStatus;
  rejection_reason: string;
  reviewed_at: string | null;
  created_at: string;
}

export interface ModerationQueue {
  partners: number;
  coupons: number;
  stories: number;
  flagged_steps: number;
  support_tickets: number;
}

// --- economy and anti-fraud --------------------------------------------------

export interface EconomySettings {
  minimum_steps_threshold: number;
  reward_at_threshold: number;
  reward_per_extra_thousand_steps: number;
  suspicious_steps_per_day: number;
  hard_cap_steps_per_day: number;
  max_steps_per_hour: number;
  max_sync_age_days: number;
  coins_per_story_view: number;
  coins_per_referral: number;
  referral_activity_steps_required: number;
  story_lifetime_hours: number;
  max_stories_per_partner: number;
}

export interface FlaggedDay {
  day_id: string;
  user_id: string;
  user_label: string;
  date: string;
  steps: number;
  coins_awarded: number;
  coins_pending: number;
  reason: string;
  source: string;
}

// --- redemptions -------------------------------------------------------------

export interface RedemptionRecord {
  voucher_id: string;
  coupon_id: string;
  coupon_title: string;
  cost_paid: number;
  used_at: string | null;
  branch_id: string | null;
}

export interface CouponSales {
  issued: number;
  redeemed: number;
  coins_collected: number;
}

// --- support -----------------------------------------------------------------

export interface SupportMessage {
  id: string;
  sender: MessageSender;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface StaffTicketRow {
  id: string;
  user_id: string;
  user_label: string;
  subject: string;
  status: TicketStatus;
  message_count: number;
  awaiting_reply: boolean;
  last_message_at: string | null;
  created_at: string;
}

export interface StaffTicketPage {
  items: StaffTicketRow[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface StaffThread {
  ticket_id: string;
  subject: string;
  status: TicketStatus;
  created_at: string;
  last_message_at: string | null;
  messages: SupportMessage[];
  user_id: string;
  user_label: string;
}

export interface SupportQueueCounts {
  open_tickets: number;
  awaiting_reply: number;
}

export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
}


/** What a voucher code turns out to be, before anything is consumed. */
export interface ScanPreview {
  voucher_id: string;
  coupon_title: string;
  status: 'active' | 'used' | 'expired';
  cost_paid: number;
  valid_until: string;
  used_at: string | null;
  is_redeemable: boolean;
}

/** The result of actually burning a voucher. */
export interface ScanResult {
  voucher_id: string;
  coupon_title: string;
  customer_label: string;
  cost_paid: number;
  used_at: string | null;
  status: 'active' | 'used' | 'expired';
}
