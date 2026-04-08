// ============================================================
// SUPER RESERVATION PLATFORM — Loyalty Analytics Page (US-114)
// Business view of loyalty program participation:
// redemption rate, points burned, discount EGP, trend.
// ============================================================

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loyaltyAnalyticsApi } from '@/services/api';
import { useLang } from '@/lib/i18n';
import DashboardShell from '@/components/DashboardShell';

const TEAL  = '#1B8A7A';
const NAVY  = '#0F2044';
const GRAY  = '#9CA3AF';
const GOLD  = '#D97706';
const GREEN = '#16A34A';

const COPY = {
  ar: {
    title:           'برنامج الولاء',
    subtitle:        'إحصائيات مشاركة العملاء في نقاط الولاء',
    dayBtn:          'يوم',
    loading:         'جاري التحميل...',
    kpi1Label:       'إجمالي الحجوزات',
    kpi1Sub:         'مؤكدة في الفترة المحددة',
    kpi2Label:       'حجوزات باسترداد نقاط',
    kpi2Sub:         '٪ من الحجوزات',
    kpi3Label:       'إجمالي النقاط المستردة',
    kpi3Sub:         'نقطة',
    kpi4Label:       'قيمة الخصومات الممنوحة',
    kpi4Sub:         'إجمالي خصومات الولاء',
    egp:             'ج.م',
    redemptionTitle: 'معدل استرداد النقاط',
    gaugeLow:        'منخفض — شجّع عملاءك على استرداد نقاطهم في الحجز القادم.',
    gaugeMid:        'متوسط — يمكن تحسينه من خلال إشعارات التذكير بالنقاط.',
    gaugeHigh:       'ممتاز — نسبة استرداد قوية تدل على ولاء عالٍ.',
    insightTitle:    'تفاصيل الاسترداد',
    insight1:        'متوسط النقاط لكل استرداد',
    insight1Unit:    'نقطة',
    insight2:        'متوسط الخصم لكل استرداد',
    insight3:        'قيمة ١٠٠ نقطة',
    insight3Val:     '٥ ج.م خصم',
    insight4:        'معدل الكسب',
    insight4Val:     '١ ج.م مقدّم = ١ نقطة',
    tiersTitle:      'مستويات الولاء',
    tier1:           'برونزي',
    tier1Range:      '٠ — ٤٩٩ نقطة',
    tier2:           'فضي',
    tier2Range:      '٥٠٠ — ١٩٩٩ نقطة',
    tier3:           'ذهبي',
    tier3Range:      '٢٠٠٠ — ٤٩٩٩ نقطة',
    tier4:           'بلاتيني',
    tier4Range:      '٥٠٠٠+ نقطة',
  },
  en: {
    title:           'Loyalty Program',
    subtitle:        'Customer participation statistics for the loyalty points program',
    dayBtn:          'days',
    loading:         'Loading...',
    kpi1Label:       'Total bookings',
    kpi1Sub:         'Confirmed in selected period',
    kpi2Label:       'Bookings with redemption',
    kpi2Sub:         '% of bookings',
    kpi3Label:       'Total points redeemed',
    kpi3Sub:         'points',
    kpi4Label:       'Total discounts granted',
    kpi4Sub:         'Total loyalty discounts',
    egp:             'EGP',
    redemptionTitle: 'Points redemption rate',
    gaugeLow:        'Low — Encourage customers to redeem their points on their next booking.',
    gaugeMid:        'Average — Can be improved through reminder notifications about points.',
    gaugeHigh:       'Excellent — Strong redemption rate indicates high loyalty.',
    insightTitle:    'Redemption details',
    insight1:        'Avg. points per redemption',
    insight1Unit:    'pts',
    insight2:        'Avg. discount per redemption',
    insight3:        'Value of 100 points',
    insight3Val:     '5 EGP discount',
    insight4:        'Earning rate',
    insight4Val:     '1 EGP paid = 1 point',
    tiersTitle:      'Loyalty tiers',
    tier1:           'Bronze',
    tier1Range:      '0 — 499 pts',
    tier2:           'Silver',
    tier2Range:      '500 — 1,999 pts',
    tier3:           'Gold',
    tier3Range:      '2,000 — 4,999 pts',
    tier4:           'Platinum',
    tier4Range:      '5,000+ pts',
  },
};

// ── KPI Card ─────────────────────────────────────────────────

