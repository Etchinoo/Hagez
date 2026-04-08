// ============================================================
// SUPER RESERVATION PLATFORM — Featured Listing Page (US-118)
// Business owner selects a featured placement plan,
// submits request, and views active listing status.
// ============================================================

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { featuredApi } from '@/services/api';
import { useLang } from '@/lib/i18n';
import DashboardShell from '@/components/DashboardShell';

const TEAL  = '#1B8A7A';
const NAVY  = '#0F2044';
const GRAY  = '#9CA3AF';
const GOLD  = '#D97706';
const GREEN = '#16A34A';

type Plan = 'starter_7' | 'growth_14' | 'pro_30';

const PLANS_AR: { id: Plan; label: string; days: number; price: number; tag?: string }[] = [
  { id: 'starter_7',  label: 'الانطلاق',   days: 7,  price: 299 },
  { id: 'growth_14',  label: 'النمو',      days: 14, price: 499, tag: 'الأكثر شيوعاً' },
  { id: 'pro_30',     label: 'الاحترافي', days: 30, price: 799 },
];

const PLANS_EN: { id: Plan; label: string; days: number; price: number; tag?: string }[] = [
  { id: 'starter_7',  label: 'Starter',      days: 7,  price: 299 },
  { id: 'growth_14',  label: 'Growth',       days: 14, price: 499, tag: 'Most popular' },
  { id: 'pro_30',     label: 'Professional', days: 30, price: 799 },
];

const STATUS_LABELS_AR: Record<string, { label: string; color: string }> = {
  pending_payment: { label: 'قيد المراجعة', color: GOLD },
  active:          { label: 'نشط',          color: GREEN },
  expired:         { label: 'منتهي',        color: GRAY },
  cancelled:       { label: 'ملغى',         color: '#DC2626' },
};

const STATUS_LABELS_EN: Record<string, { label: string; color: string }> = {
  pending_payment: { label: 'Under review', color: GOLD },
  active:          { label: 'Active',       color: GREEN },
  expired:         { label: 'Expired',      color: GRAY },
  cancelled:       { label: 'Cancelled',    color: '#DC2626' },
};

// ── Per-plan benefits (bilingual) ────────────────────────────
const PLAN_BENEFITS: Record<Plan, { icon: string; ar: string; en: string }[]> = {
  starter_7: [
    { icon: '⭐', ar: 'ظهور في أعلى نتائج البحث',                        en: 'Appear at the top of search results'               },
    { icon: '🏷️', ar: 'شارة "مميز" على ملف نشاطك',                       en: '"Featured" badge on your business profile'         },
    { icon: '📊', ar: 'إحصائيات مشاهدة أساسية خلال فترة الإبراز',        en: 'Basic view stats during the featured period'       },
  ],
  growth_14: [
    { icon: '⭐', ar: 'ظهور في أعلى نتائج البحث',                        en: 'Appear at the top of search results'               },
    { icon: '🏷️', ar: 'شارة "مميز" على ملف نشاطك',                       en: '"Featured" badge on your business profile'         },
    { icon: '📱', ar: 'ظهور في قسم "الأماكن المميزة" في الصفحة الرئيسية',en: 'Appear in the "Featured Places" section on the home page' },
    { icon: '📊', ar: 'إحصائيات مشاهدة تفصيلية خلال فترة الإبراز',       en: 'Detailed view analytics during the featured period' },
    { icon: '🚀', ar: 'أولوية عرض على حزمة Starter',                      en: 'Priority placement over Starter listings'          },
  ],
  pro_30: [
    { icon: '⭐', ar: 'ظهور في أعلى نتائج البحث',                        en: 'Appear at the top of search results'               },
    { icon: '🏷️', ar: 'شارة "مميز" على ملف نشاطك',                       en: '"Featured" badge on your business profile'         },
    { icon: '📱', ar: 'ظهور في قسم "الأماكن المميزة" في الصفحة الرئيسية',en: 'Appear in the "Featured Places" section on the home page' },
    { icon: '📊', ar: 'تقارير كاملة (مشاهدات، نقرات، معدل التحويل)',      en: 'Full analytics: impressions, clicks & CTR'         },
    { icon: '🚀', ar: 'أولوية قصوى على جميع الخطط',                       en: 'Top-priority placement above all other plans'      },
    { icon: '🗂️', ar: 'ظهور مميز على صفحات الفئات',                       en: 'Featured placement on category pages'              },
    { icon: '📣', ar: 'ذكر في النشرة الإخبارية وصفحات Hagez',             en: 'Mention in Hagez newsletter & social channels'     },
  ],
};

