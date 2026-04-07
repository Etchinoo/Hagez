// ============================================================
// SUPER RESERVATION PLATFORM — Dashboard API Client
// Business dashboard API calls. JWT stored in localStorage
// (dashboard is web-only, not mobile — secure origin assumed).
// ============================================================

import axios, { type AxiosInstance } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/v1';

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
    if (error.response?.status === 401 && !original._retry) {
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
};

// ── Business Bookings ────────────────────────────────────────

export const bookingsApi = {
  list: (date?: string, view?: string) =>
    dashboardApi.get('/business/bookings', { params: { date, view } }),
  updateStatus: (id: string, status: 'completed' | 'no_show') =>
    dashboardApi.patch(`/business/bookings/${id}/status`, { status }),
  createManual: (data: {
    slot_id: string;
    consumer_name: string;
    consumer_phone: string;
    party_size?: number;
    deposit_waived?: boolean;
    special_requests?: string;
  }) => dashboardApi.post('/business/bookings', data),
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
