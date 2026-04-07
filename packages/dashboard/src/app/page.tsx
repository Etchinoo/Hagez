// ============================================================
// SUPER RESERVATION PLATFORM — Main Dashboard Page
// Booking calendar with RTL sidebar navigation.
// Tablet-first layout (sidebar on RIGHT per design spec).
// ============================================================

'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import BookingCalendar from '@/components/BookingCalendar';
import OnboardingChecklist from '@/components/OnboardingChecklist';
import { useDashboardAuth } from '@/store/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

const NAV_ITEMS = [
  { href: '/',          label: 'الحجوزات',   icon: '📅' },
  { href: '/analytics', label: 'الإحصائيات', icon: '📊' },
  { href: '/staff',     label: 'الموظفون',   icon: '👤' },
  { href: '/services',  label: 'الخدمات',    icon: '✂️' },
  { href: '/settings',  label: 'الإعدادات',  icon: '⚙️' },
];

export default function DashboardPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardLayout>
        <BookingCalendar />
      </DashboardLayout>
    </QueryClientProvider>
  );
}

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useDashboardAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div style={styles.shell}>
      {/* Right Sidebar (RTL: sidebar is on the RIGHT per design spec) */}
      <aside style={{ ...styles.sidebar, width: sidebarOpen ? '260px' : '72px' }}>
        {/* Logo */}
        <div style={styles.logoArea}>
          <div style={styles.logoMark} />
          {sidebarOpen && (
            <div>
              <div style={styles.logoText}>سوبر ريزرفيشن</div>
              <div style={styles.logoSub}>لوحة التحكم</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav style={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.href}
              style={{
                ...styles.navItem,
                ...(pathname === item.href ? styles.navItemActive : {}),
              }}
              onClick={() => router.push(item.href)}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {sidebarOpen && <span style={styles.navLabel}>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Multi-Branch Upsell (US-061) — shows for free/starter */}
        {sidebarOpen && (
          <div style={styles.upsellBox}>
            <div style={styles.upsellTitle}>تعدد الفروع</div>
            <div style={styles.upsellDesc}>أضف فروعاً متعددة بترقية Growth</div>
            <button style={styles.upsellBtn} onClick={() => alert('للترقية، تواصل مع فريق Super Reservation')}>
              ترقية الباقة
            </button>
          </div>
        )}

        {/* User + Logout */}
        <div style={styles.sidebarFooter}>
          {sidebarOpen && user && (
            <div style={styles.userInfo}>
              <div style={styles.userName}>{user.full_name}</div>
              <div style={styles.userPhone}>{user.phone}</div>
            </div>
          )}
          <button style={styles.logoutBtn} onClick={handleLogout}>
            {sidebarOpen ? 'خروج' : '🚪'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={styles.main}>
        {/* Top Bar */}
        <div style={styles.topBar}>
          <button style={styles.menuToggle} onClick={() => setSidebarOpen(!sidebarOpen)}>
            ☰
          </button>
          <h1 style={styles.pageTitle}>الحجوزات</h1>
          <button style={styles.addBookingBtn} onClick={() => alert('سيتم إضافة الحجز اليدوي قريباً')}>
            + حجز يدوي
          </button>
        </div>

        {/* Page Content */}
        <div style={styles.pageContent}>
          <OnboardingChecklist />
          {children}
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', flexDirection: 'row-reverse', height: '100vh', overflow: 'hidden' },

  // RTL: Sidebar is on the RIGHT
  sidebar: {
    backgroundColor: '#0F2044', color: '#fff',
    display: 'flex', flexDirection: 'column',
    padding: '0', overflowX: 'hidden',
    transition: 'width 0.25s ease',
    flexShrink: 0,
    borderLeft: '1px solid rgba(255,255,255,0.08)',
  },
  logoArea: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  logoMark: { width: '40px', height: '40px', borderRadius: '10px', background: '#1B8A7A', flexShrink: 0 },
  logoText: { fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '16px', color: '#fff' },
  logoSub: { fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '2px' },
  nav: { flex: 1, padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: '4px' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px 12px', borderRadius: '10px',
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'rgba(255,255,255,0.7)', width: '100%', textAlign: 'right',
    transition: 'background 0.15s',
  },
  navItemActive: { background: 'rgba(27,138,122,0.3)', color: '#fff' },
  navIcon: { fontSize: '20px', flexShrink: 0 },
  navLabel: { fontFamily: 'Cairo, sans-serif', fontSize: '15px', fontWeight: 600, flex: 1 },
  sidebarFooter: {
    padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)',
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  userInfo: {},
  userName: { fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '14px', color: '#fff' },
  userPhone: { fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' },
  logoutBtn: {
    padding: '8px 12px', background: 'rgba(211,47,47,0.15)', border: 'none',
    borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '13px',
    color: '#FF6B6B', cursor: 'pointer', textAlign: 'center',
  },

  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  topBar: {
    display: 'flex', alignItems: 'center', padding: '0 24px', height: '64px',
    backgroundColor: '#fff', borderBottom: '1px solid #E5E7EB',
    flexDirection: 'row-reverse', gap: '16px',
  },
  menuToggle: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '8px' },
  pageTitle: { fontFamily: 'Cairo, sans-serif', fontSize: '20px', fontWeight: 700, color: '#0F2044', flex: 1, textAlign: 'right', margin: 0 },
  addBookingBtn: {
    padding: '10px 20px', background: '#1B8A7A', border: 'none', borderRadius: '10px',
    fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: 700, color: '#fff', cursor: 'pointer',
  },
  pageContent: { flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column' },
  upsellBox: {
    margin: '0 8px 8px', padding: '12px', background: 'rgba(27,138,122,0.12)',
    borderRadius: '10px', border: '1px solid rgba(27,138,122,0.3)',
  },
  upsellTitle: { fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px', color: '#fff', marginBottom: '4px' },
  upsellDesc: { fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' },
  upsellBtn: { width: '100%', padding: '6px', background: '#1B8A7A', border: 'none', borderRadius: '6px', fontFamily: 'Cairo, sans-serif', fontSize: '12px', fontWeight: 700, color: '#fff', cursor: 'pointer' },
};