const COPY = {
  ar: {
    title:          'الإبراز في نتائج البحث ⭐',
    subtitle:       'اظهر في أعلى نتائج البحث وأمام المزيد من العملاء',
    activeBadge:    '⭐ إعلانك مميز الآن',
    planLabel:      'خطة',
    daysUnit:       'يوم',
    daysLeft:       'يوم متبقي',
    dateFrom:       'من:',
    dateTo:         'حتى:',
    pendingMsg:     '⏳ طلبك قيد المراجعة من قِبل الفريق. سيتم تفعيله خلال 24 ساعة.',
    selectPlan:     'اختر خطة الإبراز',
    benefitsTitle:  'ماذا تحصل؟',
    ctaSending:     'جاري الإرسال...',
    ctaRequest:     'طلب إبراز ·',
    currency:       'ج.م',
    perDay:         'ج.م / يوم',
    successMsg:     '✅ تم إرسال طلبك بنجاح! سيتم مراجعته والرد خلال 24 ساعة.',
    historyTitle:   'سجل الإبراز',
    thPlan:         'الخطة',
    thPeriod:       'الفترة',
    thPrice:        'السعر',
    thStatus:       'الحالة',
    loading:        'جاري التحميل...',
  },
  en: {
    title:          'Featured in Search Results ⭐',
    subtitle:       'Appear at the top of search results in front of more customers',
    activeBadge:    '⭐ Your listing is featured now',
    planLabel:      'Plan',
    daysUnit:       'days',
    daysLeft:       'days left',
    dateFrom:       'From:',
    dateTo:         'Until:',
    pendingMsg:     '⏳ Your request is under review. It will be activated within 24 hours.',
    selectPlan:     'Choose a featured plan',
    benefitsTitle:  'What you get',
    ctaSending:     'Sending...',
    ctaRequest:     'Request feature ·',
    currency:       'EGP',
    perDay:         'EGP / day',
    successMsg:     '✅ Your request has been sent! We will review it and respond within 24 hours.',
    historyTitle:   'Feature history',
    thPlan:         'Plan',
    thPeriod:       'Period',
    thPrice:        'Price',
    thStatus:       'Status',
    loading:        'Loading...',
  },
};