function KPICard({ label, value, sub, color = NAVY }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={styles.kpiCard}>
      <div style={{ ...styles.kpiValue, color }}>{value}</div>
      <div style={styles.kpiLabel}>{label}</div>
      {sub && <div style={styles.kpiSub}>{sub}</div>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function LoyaltyAnalyticsPageWrapper() {
  return <DashboardShell pageTitle="page_loyalty"><LoyaltyAnalyticsPage /></DashboardShell>;
}

function LoyaltyAnalyticsPage() {
  const { dir, lang } = useLang();
  const c = COPY[lang];
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ['loyalty-analytics', days],
    queryFn: () => loyaltyAnalyticsApi.get(days).then((r) => r.data),
  });

  const redemptionPct = data?.redemption_rate_pct ?? 0;
  const gaugeText = redemptionPct < 10 ? c.gaugeLow : redemptionPct < 30 ? c.gaugeMid : c.gaugeHigh;

  return (
    <div style={{ ...styles.page, direction: dir }}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>{c.title}</h1>
          <p style={styles.pageSubtitle}>{c.subtitle}</p>
        </div>
        <div style={styles.periodPicker}>
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              style={{ ...styles.periodBtn, ...(days === d ? styles.periodBtnActive : {}) }}
              onClick={() => setDays(d)}
            >
              {d} {c.dayBtn}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={styles.loadingMsg}>{c.loading}</div>
      ) : (
        <>
          {/* KPI Grid */}
          <div style={styles.kpiGrid}>
            <KPICard label={c.kpi1Label} value={data?.total_confirmed_bookings ?? 0} sub={c.kpi1Sub} />
            <KPICard
              label={c.kpi2Label}
              value={data?.bookings_with_redemption ?? 0}
              color={TEAL}
              sub={`${data?.redemption_rate_pct ?? 0}${c.kpi2Sub}`}
            />
            <KPICard
              label={c.kpi3Label}
              value={(data?.total_points_redeemed ?? 0).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}
              color={GOLD}
              sub={c.kpi3Sub}
            />
            <KPICard
              label={c.kpi4Label}
              value={`${data?.total_discount_egp ?? 0} ${c.egp}`}
              color={GREEN}
              sub={c.kpi4Sub}
            />
          </div>

          {/* Redemption rate gauge */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>{c.redemptionTitle}</h2>
            <div style={styles.gaugeRow}>
              <div style={styles.gaugeTrack}>
                <div
                  style={{
                    ...styles.gaugeFill,
                    width: `${Math.min(100, redemptionPct)}%`,
                    backgroundColor:
                      redemptionPct >= 30 ? GREEN : redemptionPct >= 10 ? TEAL : GRAY,
                  }}
                />
              </div>
              <span style={styles.gaugeLabel}>{redemptionPct}%</span>
            </div>
            <p style={styles.gaugeSub}>{gaugeText}</p>
          </div>

          {/* Per-redemption insight */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>{c.insightTitle}</h2>
            <div style={styles.insightTable}>
              <InsightRow label={c.insight1} value={`${data?.avg_points_per_redemption ?? 0} ${c.insight1Unit}`} />
              <InsightRow
                label={c.insight2}
                value={
                  data?.bookings_with_redemption
                    ? `${Math.round((data.total_discount_egp / data.bookings_with_redemption) * 100) / 100} ${c.egp}`
                    : '—'
                }
              />
              <InsightRow label={c.insight3} value={c.insight3Val} />
              <InsightRow label={c.insight4} value={c.insight4Val} />
            </div>
          </div>

          {/* Tier explanation */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>{c.tiersTitle}</h2>
            <div style={styles.tiersGrid}>
              {[
                { emoji: '🥉', label: c.tier1, range: c.tier1Range, color: '#92400E', bg: '#FEF3C7' },
                { emoji: '🥈', label: c.tier2, range: c.tier2Range, color: '#4B5563', bg: '#F3F4F6' },
                { emoji: '🥇', label: c.tier3, range: c.tier3Range, color: '#B45309', bg: '#FEF9C3' },
                { emoji: '💎', label: c.tier4, range: c.tier4Range, color: '#6B21A8', bg: '#F3E8FF' },
              ].map((t) => (
                <div key={t.label} style={{ ...styles.tierCard, backgroundColor: t.bg, borderColor: t.color + '44' }}>
                  <span style={styles.tierEmoji}>{t.emoji}</span>
                  <span style={{ ...styles.tierLabel, color: t.color }}>{t.label}</span>
                  <span style={styles.tierRange}>{t.range}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.insightRow}>
      <span style={styles.insightLabel}>{label}</span>
      <span style={styles.insightValue}>{value}</span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', fontFamily: 'Cairo, sans-serif', maxWidth: 960, margin: '0 auto' },

  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
  pageTitle: { fontSize: 24, fontWeight: 700, color: NAVY, margin: 0 },
  pageSubtitle: { fontSize: 14, color: GRAY, margin: '4px 0 0' },

  periodPicker: { display: 'flex', gap: 8 },
  periodBtn: { padding: '8px 16px', border: '1.5px solid #E5E7EB', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'Cairo, sans-serif', color: NAVY },
  periodBtnActive: { background: TEAL, borderColor: TEAL, color: '#fff', fontWeight: 700 },

  loadingMsg: { textAlign: 'center', padding: 60, color: GRAY, fontSize: 16 },

  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 },
  kpiCard: { background: '#fff', borderRadius: 16, padding: '20px 24px', borderWidth: 1, borderStyle: 'solid', borderColor: '#F0F0F0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  kpiValue: { fontSize: 32, fontWeight: 700, lineHeight: '1.2' },
  kpiLabel: { fontSize: 13, color: GRAY, marginTop: 4 },
  kpiSub:   { fontSize: 11, color: GRAY, marginTop: 2 },

  section: { background: '#fff', borderRadius: 16, padding: '24px', marginBottom: 20, borderWidth: 1, borderStyle: 'solid', borderColor: '#F0F0F0' },
  sectionTitle: { fontSize: 17, fontWeight: 700, color: NAVY, margin: '0 0 16px' },

  gaugeRow: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 },
  gaugeTrack: { flex: 1, height: 12, background: '#F3F4F6', borderRadius: 6, overflow: 'hidden' },
  gaugeFill: { height: 12, borderRadius: 6, transition: 'width 0.6s ease' },
  gaugeLabel: { fontSize: 20, fontWeight: 700, color: NAVY, minWidth: 50 },
  gaugeSub: { fontSize: 13, color: GRAY, margin: 0 },

  insightTable: { display: 'flex', flexDirection: 'column', gap: 1 },
  insightRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F5F5F5' },
  insightLabel: { fontSize: 14, color: GRAY },
  insightValue: { fontSize: 15, fontWeight: 600, color: NAVY },

  tiersGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  tierCard: { borderRadius: 12, padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, borderWidth: 1, borderStyle: 'solid' },
  tierEmoji: { fontSize: 28 },
  tierLabel: { fontSize: 14, fontWeight: 700 },
  tierRange: { fontSize: 11, color: GRAY, textAlign: 'center' as const },
};
