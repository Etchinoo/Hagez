// ============================================================
// SUPER RESERVATION PLATFORM — Dashboard Shell
// Shared sidebar + topbar for all business dashboard pages.
// Wraps children in QueryClientProvider + RBAC guard.
// Supports AR (RTL) / EN (LTR) via language store.
// ============================================================

'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDashboardAuth } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { useRoleGuard } from '@/lib/rbac';
import { useToast } from '@/components/Toast';
import { useT, TRANSLATIONS, type TranslationKey } from '@/lib/i18n';

const queryClient = new QueryClient();

const NAV_ITEMS = [
  { href: '/',          labelKey: 'nav_bookings'  as const, icon: '📅', categories: null },
  { href: '/analytics', labelKey: 'nav_analytics' as const, icon: '📊', categories: null },
  { href: '/featured',  labelKey: 'nav_featured'  as const, icon: '⭐', categories: null },
  { href: '/staff',     labelKey: 'nav_staff'     as const, icon: '👤', categories: ['salon', 'restaurant', 'cafe'] },
  { href: '/courts',    labelKey: 'nav_courts'    as const, icon: '⚽', categories: ['court'] },
  { href: '/stations',  labelKey: 'nav_stations'  as const, icon: '🎮', categories: ['gaming_cafe'] },
  { href: '/bays',      labelKey: 'nav_bays'      as const, icon: '🚗', categories: ['car_wash'] },
  { href: '/services',  labelKey: 'nav_services'  as const, icon: '✂️', categories: ['salon', 'restaurant', 'cafe'] },
  { href: '/pricing',   labelKey: 'nav_pricing'   as const, icon: '💰', categories: null },
  { href: '/loyalty',   labelKey: 'nav_loyalty'   as const, icon: '🎁', categories: null },
  { href: '/settings',  labelKey: 'nav_settings'  as const, icon: '⚙️', categories: null },
  { href: '/profile',   labelKey: 'nav_profile'   as const, icon: '🏢', categories: null },
];

interface Props {
  children: React.ReactNode;
  /** Pass a TranslationKey (e.g. 'page_bookings') for auto language switching,
   *  or a plain string as fallback for custom titles. */
  pageTitle: TranslationKey | string;
}

export default function DashboardShell({ children, pageTitle }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <ShellInner pageTitle={pageTitle}>{children}</ShellInner>
    </QueryClientProvider>
  );
}

