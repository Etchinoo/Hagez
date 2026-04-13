// ============================================================
// HAGEZ — Public Landing Page (hagez.app)
// Arabic-first, RTL. Visible to all visitors before sign-in.
// Authenticated users are redirected to their zone immediately.
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDashboardAuth } from '@/store/auth';
import { getLoginRedirect } from '@/lib/rbac';

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

// ── Section data ─────────────────────────────────────────────
const CATEGORIES = [
  { emoji: '🍽️', ar: 'مطاعم',       en: 'Restaurants', color: '#D2691E', phase2: false },
  { emoji: '💇', ar: 'صالونات',     en: 'Salons',       color: '#E91E63', phase2: false },
  { emoji: '⚽', ar: 'ملاعب رياضية', en: 'Courts',       color: '#4CAF50', phase2: true  },
  { emoji: '🎮', ar: 'كافيه جيمنج', en: 'Gaming Cafes', color: '#9C27B0', phase2: true  },
  { emoji: '🚗', ar: 'غسيل سيارات', en: 'Car Wash',     color: '#00BCD4', phase2: true  },
];

const FEATURES = [
  { emoji: '⚡', ar: 'حجز فوري',         en: 'Instant Booking',     desc_ar: 'تأكيد لحظي بعد الدفع',                 desc_en: 'Instant confirmation after payment'    },
  { emoji: '🔒', ar: 'دفع آمن',          en: 'Secure Payments',     desc_ar: 'بوابة Paymob – بطاقات وفوري وفودافون', desc_en: 'Paymob gateway – cards, Fawry & more'  },
  { emoji: '📅', ar: 'جدولة ذكية',       en: 'Smart Scheduling',    desc_ar: 'لا تعارضات، كل شيء منظم تلقائياً',    desc_en: 'No conflicts, auto-organized slots'     },
  { emoji: '🛡️', ar: 'حماية الوديعة',   en: 'Deposit Protection',  desc_ar: 'الوديعة تضمن الجدية وتحمي الطرفين',  desc_en: 'Deposit ensures commitment for both sides' },
];

