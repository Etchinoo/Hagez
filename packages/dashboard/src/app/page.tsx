// ============================================================
// HAGEZ — Public Landing Page (hagez.app)
// Arabic-first, RTL. Visible to all visitors before sign-in.
// Authenticated users are redirected to their zone immediately.
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useDashboardAuth } from '@/store/auth';
import { getLoginRedirect } from '@/lib/rbac';

// ── Store link constants (update here when app is published) ─
const APP_STORE_URL = '#';
const PLAY_STORE_URL = '#';

// ── Auth-aware redirect ───────────────────────────────────────
function useAuthRedirect() {
  const { user, isAuthenticated } = useDashboardAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const dest = getLoginRedirect(user.role);
    if (dest) router.replace(dest);
  }, [isAuthenticated, user, router]);
}

// ── App Store badge ───────────────────────────────────────────
function AppStoreBadge({ isRTL }: { isRTL: boolean }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <a
        href={APP_STORE_URL}
        aria-label="Download on the App Store — Coming soon"
        onClick={(e) => e.preventDefault()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 18px',
          background: '#000000',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.15)',
          textDecoration: 'none',
          color: '#FFFFFF',
          cursor: 'default',
          minWidth: 155,
        }}
      >
        {/* Apple icon */}
        <svg width="20" height="24" viewBox="0 0 20 24" fill="white" aria-hidden="true">
          <path d="M16.05 12.6c-.02-2.58 2.1-3.82 2.19-3.88-1.19-1.74-3.05-1.98-3.71-2.01-1.58-.16-3.08.93-3.88.93-.8 0-2.04-.91-3.35-.88-1.72.02-3.31 1-4.19 2.54C1.2 12.04 2.47 17.6 4.3 20.6c.9 1.47 1.98 3.12 3.4 3.06 1.37-.06 1.88-.88 3.54-.88 1.65 0 2.12.88 3.56.85 1.47-.02 2.4-1.5 3.3-2.97a13.3 13.3 0 001.49-3.44c-.03-.01-2.52-.97-2.54-3.62zM13.44 4.5c.74-.9 1.24-2.14 1.1-3.38-1.07.04-2.35.71-3.12 1.6-.68.78-1.28 2.04-1.12 3.24 1.2.09 2.42-.6 3.14-1.46z"/>
        </svg>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 9, opacity: 0.75, letterSpacing: 0.5 }}>Download on the</div>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.3, fontFamily: 'Inter, sans-serif' }}>App Store</div>
        </div>
      </a>

      {hovered && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            [isRTL ? 'right' : 'left']: '50%',
            transform: isRTL ? 'translateX(50%)' : 'translateX(-50%)',
            background: '#1F2937',
            color: '#F9FAFB',
            fontSize: 12,
            fontWeight: 600,
            padding: '5px 10px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {isRTL ? 'قريباً' : 'Coming Soon'}
        </div>
      )}
    </div>
  );
}

// ── Google Play badge ─────────────────────────────────────────
function PlayStoreBadge({ isRTL }: { isRTL: boolean }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <a
        href={PLAY_STORE_URL}
        aria-label="Get it on Google Play — Coming soon"
        onClick={(e) => e.preventDefault()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 18px',
          background: '#000000',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.15)',
          textDecoration: 'none',
          color: '#FFFFFF',
          cursor: 'default',
          minWidth: 155,
        }}
      >
        {/* Google Play triangle icon */}
        <svg width="20" height="22" viewBox="0 0 20 22" aria-hidden="true">
          <path d="M1.22.84l10.88 10.9L1.22 22.6A1.5 1.5 0 010 21.26V1.18A1.5 1.5 0 011.22.84z" fill="#EA4335"/>
          <path d="M17.45 9.45L14.3 7.65 11.04 11l3.26 3.35 3.15-1.8a1.5 1.5 0 000-3.1z" fill="#FBBC04"/>
          <path d="M1.22.84L12.1 11.74l-1.06 1.06L1.22.84z" fill="#4285F4" opacity=".8"/>
          <path d="M1.22 22.6l9.82-9.82 1.06 1.06L1.22 22.6z" fill="#34A853" opacity=".8"/>
        </svg>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 9, opacity: 0.75, letterSpacing: 0.5 }}>Get it on</div>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.3, fontFamily: 'Inter, sans-serif' }}>Google Play</div>
        </div>
      </a>

      {hovered && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            [isRTL ? 'right' : 'left']: '50%',
            transform: isRTL ? 'translateX(50%)' : 'translateX(-50%)',
            background: '#1F2937',
            color: '#F9FAFB',
            fontSize: 12,
            fontWeight: 600,
            padding: '5px 10px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {isRTL ? 'قريباً' : 'Coming Soon'}
        </div>
      )}
    </div>
  );
}

