// ============================================================
// SUPER RESERVATION PLATFORM — Shared TypeScript Types
// ============================================================

import type { User, Business, Booking, Slot } from '@prisma/client';

// ── JWT Payload ──────────────────────────────────────────────

export interface JwtAccessPayload {
  sub: string;          // user ID
  phone: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export type UserRole = 'consumer' | 'business_owner' | 'admin' | 'super_admin';

// ── Error Response Envelope (matches spec) ───────────────────

export interface ApiError {
  error: {
    code: string;
    message: string;
    message_ar: string;
    details?: Record<string, unknown>;
  };
}

// ── Booking Engine ───────────────────────────────────────────

export interface SlotLockResult {
  acquired: boolean;
  booking_id?: string;
  hold_expires_at?: Date;
  conflict_booking_id?: string;
}

export interface BookingCreationResult {
  booking_id: string;
  booking_ref: string;
  slot_hold_expires_at: Date;
  payment_intent: PaymobPaymentIntent;
}

export interface PaymobPaymentIntent {
  order_id: string;
  payment_key: string;
  iframe_url: string;
}

// ── Notification Payloads ────────────────────────────────────

export interface NotificationPayload {
  booking_ref?: string;
  business_name_ar?: string;
  business_name_en?: string;
  datetime_ar?: string;
  address?: string;
  cancel_link?: string;
  reschedule_link?: string;
  review_link?: string;
  dispute_link?: string;
  consumer_name?: string;
  party_size?: number;
  occasion?: string;
  special_requests?: string;
  penalty_amount?: number;
  dispute_window_ends_at?: string;
  payout_amount?: number;
  payout_eta?: string;
  refund_amount?: number | null;
  refund_eta?: string | null;
  refund_eta_days?: number;
  credit_amount?: number;
  maps_link?: string;
  time_ar?: string;
  // Category-specific enrichments (court/gaming/car wash)
  sport_type_ar?: string;
  station_type_ar?: string;
  vehicle_type_ar?: string;
  service_package_ar?: string;
  drop_off_ar?: string;
  duration_ar?: string;
  player_count?: number;
  // Payment receipt
  deposit_amount?: number;
  platform_fee?: number;
  total_amount?: number;
  refund_policy_hours?: number;
  receipt_link?: string;
  // Cancellation / refund
  deposit_forfeited?: boolean;
  // Dispute
  sla_hours?: number;
  outcome_ar?: string;
  resolution?: string;
  // Payout failure alert
  amount_egp?: number;
}

// ── Search & Discovery ───────────────────────────────────────

export interface BusinessSearchParams {
  category?: string;
  district?: string;
  date?: string;
  party_size?: number;
  min_rating?: number;
  page?: number;
  limit?: number;
  lat?: number;
  lng?: number;
}

export interface BusinessSearchResult {
  businesses: BusinessSummary[];
  total: number;
  page: number;
  has_more: boolean;
}

export interface BusinessSummary {
  id: string;
  name_ar: string;
  name_en: string | null;
  category: string;
  district: string;
  rating_avg: number;
  review_count: number;
  is_featured: boolean;
  photos: string[];
  next_available_slots: SlotSummary[];
  distance_km?: number;
}

export interface SlotSummary {
  id: string;
  start_time: string;
  end_time: string;
  available_capacity: number;
  deposit_amount: number;
}

// ── Analytics ───────────────────────────────────────────────

export interface BusinessAnalyticsSummary {
  period: string;
  bookings_total: number;
  bookings_confirmed: number;
  bookings_completed: number;
  bookings_cancelled: number;
  bookings_no_show: number;
  deposit_revenue_egp: number;
  platform_fees_egp: number;
  no_shows_prevented: number;
  revenue_protected_egp: number;
  no_show_rate_pct: number;
}

// ── Re-exports from Prisma ───────────────────────────────────

export type { User, Business, Booking, Slot };