function daysLeft(endsAt: string): number {
  const diff = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function FeaturedPageWrapper() {
  return <DashboardShell pageTitle="page_featured"><FeaturedPage /></DashboardShell>;
}

function FeaturedPage() {
  const { dir, lang } = useLang();
  const c = COPY[lang];
  const PLANS = lang === 'ar' ? PLANS_AR : PLANS_EN;
  const STATUS_LABELS = lang === 'ar' ? STATUS_LABELS_AR : STATUS_LABELS_EN;
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US';

  const [selectedPlan, setSelectedPlan] = useState<Plan>('growth_14');
  const [submitted, setSubmitted]       = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['featured'],
    queryFn: () => featuredApi.get().then((r) => r.data),
  });

  const purchaseMutation = useMutation({
    mutationFn: () => featuredApi.purchase(selectedPlan),
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['featured'] });
    },
  });

  const hasActive = !!data?.active_listing;
  const activeListing = data?.active_listing;

  return (
    <div style={{ ...styles.page, direction: dir }}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.pageTitle}>{c.title}</h1>
        <p style={styles.pageSubtitle}>{c.subtitle}</p>
      </div>

      {/* Active listing status */}
      {hasActive && activeListing && (
        <div style={styles.activeCard}>
          <div style={styles.activeCardTop}>
            <div>
              <div style={styles.activeBadge}>{c.activeBadge}</div>
              <div style={styles.activePlan}>
                {c.planLabel} {PLANS.find((p) => p.id === activeListing.plan)?.label} ·{' '}
                {PLANS.find((p) => p.id === activeListing.plan)?.days} {c.daysUnit}
              </div>
            </div>
            <div style={styles.activeCountdown}>
              <div style={styles.activeCountdownNum}>{daysLeft(activeListing.ends_at)}</div>
              <div style={styles.activeCountdownLabel}>{c.daysLeft}</div>
            </div>
          </div>
          <div style={styles.activeDates}>
            <span>{c.dateFrom} {new Date(activeListing.starts_at).toLocaleDateString(locale)}</span>
            <span style={{ marginInlineStart: 24 }}>{c.dateTo} {new Date(activeListing.ends_at).toLocaleDateString(locale)}</span>
          </div>
          {activeListing.starts_at && activeListing.ends_at && (
            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${Math.max(2, 100 - (daysLeft(activeListing.ends_at) / daysLeft(activeListing.starts_at)) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Pending review notice */}
      {data?.history?.some((h: any) => h.status === 'pending_payment') && !hasActive && (
        <div style={styles.pendingCard}>
          <span>{c.pendingMsg}</span>
        </div>
      )}

      {/* Plan selector (only if no active listing) */}
      {!hasActive && !data?.history?.some((h: any) => h.status === 'pending_payment') && (
        <>
          <h2 style={styles.sectionTitle}>{c.selectPlan}</h2>

          <div style={styles.plansGrid}>
            {PLANS.map((plan) => (
              <button
                key={plan.id}
                style={{
                  ...styles.planCard,
                  ...(selectedPlan === plan.id ? styles.planCardSelected : {}),
                }}
                onClick={() => setSelectedPlan(plan.id)}
              >
                {plan.tag && (
                  <div style={styles.planTag}>{plan.tag}</div>
                )}
                <div style={styles.planName}>{plan.label}</div>
                <div style={styles.planDays}>{plan.days} {c.daysUnit}</div>
                <div style={styles.planPrice}>{plan.price} {c.currency}</div>
                <div style={styles.planPricePerDay}>
                  {Math.round(plan.price / plan.days)} {c.perDay}
                </div>
              </button>
            ))}
          </div>

          {/* Benefits — dynamic per selected plan */}
          <div style={styles.benefitsCard}>
            <h3 style={styles.benefitsTitle}>{c.benefitsTitle}</h3>
            {PLAN_BENEFITS[selectedPlan].map((b, i) => (
              <div key={i} style={styles.benefitRow}>
                <span>{b.icon}</span>
                <span>{lang === 'ar' ? b.ar : b.en}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          {submitted ? (
            <div style={styles.successMsg}>{c.successMsg}</div>
          ) : (
            <button
              style={{ ...styles.ctaBtn, opacity: purchaseMutation.isPending ? 0.7 : 1 }}
              onClick={() => purchaseMutation.mutate()}
              disabled={purchaseMutation.isPending}
            >
              {purchaseMutation.isPending
                ? c.ctaSending
                : `${c.ctaRequest} ${PLANS.find((p) => p.id === selectedPlan)?.price} ${c.currency}`}
            </button>
          )}
        </>
      )}

      {/* Purchase history */}
      {data?.history?.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={styles.sectionTitle}>{c.historyTitle}</h2>
          <div style={styles.historyTable}>
            <div style={styles.historyHeader}>
              <span style={{ flex: 1 }}>{c.thPlan}</span>
              <span style={{ flex: 1 }}>{c.thPeriod}</span>
              <span style={{ width: 90 }}>{c.thPrice}</span>
              <span style={{ width: 120 }}>{c.thStatus}</span>
            </div>
            {data.history.map((h: any) => {
              const status = STATUS_LABELS[h.status] ?? { label: h.status, color: GRAY };
              return (
                <div key={h.id} style={styles.historyRow}>
                  <span style={{ flex: 1 }}>{PLANS.find((p) => p.id === h.plan)?.label ?? h.plan}</span>
                  <span style={{ flex: 1, fontSize: 12, color: GRAY }}>
                    {h.starts_at
                      ? `${new Date(h.starts_at).toLocaleDateString(locale)} — ${new Date(h.ends_at).toLocaleDateString(locale)}`
                      : '—'}
                  </span>
                  <span style={{ width: 90 }}>{Number(h.price_egp)} {c.currency}</span>
                  <span style={{ width: 120, color: status.color, fontWeight: 600 }}>{status.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', fontFamily: 'Cairo, sans-serif', maxWidth: 900, margin: '0 auto' },

  header: { marginBottom: 28 },
  pageTitle: { fontSize: 24, fontWeight: 700, color: NAVY, margin: 0 },
  pageSubtitle: { fontSize: 14, color: GRAY, margin: '4px 0 0' },

  activeCard: { background: 'linear-gradient(135deg, #0F2044 0%, #1B8A7A 100%)', borderRadius: 20, padding: '24px 28px', marginBottom: 28, color: '#fff' },
  activeCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  activeBadge: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  activePlan: { fontSize: 13, opacity: 0.8 },
  activeCountdown: { textAlign: 'center' as const },
  activeCountdownNum: { fontSize: 40, fontWeight: 700, lineHeight: '1' },
  activeCountdownLabel: { fontSize: 12, opacity: 0.8 },
  activeDates: { fontSize: 13, opacity: 0.8, marginBottom: 12 },
  progressTrack: { height: 6, background: 'rgba(255,255,255,0.3)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, background: '#fff', borderRadius: 3 },

  pendingCard: { background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 12, padding: '14px 20px', marginBottom: 24, color: '#92400E', fontSize: 14 },

  sectionTitle: { fontSize: 18, fontWeight: 700, color: NAVY, margin: '0 0 16px' },

  plansGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 },
  planCard: { position: 'relative' as const, background: '#fff', border: '2px solid #E5E7EB', borderRadius: 16, padding: '24px 20px', cursor: 'pointer', textAlign: 'center' as const, transition: 'all 0.15s', fontFamily: 'Cairo, sans-serif' },
  planCardSelected: { borderColor: TEAL, background: TEAL + '08', boxShadow: `0 0 0 3px ${TEAL}33` },
  planTag: { position: 'absolute' as const, top: -12, left: '50%', transform: 'translateX(-50%)', background: GOLD, color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 12px', whiteSpace: 'nowrap' as const },
  planName: { fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 4 },
  planDays: { fontSize: 13, color: GRAY, marginBottom: 12 },
  planPrice: { fontSize: 28, fontWeight: 700, color: TEAL, marginBottom: 2 },
  planPricePerDay: { fontSize: 12, color: GRAY },

  benefitsCard: { background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 14, padding: '20px 24px', marginBottom: 24 },
  benefitsTitle: { fontSize: 15, fontWeight: 700, color: NAVY, margin: '0 0 12px' },
  benefitRow: { display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, color: '#166534', marginBottom: 8 },

  ctaBtn: { width: '100%', background: TEAL, color: '#fff', border: 'none', borderRadius: 14, padding: '16px 0', fontSize: 17, fontWeight: 700, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' },
  successMsg: { background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '16px 20px', color: GREEN, fontSize: 15, textAlign: 'center' as const },

  historyTable: { background: '#fff', borderRadius: 14, border: '1px solid #F0F0F0', overflow: 'hidden' },
  historyHeader: { display: 'flex', gap: 0, padding: '12px 20px', background: '#F9FAFB', fontSize: 13, fontWeight: 700, color: GRAY, borderBottom: '1px solid #F0F0F0' },
  historyRow: { display: 'flex', gap: 0, padding: '14px 20px', fontSize: 14, color: NAVY, borderBottom: '1px solid #F9FAFB', alignItems: 'center' },
};