// ── Store badges row ──────────────────────────────────────────
function StoreBadges({ isRTL, justify = 'center' }: { isRTL: boolean; justify?: string }) {
  return (
    <div
      className="store-badges-row"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: justify }}
    >
      <AppStoreBadge isRTL={isRTL} />
      <PlayStoreBadge isRTL={isRTL} />
    </div>
  );
}

// ── Logo component ────────────────────────────────────────────
interface LogoProps {
  height: number;
  /** Use white/inverted version for dark backgrounds */
  inverted?: boolean;
}

function HagezLogo({ height, inverted = false }: LogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="Hagez — حاجز"
      height={height}
      width={0}
      style={{
        height,
        width: 'auto',
        display: 'block',
        filter: inverted ? 'brightness(0) invert(1)' : 'none',
      }}
      priority
    />
  );
}

// ── Section data ─────────────────────────────────────────────
const CATEGORIES = [
  { emoji: '🍽️', ar: 'مطاعم',        en: 'Restaurants', color: '#D2691E', phase2: false },
  { emoji: '💇', ar: 'صالونات',      en: 'Salons',       color: '#E91E63', phase2: false },
  { emoji: '⚽', ar: 'ملاعب رياضية', en: 'Courts',       color: '#4CAF50', phase2: true  },
  { emoji: '🎮', ar: 'كافيه جيمنج',  en: 'Gaming Cafes', color: '#9C27B0', phase2: true  },
  { emoji: '🚗', ar: 'غسيل سيارات',  en: 'Car Wash',     color: '#00BCD4', phase2: true  },
];

const FEATURES = [
  { emoji: '⚡', ar: 'حجز فوري',       en: 'Instant Booking',    desc_ar: 'تأكيد لحظي بعد الدفع',                  desc_en: 'Instant confirmation after payment'    },
  { emoji: '🔒', ar: 'دفع آمن',        en: 'Secure Payments',    desc_ar: 'بوابة Paymob – بطاقات وفوري وفودافون',  desc_en: 'Paymob gateway – cards, Fawry & more'  },
  { emoji: '📅', ar: 'جدولة ذكية',     en: 'Smart Scheduling',   desc_ar: 'لا تعارضات، كل شيء منظم تلقائياً',     desc_en: 'No conflicts, auto-organized slots'     },
  { emoji: '🛡️', ar: 'حماية الوديعة', en: 'Deposit Protection', desc_ar: 'الوديعة تضمن الجدية وتحمي الطرفين',   desc_en: 'Deposit ensures commitment for both sides' },
];

