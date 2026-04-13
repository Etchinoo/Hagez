// ============================================================
// SUPER RESERVATION PLATFORM — Main Dashboard Page (Bookings)
// ============================================================

'use client';

import DashboardShell from '@/components/DashboardShell';
import BookingCalendar from '@/components/BookingCalendar';
import OnboardingChecklist from '@/components/OnboardingChecklist';

export default function BookingsPage() {
  return (
    <DashboardShell pageTitle="page_bookings">
      <OnboardingChecklist />
      <BookingCalendar />
    </DashboardShell>
  );
}
