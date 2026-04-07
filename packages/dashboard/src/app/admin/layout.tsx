// ============================================================
// SUPER RESERVATION PLATFORM — Admin Console Layout
// EP-09: Internal ops tool for business verification,
//        dispute resolution, and platform health monitoring.
// LTR layout — ops team uses English.
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useDashboardAuth } from '@/store/auth';

const NAV_ITEMS = [
  { href: '/admin/health',     label: 'Platform Health', icon: '📊' },
  { href: '/admin/businesses', label: 'Businesses',      icon: '🏢' },
  { href: '/admin/disputes',   label: 'Disputes',        icon: '⚖️' },
  { href: '/admin/refunds',    label: 'Refunds',         icon: '↩️' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useDashboardAuth();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (user && user.role !== 'admin' && user.role !== 'super_admin') {
      router.replace('/');
    }
  }, [hydrated, isAuthenticated, user, router]);

  if (!hydrated || !isAuthenticated || !user) return null;
  if (user.role !== 'admin' && user.role !== 'super_admin') return null;

  const handleLogout = () => { logout(); router.push('/login'); };

  return (
    <div style={styles.shell}>
      {/* Left Sidebar — LTR for ops console */}
      <aside style={styles.sidebar}>
        <div style={styles.logoArea}>
          <div style={styles.logoMark} />
          <div>
            <div style={styles.logoText}>Super Reservation</div>
            <div style={styles.logoSub}>Admin Console</div>
          </div>
        </div>

        <nav style={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.href}
              style={{
                ...styles.navItem,
                ...(pathname.startsWith(item.href) ? styles.navItemActive : {}),
              }}
              onClick={() => router.push(item.href)}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              <span style={styles.navLabel}>{item.label}</span>
            </button>
          ))}
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.userInfo}>
            <div style={styles.userName}>{user.full_name}</div>
            <div style={styles.userRole}>
              {user.role === 'super_admin' ? '⭐ Super Admin' : 'Admin'}
            </div>
          </div>
          <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </aside>

      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', height: '100vh', overflow: 'hidden', direction: 'ltr' },
  sidebar: {
    width: '240px', backgroundColor: '#0F2044', color: '#fff',
    display: 'flex', flexDirection: 'column', flexShrink: 0,
    borderRight: '1px solid rgba(255,255,255,0.08)',
  },
  logoArea: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  logoMark: { width: '36px', height: '36px', borderRadius: '8px', background: '#D32F2F', flexShrink: 0 },
  logoText: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '14px', color: '#fff' },
  logoSub: { fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' },
  nav: { flex: 1, padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: '4px' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 12px', borderRadius: '8px',
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'rgba(255,255,255,0.65)', width: '100%', textAlign: 'left',
  },
  navItemActive: { background: 'rgba(211,47,47,0.25)', color: '#fff' },
  navIcon: { fontSize: '18px', flexShrink: 0 },
  navLabel: { fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600 },
  sidebarFooter: {
    padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)',
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  userInfo: {},
  userName: { fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '13px', color: '#fff' },
  userRole: { fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' },
  logoutBtn: {
    padding: '7px 12px', background: 'rgba(211,47,47,0.15)', border: 'none',
    borderRadius: '6px', fontFamily: 'Inter, sans-serif', fontSize: '13px',
    color: '#FF6B6B', cursor: 'pointer', textAlign: 'center',
  },
  main: { flex: 1, overflow: 'auto', backgroundColor: '#F7F8FA' },
};
