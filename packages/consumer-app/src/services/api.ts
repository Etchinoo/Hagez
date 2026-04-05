// ============================================================
// SUPER RESERVATION PLATFORM — Consumer App API Client
// Base URL configured via EXPO_PUBLIC_API_BASE_URL env var.
// JWT tokens stored in SecureStore (encrypted on-device).
// Auto-refresh on 401 responses.
// ============================================================

import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl
  ?? process.env.EXPO_PUBLIC_API_BASE_URL
  ?? 'http://localhost:3000/v1';

const ACCESS_TOKEN_KEY = 'reservr_access_token';
const REFRESH_TOKEN_KEY = 'reservr_refresh_token';

// ── Token Storage ────────────────────────────────────────────

export const tokenStorage = {
  getAccess: () => SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
  getRefresh: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  setTokens: async (access: string, refresh: string) => {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh),
    ]);
  },
  clear: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
  },
};

// ── Axios Instance ───────────────────────────────────────────

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    'Accept-Language': 'ar',   // Default Arabic responses
  },
});

// Attach Bearer token to every request
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await tokenStorage.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = await tokenStorage.getRefresh();
      if (!refreshToken) throw error;

      try {
        const res = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
        const newAccessToken: string = res.data.access_token;
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, newAccessToken);
        original.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(original);
      } catch {
        await tokenStorage.clear();
        throw error;
      }
    }
    return Promise.reject(error);
  }
);

// ── Users API ────────────────────────────────────────────────

export const usersApi = {
  getMe: () => api.get('/users/me'),
  updateMe: (data: { full_name?: string; language_pref?: string }) =>
    api.patch('/users/me', data),
};

// userApi alias (used in payment screen for card-on-file check)
export const userApi = {
  getProfile: () => api.get('/users/me'),
  saveCardToken: (paymob_card_token: string) =>
    api.post('/users/me/payment-token', { paymob_card_token }),
  removeCardToken: () => api.delete('/users/me/payment-token'),
  getReceipt: (bookingId: string) => api.get(`/bookings/${bookingId}/receipt`),
};

// ── Auth API ─────────────────────────────────────────────────

export const authApi = {
  requestOtp: (phone: string) => api.post('/auth/otp/request', { phone }),
  verifyOtp: (phone: string, otp: string) => api.post('/auth/otp/verify', { phone, otp }),
  logout: () => api.post('/auth/logout'),
};

// ── Search API ───────────────────────────────────────────────

export const searchApi = {
  searchBusinesses: (params: Record<string, string | number | undefined>) =>
    api.get('/search/businesses', { params }),
  autocomplete: (q: string, category?: string) =>
    api.get('/search/autocomplete', { params: { q, category } }),
  getBusiness: (id: string) => api.get(`/businesses/${id}`),
  getBusinessSlots: (id: string, date: string, partySize: number, resourceId?: string) =>
    api.get(`/businesses/${id}/slots`, { params: { date, party_size: partySize, resource_id: resourceId } }),
  getBusinessReviews: (id: string, page = 1) =>
    api.get(`/businesses/${id}/reviews`, { params: { page } }),
};

// ── Booking API ──────────────────────────────────────────────

export const bookingApi = {
  createBooking: (data: {
    slot_id: string;
    business_id: string;
    party_size: number;
    resource_id?: string;
    occasion?: string;
    special_requests?: string;
    section_preference?: string;
    override_consumer_overlap?: boolean;
  }) => api.post('/bookings', data),

  initiatePayment: (bookingId: string, paymentMethod: string) =>
    api.post(`/bookings/${bookingId}/pay`, { payment_method: paymentMethod }),

  getBooking: (id: string) => api.get(`/bookings/${id}`),

  listBookings: (status?: string, page = 1) =>
    api.get('/bookings', { params: { status, page } }),

  cancelBooking: (id: string, reason?: string) =>
    api.patch(`/bookings/${id}/cancel`, { reason }),

  rescheduleBooking: (id: string, newSlotId: string) =>
    api.patch(`/bookings/${id}/reschedule`, { new_slot_id: newSlotId }),

  submitReview: (bookingId: string, rating: number, body?: string) =>
    api.post(`/bookings/${bookingId}/reviews`, { rating, body }),
};
