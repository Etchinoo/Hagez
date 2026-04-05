// ============================================================
// SUPER RESERVATION PLATFORM — Auth Store (Zustand)
// Persists auth state. Manages login/logout lifecycle.
// ============================================================

import { create } from 'zustand';
import { tokenStorage, authApi, usersApi } from '../services/api';

interface AuthUser {
  id: string;
  phone: string;
  full_name: string;
  language_pref: 'ar' | 'en';
  no_show_count: number;
  deposit_mandatory: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    const token = await tokenStorage.getAccess();
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }
    // Token exists — fetch full user profile to hydrate store
    try {
      const res = await usersApi.getMe();
      set({ user: res.data, isLoading: false, isAuthenticated: true });
    } catch {
      // Token expired or invalid — clear and redirect to login
      await tokenStorage.clear();
      set({ user: null, isLoading: false, isAuthenticated: false });
    }
  },

  loginWithOtp: async (phone: string, otp: string) => {
    const res = await authApi.verifyOtp(phone, otp);
    const { access_token, refresh_token, user } = res.data;
    await tokenStorage.setTokens(access_token, refresh_token);
    // user returned from /auth/otp/verify may have full_name = phone on first login.
    // Fetch full profile to ensure store is up to date.
    try {
      const profileRes = await usersApi.getMe();
      set({ user: profileRes.data, isAuthenticated: true });
    } catch {
      set({ user, isAuthenticated: true });
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      await tokenStorage.clear();
      set({ user: null, isAuthenticated: false });
    }
  },

  setUser: (user: AuthUser) => set({ user }),
}));