// ── Main component ────────────────────────────────────────────
export default function LandingPage() {
  useAuthRedirect();

  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [signInOpen, setSignInOpen] = useState(false);
  const isRTL = lang === 'ar';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    return () => {
      document.documentElement.lang = 'ar';
      document.documentElement.dir = 'rtl';
    };
  }, [lang, isRTL]);

  const t = (ar: string, en: string) => (isRTL ? ar : en);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F7F8FA',
        color: '#0F2044',
        fontFamily: "'Cairo', 'Inter', sans-serif",
        direction: isRTL ? 'rtl' : 'ltr',
      }}
    >
      {/* ── Navbar ─────────────────────────────────────────── */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          padding: '0 24px',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        {/* Logo — 32px height, links to /, Navy variant on white bg */}
        <Link href="/" aria-label="Hagez home" style={{ display: 'flex', flexShrink: 0 }}>
          <HagezLogo height={32} inverted={false} />
        </Link>

        {/* Nav actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setLang(isRTL ? 'en' : 'ar')}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: '1px solid #E5E7EB',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: '#0F2044',
            }}
          >
            {isRTL ? 'EN' : 'ع'}
          </button>

          {/* Sign In dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setSignInOpen((o) => !o)}
              style={{
                padding: '8px 20px',
                borderRadius: 24,
                border: 'none',
                background: '#0F2044',
                color: '#FFFFFF',
                fontFamily: "'Cairo', 'Inter', sans-serif",
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {t('تسجيل الدخول', 'Sign In')}
              <span style={{ fontSize: 10, opacity: 0.7 }}>▼</span>
            </button>

            {signInOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  onClick={() => setSignInOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    [isRTL ? 'left' : 'right']: 0,
                    minWidth: 220,
                    background: '#FFFFFF',
                    borderRadius: 16,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    overflow: 'hidden',
                    zIndex: 50,
                  }}
                >
                  <Link
                    href="/login"
                    onClick={() => setSignInOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', textDecoration: 'none', color: '#0F2044' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F7F8FA')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                      🏢
                    </span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{t('لوحة تحكم العمل', 'Business Dashboard')}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>{t('للمطاعم والصالونات وغيرها', 'Restaurants, salons & more')}</p>
                    </div>
                  </Link>

                  <div style={{ height: 1, background: '#F3F4F6', margin: '0 12px' }} />

                  <Link
                    href="/login"
                    onClick={() => setSignInOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', textDecoration: 'none', color: '#0F2044' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F7F8FA')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                      🛡️
                    </span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{t('بوابة الإدارة', 'Admin Portal')}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>{t('فريق عمليات روبوستا', 'Robusta operations team')}</p>
                    </div>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section
        style={{
          background: 'linear-gradient(135deg, #0F2044 0%, #003d5c 55%, #1B8A7A 100%)',
          padding: '80px 24px 100px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: '20%', left: '10%', width: 320, height: 320, borderRadius: '50%', background: 'rgba(27,138,122,0.15)', filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', filter: 'blur(60px)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              borderRadius: 20,
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.85)',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 24,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ADE80', display: 'inline-block' }} />
            {t('متاح الآن في القاهرة', 'Now live in Cairo, Egypt')}
          </div>

          <h1
            style={{
              fontSize: 'clamp(36px, 6vw, 64px)',
              fontWeight: 800,
              color: '#FFFFFF',
              margin: '0 0 20px',
              lineHeight: 1.15,
            }}
          >
            {t('احجز لحظتك', 'Book Your Moment')}
          </h1>

          <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: 'rgba(255,255,255,0.75)', margin: '0 auto 36px', maxWidth: 520, lineHeight: 1.7 }}>
            {t('أسهل طريقة لحجز المطاعم والصالونات والمزيد في مصر', 'The easiest way to book restaurants, salons & more across Egypt')}
          </p>

          {/* Download badges — hero location */}
          <div style={{ marginBottom: 32 }}>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 14 }}>
              {t('حمّل التطبيق', 'Download the App')}
            </p>
            <StoreBadges isRTL={isRTL} justify="center" />
          </div>

          {/* Dashboard CTAs */}
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/login"
              style={{
                padding: '12px 28px',
                borderRadius: 32,
                background: '#FFFFFF',
                color: '#0F2044',
                fontFamily: "'Cairo', 'Inter', sans-serif",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              }}
            >
              🏢 {t('لوحة تحكم العمل', 'Business Dashboard')}
            </Link>
            <a
              href="#categories"
              style={{
                padding: '12px 28px',
                borderRadius: 32,
                background: 'rgba(255,255,255,0.12)',
                border: '1.5px solid rgba(255,255,255,0.35)',
                color: '#FFFFFF',
                fontFamily: "'Cairo', 'Inter', sans-serif",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              {t('استكشف الفئات', 'Explore Categories')}
            </a>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section style={{ padding: '72px 24px', background: '#F7F8FA' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, color: '#0F2044', margin: '0 0 8px' }}>
            {t('لماذا تختار حاجز؟', 'Why Choose Hagez?')}
          </h2>
          <p style={{ textAlign: 'center', color: '#6B7280', margin: '0 0 48px', fontSize: 16 }}>
            {t('المنصة الأولى للحجز في مصر', "Egypt's leading lifestyle booking platform")}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 20 }}>
            {FEATURES.map((f) => (
              <div
                key={f.en}
                style={{ background: '#FFFFFF', borderRadius: 16, padding: '24px 20px', boxShadow: '0 2px 8px rgba(15,32,68,0.06)' }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(27,138,122,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 14 }}>
                  {f.emoji}
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#0F2044' }}>{t(f.ar, f.en)}</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>{t(f.desc_ar, f.desc_en)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categories ─────────────────────────────────────── */}
      <section id="categories" style={{ padding: '72px 24px', background: '#FFFFFF' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, color: '#0F2044', margin: '0 0 8px' }}>
            {t('الفئات المتاحة', 'Available Categories')}
          </h2>
          <p style={{ textAlign: 'center', color: '#6B7280', margin: '0 0 48px', fontSize: 16 }}>
            {t('كل ما تحتاجه في مكان واحد', 'Everything you need in one place')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            {CATEGORIES.map((c) => (
              <div
                key={c.en}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 16,
                  padding: '28px 20px',
                  textAlign: 'center',
                  boxShadow: '0 2px 8px rgba(15,32,68,0.06)',
                  borderTop: `4px solid ${c.color}`,
                  position: 'relative',
                  opacity: c.phase2 ? 0.72 : 1,
                }}
              >
                {c.phase2 && (
                  <span style={{ position: 'absolute', top: 10, [isRTL ? 'left' : 'right']: 10, background: c.color, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8 }}>
                    {t('قريباً', 'Soon')}
                  </span>
                )}
                <div style={{ fontSize: 36, marginBottom: 12 }}>{c.emoji}</div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#0F2044' }}>{t(c.ar, c.en)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Business sign-in CTA ────────────────────────────── */}
      <section style={{ padding: '72px 24px', background: 'linear-gradient(135deg, #0F2044, #1B8A7A)', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, color: '#FFFFFF', margin: '0 0 12px' }}>
          {t('هل أنت صاحب عمل؟', 'Are you a business owner?')}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.75)', margin: '0 0 36px', fontSize: 16, maxWidth: 480, marginInline: 'auto' }}>
          {t('سجّل دخولك للوحة التحكم وابدأ إدارة حجوزاتك الآن', 'Sign in to your dashboard and start managing your bookings today')}
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/login" style={{ padding: '14px 36px', borderRadius: 32, background: '#FFFFFF', color: '#0F2044', fontFamily: "'Cairo', 'Inter', sans-serif", fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
            {t('تسجيل الدخول – لوحة التحكم', 'Sign In – Business Dashboard')}
          </Link>
          <Link href="/signup" style={{ padding: '14px 36px', borderRadius: 32, background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.35)', color: '#FFFFFF', fontFamily: "'Cairo', 'Inter', sans-serif", fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
            {t('إنشاء حساب جديد', 'Create an Account')}
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer style={{ background: '#0F2044', padding: '48px 24px 32px', textAlign: 'center' }}>

        {/* Logo — 24px height, white variant on dark background */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <HagezLogo height={24} inverted={true} />
        </div>

        <p style={{ margin: '0 0 24px', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
          {t('احجز لحظتك', 'Book Your Moment')} · Cairo, Egypt
        </p>

        {/* Download badges — footer location */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 12 }}>
            {t('حمّل التطبيق', 'Download the App')}
          </p>
          <StoreBadges isRTL={isRTL} justify="center" />
        </div>

        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
          {[
            { label: t('سياسة الخصوصية', 'Privacy Policy'), href: '/privacy' },
            { label: t('شروط الاستخدام', 'Terms of Service'), href: '/terms' },
            { label: t('تواصل معنا', 'Contact Us'), href: 'mailto:hello@hagez.app' },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={href}
              style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, textDecoration: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
            >
              {label}
            </a>
          ))}
        </div>

        {/* Copyright — dynamic year, Hagez only (US-WEB-03) */}
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
          © {new Date().getFullYear()} Hagez
        </p>
      </footer>

      {/* Responsive: stack badges vertically on mobile */}
      <style>{`
        @media (max-width: 767px) {
          .store-badges-row {
            flex-direction: column !important;
            align-items: center !important;
          }
        }
      `}</style>
    </div>
  );
}