// ── Main component ────────────────────────────────────────────
export default function LandingPage() {
  useAuthRedirect();

  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [signInOpen, setSignInOpen] = useState(false);
  const isAr = lang === 'ar';

  // Sync <html dir> with language toggle on the landing page only
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    return () => {
      // Restore RTL when leaving (dashboard is always RTL)
      document.documentElement.lang = 'ar';
      document.documentElement.dir = 'rtl';
    };
  }, [lang, isAr]);

  const t = (ar: string, en: string) => (isAr ? ar : en);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F7F8FA',
        color: '#0F2044',
        fontFamily: "'Cairo', 'Inter', sans-serif",
        direction: isAr ? 'rtl' : 'ltr',
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
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: '#0F2044' }}>حاجز</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1B8A7A' }}>Hagez</span>
        </div>

        {/* Nav actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Language toggle */}
          <button
            onClick={() => setLang(isAr ? 'en' : 'ar')}
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
            {isAr ? 'EN' : 'ع'}
          </button>

          {/* Sign In button + dropdown */}
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
                {/* Backdrop */}
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  onClick={() => setSignInOpen(false)}
                />
                {/* Dropdown */}
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    [isAr ? 'left' : 'right']: 0,
                    minWidth: 220,
                    background: '#FFFFFF',
                    borderRadius: 16,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    overflow: 'hidden',
                    zIndex: 50,
                  }}
                >
                  {/* Business login */}
                  <Link
                    href="/login"
                    onClick={() => setSignInOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 18px',
                      textDecoration: 'none',
                      color: '#0F2044',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F7F8FA')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: '#EFF6FF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        flexShrink: 0,
                      }}
                    >
                      🏢
                    </span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>
                        {t('لوحة تحكم العمل', 'Business Dashboard')}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>
                        {t('للمطاعم والصالونات وغيرها', 'Restaurants, salons & more')}
                      </p>
                    </div>
                  </Link>

                  <div style={{ height: 1, background: '#F3F4F6', margin: '0 12px' }} />

                  {/* Admin login */}
                  <Link
                    href="/login"
                    onClick={() => setSignInOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 18px',
                      textDecoration: 'none',
                      color: '#0F2044',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F7F8FA')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: '#FEF3C7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        flexShrink: 0,
                      }}
                    >
                      🛡️
                    </span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>
                        {t('بوابة الإدارة', 'Admin Portal')}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>
                        {t('فريق عمليات روبوستا', 'Robusta operations team')}
                      </p>
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
        {/* Decorative blobs */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '10%',
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'rgba(27,138,122,0.15)',
            filter: 'blur(80px)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '10%',
            right: '10%',
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
            filter: 'blur(60px)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
          {/* Live badge */}
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
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#4ADE80',
                display: 'inline-block',
              }}
            />
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

          <p
            style={{
              fontSize: 'clamp(16px, 2vw, 20px)',
              color: 'rgba(255,255,255,0.75)',
              margin: '0 auto 40px',
              maxWidth: 520,
              lineHeight: 1.7,
            }}
          >
            {t(
              'أسهل طريقة لحجز المطاعم والصالونات والمزيد في مصر',
              'The easiest way to book restaurants, salons & more across Egypt'
            )}
          </p>

          {/* Hero CTAs */}
          <div
            style={{
              display: 'flex',
              gap: 14,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Link
              href="/login"
              style={{
                padding: '14px 32px',
                borderRadius: 32,
                background: '#FFFFFF',
                color: '#0F2044',
                fontFamily: "'Cairo', 'Inter', sans-serif",
                fontWeight: 700,
                fontSize: 15,
                textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              }}
            >
              🏢 {t('لوحة تحكم العمل', 'Business Dashboard')}
            </Link>
            <a
              href="#categories"
              style={{
                padding: '14px 32px',
                borderRadius: 32,
                background: 'rgba(255,255,255,0.12)',
                border: '1.5px solid rgba(255,255,255,0.35)',
                color: '#FFFFFF',
                fontFamily: "'Cairo', 'Inter', sans-serif",
                fontWeight: 700,
                fontSize: 15,
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
          <h2
            style={{
              textAlign: 'center',
              fontSize: 'clamp(24px, 4vw, 36px)',
              fontWeight: 800,
              color: '#0F2044',
              margin: '0 0 8px',
            }}
          >
            {t('لماذا تختار حاجز؟', 'Why Choose Hagez?')}
          </h2>
          <p
            style={{
              textAlign: 'center',
              color: '#6B7280',
              margin: '0 0 48px',
              fontSize: 16,
            }}
          >
            {t('المنصة الأولى للحجز في مصر', 'Egypt\'s leading lifestyle booking platform')}
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: 20,
            }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.en}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 16,
                  padding: '24px 20px',
                  boxShadow: '0 2px 8px rgba(15,32,68,0.06)',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: 'rgba(27,138,122,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    marginBottom: 14,
                  }}
                >
                  {f.emoji}
                </div>
                <h3
                  style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#0F2044' }}
                >
                  {t(f.ar, f.en)}
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
                  {t(f.desc_ar, f.desc_en)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categories ─────────────────────────────────────── */}
      <section id="categories" style={{ padding: '72px 24px', background: '#FFFFFF' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2
            style={{
              textAlign: 'center',
              fontSize: 'clamp(24px, 4vw, 36px)',
              fontWeight: 800,
              color: '#0F2044',
              margin: '0 0 8px',
            }}
          >
            {t('الفئات المتاحة', 'Available Categories')}
          </h2>
          <p
            style={{
              textAlign: 'center',
              color: '#6B7280',
              margin: '0 0 48px',
              fontSize: 16,
            }}
          >
            {t('كل ما تحتاجه في مكان واحد', 'Everything you need in one place')}
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
            }}
          >
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
                  <span
                    style={{
                      position: 'absolute',
                      top: 10,
                      [isAr ? 'left' : 'right']: 10,
                      background: c.color,
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 8,
                    }}
                  >
                    {t('قريباً', 'Soon')}
                  </span>
                )}
                <div style={{ fontSize: 36, marginBottom: 12 }}>{c.emoji}</div>
                <p
                  style={{
                    margin: 0,
                    fontWeight: 700,
                    fontSize: 15,
                    color: '#0F2044',
                  }}
                >
                  {t(c.ar, c.en)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sign-in CTA banner ──────────────────────────────── */}
      <section
        style={{
          padding: '72px 24px',
          background: 'linear-gradient(135deg, #0F2044, #1B8A7A)',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontSize: 'clamp(24px, 4vw, 36px)',
            fontWeight: 800,
            color: '#FFFFFF',
            margin: '0 0 12px',
          }}
        >
          {t('هل أنت صاحب عمل؟', 'Are you a business owner?')}
        </h2>
        <p
          style={{
            color: 'rgba(255,255,255,0.75)',
            margin: '0 0 36px',
            fontSize: 16,
            maxWidth: 480,
            marginInline: 'auto',
          }}
        >
          {t(
            'سجّل دخولك للوحة التحكم وابدأ إدارة حجوزاتك الآن',
            'Sign in to your dashboard and start managing your bookings today'
          )}
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/login"
            style={{
              padding: '14px 36px',
              borderRadius: 32,
              background: '#FFFFFF',
              color: '#0F2044',
              fontFamily: "'Cairo', 'Inter', sans-serif",
              fontWeight: 700,
              fontSize: 15,
              textDecoration: 'none',
            }}
          >
            {t('تسجيل الدخول – لوحة التحكم', 'Sign In – Business Dashboard')}
          </Link>
          <Link
            href="/signup"
            style={{
              padding: '14px 36px',
              borderRadius: 32,
              background: 'rgba(255,255,255,0.12)',
              border: '1.5px solid rgba(255,255,255,0.35)',
              color: '#FFFFFF',
              fontFamily: "'Cairo', 'Inter', sans-serif",
              fontWeight: 700,
              fontSize: 15,
              textDecoration: 'none',
            }}
          >
            {t('إنشاء حساب جديد', 'Create an Account')}
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer
        style={{
          background: '#0F2044',
          padding: '40px 24px',
          textAlign: 'center',
        }}
      >
        <p
          style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: '#FFFFFF' }}
        >
          حاجز
        </p>
        <p style={{ margin: '0 0 20px', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
          {t('احجز لحظتك', 'Book Your Moment')} · Cairo, Egypt
        </p>
        <div
          style={{
            display: 'flex',
            gap: 20,
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: 24,
          }}
        >
          {[
            { label: t('سياسة الخصوصية', 'Privacy Policy'), href: '/privacy' },
            { label: t('شروط الاستخدام', 'Terms of Service'), href: '/terms' },
            { label: t('تواصل معنا', 'Contact Us'), href: 'mailto:hello@hagez.app' },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={href}
              style={{
                color: 'rgba(255,255,255,0.45)',
                fontSize: 13,
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
            >
              {label}
            </a>
          ))}
        </div>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
          © 2026 Hagez · Robusta Technology Group
        </p>
      </footer>
    </div>
  );
}
