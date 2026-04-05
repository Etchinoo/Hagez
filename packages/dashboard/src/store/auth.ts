// ============================================================
// SUPER RESERVATION PLATFORM — Dashboard Auth Store (Zustand)
// ============================================================

import { create } from 'zustand';
import { authApi } from '../services/api';

interface BusinessUser {
  id: string;
  phone: string;
  full_name: string;
  role: 'business_owner' | 'admin' | 'super_admin';
}

interface DashboardAuthState {
  user: BusinessUser | null;
  isAuthenticated: boolean;
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  logout: () => void;
}

export const useDashboardAuth = create<DashboardAuthState>((set) => ({
  user: null,
  isAuthenticated: typeof window !== 'undefined'
    ? !!localStorage.getItem('reservr_biz_access_token')
    : false,

  loginWithOtp: async (phone, otp) => {
    const res = await authApi.verifyOtp(phone, otp);
    const { access_token, refresh_token, user } = res.data;
    localStorage.setItem('reservr_biz_access_token', access_token);
    localStorage.setItem('reservr_biz_refresh_token', refresh_token);
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('reservr_biz_access_token');
    localStorage.removeItem('reservr_biz_refresh_token');
    set({ user: null, isAuthenticated: false });
  },
}));