function ShellInner({ children, pageTitle }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, logout } = useDashboardAuth();
  const { toast } = useToast();
  const { lang, setLang } = useLanguage();
  const t = useT();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { allowed } = useRoleGuard('business');

  if (!allowed) return null;

  const isRtl = lang === 'ar';
  const dir   = isRtl ? 'rtl' : 'ltr';

  const handleLogout = () => { logout(); router.push('/login'); };

  const sidebarWidth = sidebarOpen ? '260px' : '72px';

  return (
    <div style={{ ...styles.shell, direction: dir, flexDirection: 'row' }}>
      {/* Sidebar — sits on the right in RTL, left in LTR */}
      <aside style={{ ...styles.sidebar, width: sidebarWidth }}>

        {/* Logo — fixed-height container, clickable → home */}
        <button
          onClick={() => router.push('/')}
          style={{
            width: '100%',
            height: sidebarOpen ? '56px' : '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
            padding: sidebarOpen ? '8px 20px' : '8px',
            boxSizing: 'border-box',
            background: 'none',
            border: 'none',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Hagez"
            style={{
              width:      '100%',
              height:     '100%',
              objectFit: 'contain',
              filter:    'brightness(0) invert(1)',
              transition: 'all 0.25s ease',
            }}
          />
        </button>

        {/* Navigation */}
        <nav style={styles.nav}>
          {NAV_ITEMS.filter((item) => {
            if (!item.categories) return true;
            return item.categories.includes(user?.business_category ?? '');
          }).map((item) => {
            const active = pathname === item.href;
            return (
              <button
                key={item.href}
                style={{
                  ...styles.navItem,
                  ...(active ? styles.navItemActive : {}),
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                }}
                onClick={() => router.push(item.href)}
              >
                <span style={styles.navIcon}>{item.icon}</span>
                {sidebarOpen && <span style={styles.navLabel}>{t(item.labelKey)}</span>}
              </button>
            );
          })}
        </nav>

        {/* Upsell */}
        {sidebarOpen && (
          <div style={styles.upsellBox}>
            <div style={styles.upsellTitle}>{t('upsell_title')}</div>
            <div style={styles.upsellDesc}>{t('upsell_desc')}</div>
            <button style={styles.upsellBtn} onClick={() => toast.info(t('upsell_toast'))}>
              {t('upsell_cta')}
            </button>
          </div>
        )}

        {/* User + Logout */}
        <div style={styles.sidebarFooter}>
          {sidebarOpen && user && (
            <div style={{ textAlign: isRtl ? 'right' : 'left' }}>
              <div style={styles.userName}>{user.full_name}</div>
              <div style={styles.userPhone}>{user.phone}</div>
            </div>
          )}
          <button style={styles.logoutBtn} onClick={handleLogout}>
            {sidebarOpen ? t('logout') : '🚪'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.topBar}>
          {/* Hamburger — always on the outer edge */}
          <button style={styles.menuToggle} onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>

          {/* Page title — auto-translated if a known key is passed */}
          <h1 style={{ ...styles.pageTitle, textAlign: isRtl ? 'right' : 'left' }}>
            {pageTitle in TRANSLATIONS.ar ? t(pageTitle as TranslationKey) : pageTitle}
          </h1>

          {/* Right-side controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Language toggle */}
            <div style={styles.langToggle}>
              <button
                style={{ ...styles.langBtn, ...(lang === 'ar' ? styles.langBtnActive : {}) }}
                onClick={() => setLang('ar')}
              >
                عربي
              </button>
              <button
                style={{ ...styles.langBtn, ...(lang === 'en' ? styles.langBtnActive : {}) }}
                onClick={() => setLang('en')}
              >
                EN
              </button>
            </div>

            {/* Manual booking CTA */}
            <button style={styles.addBookingBtn} onClick={() => toast.info(t('add_booking_soon'))}>
              {t('add_booking')}
            </button>
          </div>
        </div>

        <div style={styles.pageContent}>{children}</div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    // flexDirection and direction set dynamically above
  },
  sidebar: {
    backgroundColor: '#0F2044',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    overflowX: 'hidden',
    transition: 'width 0.25s ease',
    flexShrink: 0,
    borderLeft: '1px solid rgba(255,255,255,0.08)',
  },
  nav: {
    flex: 1,
    padding: '16px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    borderRadius: '10px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'rgba(255,255,255,0.7)',
    width: '100%',
    transition: 'background 0.15s',
    fontFamily: 'Cairo, Inter, sans-serif',
  },
  navItemActive: {
    background: 'rgba(27,138,122,0.3)',
    color: '#fff',
  },
  navIcon:  { fontSize: '20px', flexShrink: 0 },
  navLabel: { fontFamily: 'Cairo, Inter, sans-serif', fontSize: '15px', fontWeight: 600, flex: 1 },
  sidebarFooter: {
    padding: '16px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  userName:  { fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 700, fontSize: '14px', color: '#fff' },
  userPhone: { fontFamily: 'Cairo, Inter, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' },
  logoutBtn: {
    padding: '8px 12px',
    background: 'rgba(211,47,47,0.15)',
    border: 'none',
    borderRadius: '8px',
    fontFamily: 'Cairo, Inter, sans-serif',
    fontSize: '13px',
    color: '#FF6B6B',
    cursor: 'pointer',
    textAlign: 'center',
  },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    height: '64px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #E5E7EB',
    gap: '16px',
  },
  menuToggle: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '8px',
    flexShrink: 0,
  },
  pageTitle: {
    fontFamily: 'Cairo, Inter, sans-serif',
    fontSize: '20px',
    fontWeight: 700,
    color: '#0F2044',
    flex: 1,
    margin: 0,
  },
  addBookingBtn: {
    padding: '10px 20px',
    background: '#1B8A7A',
    border: 'none',
    borderRadius: '10px',
    fontFamily: 'Cairo, Inter, sans-serif',
    fontSize: '14px',
    fontWeight: 700,
    color: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  // Language toggle
  langToggle: {
    display: 'flex',
    border: '1.5px solid #E5E7EB',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  langBtn: {
    padding: '6px 12px',
    background: 'none',
    border: 'none',
    fontFamily: 'Cairo, Inter, sans-serif',
    fontSize: '13px',
    fontWeight: 600,
    color: '#6B7280',
    cursor: 'pointer',
  },
  langBtnActive: {
    background: '#0F2044',
    color: '#fff',
  },
  pageContent: {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
    display: 'block',
  },
  upsellBox: {
    margin: '0 8px 8px',
    padding: '12px',
    background: 'rgba(27,138,122,0.12)',
    borderRadius: '10px',
    border: '1px solid rgba(27,138,122,0.3)',
  },
  upsellTitle: { fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 700, fontSize: '13px', color: '#fff', marginBottom: '4px' },
  upsellDesc:  { fontFamily: 'Cairo, Inter, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' },
  upsellBtn:   { width: '100%', padding: '6px', background: '#1B8A7A', border: 'none', borderRadius: '6px', fontFamily: 'Cairo, Inter, sans-serif', fontSize: '12px', fontWeight: 700, color: '#fff', cursor: 'pointer' },
};
