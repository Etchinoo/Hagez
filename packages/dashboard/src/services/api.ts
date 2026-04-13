// ============================================================
// SUPER RESERVATION PLATFORM — Dashboard API Client
// Business dashboard API calls. JWT stored in localStorage
// (dashboard is web-only, not mobile — secure origin assumed).
// ============================================================

import axios, { type AxiosInstance } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3000/v1';

const ACCESS_TOKEN_KEY = 'reservr_biz_access_token';
const REFRESH_TOKEN_KEY = 'reservr_biz_refresh_token';

export const dashboardApi: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

dashboardApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

dashboardApi.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refresh) {
        localStorage.clear();
        window.location.href = '/login';
        return;
      }
      try {
        const res = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refresh });
        localStorage.setItem(ACCESS_TOKEN_KEY, res.data.access_token);
        original.headers.Authorization = `Bearer ${res.data.access_token}`;
        return dashboardApi(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ─────────────────────────────────────────────────────

export const authApi = {
  requestOtp: (phone: string) => dashboardApi.post('/auth/otp/request', { phone }),
  verifyOtp: (phone: string, otp: string) =>
    dashboardApi.post('/auth/otp/verify', { phone, otp }),
  verifyFirebaseToken: (idToken: string, full_name?: string) =>
    dashboardApi.post('/auth/firebase/verify', { idToken, full_name }),
};

// ── Business Bookings ────────────────────────────────────────

export const bookingsApi = {
  list: (date?: string, view?: string) =>
    dashboardApi.get('/business/bookings', { params: { date, view } }),
  updateStatus: (id: string, status: 'completed' | 'no_show') =>
    dashboardApi.patch(`/business/bookings/${id}/status`, { status }),
  createManual: (data: Record<string, unknown>) =>
    dashboardApi.post('/business/bookings/manual', data),
};

// ── Business Slots ───────────────────────────────────────────

export const slotsApi = {
  list: (start?: string, end?: string) =>
    dashboardApi.get('/business/slots', { params: { start, end } }),
  createBulk: (rules: any[]) =>
    dashboardApi.post('/business/slots/bulk', { rules }),
  block: (id: string, reason?: string) =>
    dashboardApi.patch(`/business/slots/${id}/block`, { reason }),
};

// ── Business Policy (US-033, US-036, US-049) ──────────────────

export const businessApi = {
  getProfile: () => dashboardApi.get('/business/profile'),
  updateProfile: (data: {
    name_ar?: string;
    name_en?: string;
    description_ar?: string;
    description_en?: string;
    district?: string;
    category?: string;
  }) => dashboardApi.put('/business/profile', data),
  updateOwnerName: (full_name: string) =>
    dashboardApi.patch('/business/owner', { full_name }),
  requestPlanChange: (data: { action: 'upgrade' | 'downgrade' | 'cancel'; target_tier?: string }) =>
    dashboardApi.post('/business/plan-change-request', data),
  getPolicy: () => dashboardApi.get('/business/policy'),
  updatePolicy: (data: {
    deposit_type?: 'fixed' | 'percentage';
    deposit_value?: number;
    cancellation_window_hours?: number;
    payout_method?: 'bank_transfer' | 'paymob_wallet';
    payout_threshold_egp?: number;
    // US-049: notification preferences
    notify_new_booking_push?: boolean;
    notify_cancellation_push?: boolean;
    notify_payout_whatsapp?: boolean;
  }) => dashboardApi.put('/business/policy', data),
};

// ── Analytics (US-054) ───────────────────────────────────────

export const analyticsApi = {
  summary: (month?: string) =>
    dashboardApi.get('/business/analytics/summary', { params: { month } }),
  trend: (days?: number) =>
    dashboardApi.get('/business/analytics/trend', { params: { days } }),
};

// ── Staff Management (US-057) ────────────────────────────────

export const staffApi = {
  list: () => dashboardApi.get('/business/staff'),
  create: (data: { name_ar: string; name_en?: string; specialisations?: string[]; photo_url?: string }) =>
    dashboardApi.post('/business/staff', data),
  update: (id: string, data: { name_ar?: string; name_en?: string; specialisations?: string[]; is_active?: boolean }) =>
    dashboardApi.patch(`/business/staff/${id}`, data),
};

// ── Service Menu (US-058) ────────────────────────────────────

export const servicesApi = {
  list: () => dashboardApi.get('/business/services'),
  create: (data: { name_ar: string; name_en?: string; price_egp: number; duration_min: number }) =>
    dashboardApi.post('/business/services', data),
  update: (id: string, data: { name_ar?: string; price_egp?: number; duration_min?: number; is_active?: boolean }) =>
    dashboardApi.patch(`/business/services/${id}`, data),
};

// ── Sections (US-060) ────────────────────────────────────────

export const sectionsApi = {
  list: () => dashboardApi.get('/business/sections'),
  create: (data: { name_ar: string; name_en?: string; capacity: number }) =>
    dashboardApi.post('/business/sections', data),
  update: (id: string, data: { name_ar?: string; capacity?: number; is_active?: boolean }) =>
    dashboardApi.patch(`/business/sections/${id}`, data),
};

// ── Booking Notes (US-055) ───────────────────────────────────

export const bookingNotesApi = {
  save: (bookingId: string, internal_notes: string) =>
    dashboardApi.patch(`/business/bookings/${bookingId}/notes`, { internal_notes }),
};

// ── Dynamic Pricing (EP-14) ───────────────────────────────────

export const pricingApi = {
  list: () => dashboardApi.get('/business/pricing-rules'),
  create: (data: {
    rule_type: 'surge' | 'last_minute' | 'demand';
    name_ar: string;
    multiplier?: number;
    max_multiplier?: number;
    days_of_week?: number[];
    hour_start?: number;
    hour_end?: number;
    minutes_before?: number;
    discount_pct?: number;
    fill_rate_pct?: number;
  }) => dashboardApi.post('/business/pricing-rules', data),
  toggle: (id: string, is_active: boolean) =>
    dashboardApi.patch(`/business/pricing-rules/${id}`, { is_active }),
  remove: (id: string) => dashboardApi.delete(`/business/pricing-rules/${id}`),
  analytics: (days?: number) =>
    dashboardApi.get('/business/analytics/pricing', { params: { days } }),
};

// ── Stations Inventory (US-093) ──────────────────────────────

export const stationsApi = {
  list: () => dashboardApi.get('/business/stations'),
  create: (data: { name_ar: string; name_en?: string; station_type: string; capacity?: number }) =>
    dashboardApi.post('/business/stations', data),
  update: (id: string, data: { name_ar?: string; name_en?: string; capacity?: number; is_active?: boolean }) =>
    dashboardApi.patch(`/business/stations/${id}`, data),
};

// ── Gaming Config (US-094) ───────────────────────────────────

export const gamingConfigApi = {
  get: () => dashboardApi.get('/business/gaming-config'),
  update: (data: {
    station_types?: string[];
    has_group_rooms?: boolean;
    group_room_capacity?: number;
    genre_options?: string[];
    slot_duration_options?: number[];
    default_slot_duration_minutes?: number;
  }) => dashboardApi.patch('/business/gaming-config', data),
};

// ── Courts Inventory (US-086) ────────────────────────────────

export const courtsApi = {
  list: () => dashboardApi.get('/business/courts'),
  create: (data: { name_ar: string; name_en?: string; capacity?: number }) =>
    dashboardApi.post('/business/courts', data),
  update: (id: string, data: { name_ar?: string; name_en?: string; capacity?: number; is_active?: boolean }) =>
    dashboardApi.patch(`/business/courts/${id}`, data),
};

// ── Court Config (US-087) ────────────────────────────────────

export const courtConfigApi = {
  get: () => dashboardApi.get('/business/court-config'),
  update: (data: {
    sport_types?: string[];
    court_type?: string;
    surface_type?: string;
    has_lighting?: boolean;
    equipment_available?: string[];
    slot_duration_options?: number[];
    default_slot_duration_minutes?: number;
  }) => dashboardApi.patch('/business/court-config', data),
};

// ── Bays Inventory (US-100) ──────────────────────────────────

export const baysApi = {
  list: () => dashboardApi.get('/business/bays'),
  create: (data: { name_ar: string; name_en?: string; capacity?: number }) =>
    dashboardApi.post('/business/bays', data),
  update: (id: string, data: { name_ar?: string; name_en?: string; capacity?: number; is_active?: boolean }) =>
    dashboardApi.patch(`/business/bays/${id}`, data),
};

// ── Featured Listings (EP-17, US-118) ────────────────────────

export const featuredApi = {
  get: () => dashboardApi.get('/business/featured'),
  purchase: (plan: 'starter_7' | 'growth_14' | 'pro_30') =>
    dashboardApi.post('/business/featured', { plan }),
};

// ── Loyalty Analytics (US-114) ───────────────────────────────

export const loyaltyAnalyticsApi = {
  get: (days?: number) =>
    dashboardApi.get('/business/analytics/loyalty', { params: { days } }),
};

// ── Car Wash Config (US-101) ─────────────────────────────────

export const carWashConfigApi = {
  get: () => dashboardApi.get('/business/car-wash-config'),
  update: (data: {
    vehicle_types?: string[];
    service_packages?: object;
    allows_drop_off?: boolean;
    allows_wait?: boolean;
    estimated_duration_minutes?: number;
    slot_duration_options?: number[];
    default_slot_duration_minutes?: number;
  }) => dashboardApi.patch('/business/car-wash-config', data),
};
