// ============================================================
// SUPER RESERVATION PLATFORM — RBAC Module
// Single source of truth for role-based access control.
//
// Zones:
//   'business' — business owner dashboard (/bookings)
//   'admin'    — internal ops console (/admin)
//
// Usage:
//   const { allowed } = useRoleGuard('business');
//   if (!allowed) return null;
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardAuth } from '@/store/auth';

export type UserRole = 'business_owner' | 'admin' | 'super_admin' | 'consumer';
export type RbacZone = 'business' | 'admin';

// Where each role lands after login
export const ROLE_HOME: Record<UserRole, string | null> = {
  business_owner: '/bookings',
  admin:          '/admin',
  super_admin:    '/admin',
  consumer:       null,   // not allowed in any dashboard zone
};

// Which roles are permitted in each zone
const ZONE_ROLES: Record<RbacZone, UserRole[]> = {
  business: ['business_owner'],
  admin:    ['admin', 'super_admin'],
};

// ── useRoleGuard ─────────────────────────────────────────────
// Call at the top of any layout/page that needs role protection.
// Returns { allowed: boolean } after hydration.
// While checking (SSR / first render) returns { allowed: false }
// so the page renders nothing until we know the role is valid.

export function useRoleGuard(zone: RbacZone): { allowed: boolean } {
  const router                      = useRouter();
  const { user, isAuthenticated }   = useDashboardAuth();
  const [hydrated, setHydrated]     = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (!hydrated) return;

    // Not logged in at all → login
    if (!isAuthenticated || !user) {
      router.replace('/login');
      return;
    }

    const allowedRoles = ZONE_ROLES[zone];

    if (!allowedRoles.includes(user.role as UserRole)) {
      // Redirect to the correct home for this role, or login if none
      const home = ROLE_HOME[user.role as UserRole];
      router.replace(home ?? '/login');
    }
  }, [hydrated, isAuthenticated, user, zone, router]);

  if (!hydrated || !isAuthenticated || !user) return { allowed: false };

  const allowedRoles = ZONE_ROLES[zone];
  return { allowed: allowedRoles.includes(user.role as UserRole) };
}

// ── redirectAfterLogin ────────────────────────────────────────
// Call in the login page after a successful OTP verify.
// Returns the destination path, or null if the role is not
// permitted in any dashboard zone (e.g. consumer).

export function getLoginRedirect(role: string): string | null {
  return ROLE_HOME[role as UserRole] ?? null;
}
