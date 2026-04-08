// ============================================================
// SUPER RESERVATION PLATFORM — Dashboard Auth Store (Zustand)
// ============================================================

import { create } from 'zustand';
import { authApi } from '../services/api';

const USER_KEY = 'reservr_biz_user';

interface BusinessUser {
  id: string;
  phone: string;
  full_name: string;
  role: 'business_owner' | 'admin' | 'super_admin' | 'consumer';
  business_category?: string;
}

interface DashboardAuthState {
  user: BusinessUser | null;
  isAuthenticated: boolean;
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  /** Persist tokens + user directly (used by signup flow after OTP verify). */
  setSession: (tokens: { access_token: string; refresh_token: string }, user: BusinessUser) => void;
  logout: () => void;
  /** Merge partial fields into the stored user (e.g. after a profile save). */
  patchUser: (patch: Partial<BusinessUser>) => void;
}

function loadUser(): BusinessUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as BusinessUser) : null;
  } catch {
    return null;
  }
}

export const useDashboardAuth = create<DashboardAuthState>((set) => ({
  user: loadUser(),
  isAuthenticated: typeof window !== 'undefined'
    ? !!localStorage.getItem('reservr_biz_access_token')
    : false,

  loginWithOtp: async (phone, otp) => {
    const res = await authApi.verifyOtp(phone, otp);
    const { access_token, refresh_token, user } = res.data;
    localStorage.setItem('reservr_biz_access_token', access_token);
    localStorage.setItem('reservr_biz_refresh_token', refresh_token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },

  setSession: (tokens, user) => {
    localStorage.setItem('reservr_biz_access_token', tokens.access_token);
    localStorage.setItem('reservr_biz_refresh_token', tokens.refresh_token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('reservr_biz_access_token');
    localStorage.removeItem('reservr_biz_refresh_token');
    localStorage.removeItem(USER_KEY);
    set({ user: null, isAuthenticated: false });
  },

  patchUser: (patch) => {
    set((state) => {
      if (!state.user) return state;
      const updated = { ...state.user, ...patch };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return { user: updated };
    });
  },
}));
