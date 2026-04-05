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

// ── Analytics ────────────────────────────────────────────────

export const analyticsApi = {
  summary: (month?: string) =>
    dashboardApi.get('/business/analytics/summary', { params: { month } }),
};
