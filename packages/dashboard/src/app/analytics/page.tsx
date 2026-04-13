// ============================================================
// SUPER RESERVATION PLATFORM — Analytics Page (US-054)
// 4 KPI cards, 30-day trend bar chart, date-range filter.
// No-show rate vs platform avg. RTL.
// ============================================================

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/services/api';
import { useLang } from '@/lib/i18n';
import DashboardShell from '@/components/DashboardShell';

export default function AnalyticsPageWrapper() {
  return (
    <DashboardShell pageTitle="page_analytics">
      <AnalyticsPage />
    </DashboardShell>
  );
}

// Platform average no-show rate for comparison (hardcoded for MVP)
const PLATFORM_AVG_NO_SHOW = 12;

const COPY = {
  ar: {
    title:           'الإحصائيات',
    loading:         'جاري التحميل...',
    kpi1Label:       'إجمالي الحجوزات',
    kpi1Sub:         'مؤكد حالياً',
    kpi2Label:       'حجوزات مكتملة',
    kpi2Sub:         'غياب ممنوع',
    kpi3Label:       'إيراد العربون',
    kpi3Sub:         'من الحجوزات المكتملة',
    kpi3Unit:        'ج.م',
    kpi4Label:       'نسبة الغياب',
    kpi4Sub:         'متوسط المنصة',
    trendTitle:      'حجم الحجوزات اليومية',
    dayUnit:         'يوم',
    noData:          'لا توجد بيانات',
    noShowTitle:     'نسبة الغياب مقارنة بالمنصة',
    myBusiness:      'نشاطك التجاري',
    platformAvg:     'متوسط المنصة',
    bookingTooltip:  'حجز',
    locale:          'ar-EG',
  },
  en: {
    title:           'Analytics',
    loading:         'Loading...',
    kpi1Label:       'Total bookings',
    kpi1Sub:         'currently confirmed',
    kpi2Label:       'Completed bookings',
    kpi2Sub:         'no-shows prevented',
    kpi3Label:       'Deposit revenue',
    kpi3Sub:         'from completed bookings',
    kpi3Unit:        'EGP',
    kpi4Label:       'No-show rate',
    kpi4Sub:         'Platform avg.',
    trendTitle:      'Daily booking volume',
    dayUnit:         'days',
    noData:          'No data',
    noShowTitle:     'No-show rate vs. platform',
    myBusiness:      'Your business',
    platformAvg:     'Platform average',
    bookingTooltip:  'bookings',
    locale:          'en-US',
  },
};

type Period = '7' | '30' | '90';

function AnalyticsPage() {
  const { dir, lang } = useLang();
  const c = COPY[lang];
  const month = new Date().toISOString().slice(0, 7); // current month — not user-controlled
  const [trendDays, setTrendDays] = useState<Period>('30');

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', month],
    queryFn: () => analyticsApi.summary(month).then((r) => r.data),
  });

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['analytics-trend', trendDays],
    queryFn: () => analyticsApi.trend(Number(trendDays)).then((r) => r.data),
  });

  const stats = data ?? {};
  const trend: { date: string; bookings: number; revenue: number }[] = trendData?.trend ?? [];
  const maxBookings = Math.max(...trend.map((t) => t.bookings), 1);

  const kpis = [
    { label: c.kpi1Label, value: stats.bookings_total ?? '—',  sub: `${stats.bookings_confirmed ?? 0} ${c.kpi1Sub}`, color: '#1B8A7A' },
    { label: c.kpi2Label, value: stats.bookings_completed ?? '—', sub: `${stats.no_shows_prevented ?? 0} ${c.kpi2Sub}`, color: '#1B8A7A' },
    { label: c.kpi3Label, value: stats.deposit_revenue_egp != null ? `${Math.round(stats.deposit_revenue_egp)} ${c.kpi3Unit}` : '—', sub: c.kpi3Sub, color: '#0057FF' },
    { label: c.kpi4Label, value: stats.no_show_rate_pct != null ? `${stats.no_show_rate_pct}%` : '—', sub: `${c.kpi4Sub} ${PLATFORM_AVG_NO_SHOW}%`, color: (stats.no_show_rate_pct ?? 0) > PLATFORM_AVG_NO_SHOW ? '#D32F2F' : '#1B8A7A' },
  ];

  return (
    <div style={{ padding: '24px', fontFamily: 'Cairo, sans-serif', direction: dir, maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0F2044', margin: 0 }}>{c.title}</h2>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>{c.loading}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {kpis.map((kpi) => (
            <div key={kpi.label} style={{
              backgroundColor: '#fff', borderRadius: '16px', padding: '24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `4px solid ${kpi.color}`,
            }}>
              <div style={{ fontSize: '30px', fontWeight: 700, color: kpi.color, marginBottom: '6px' }}>{kpi.value}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F2044', marginBottom: '4px' }}>{kpi.label}</div>
              <div style={{ fontSize: '12px', color: '#9CA3AF' }}>{kpi.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Trend Chart */}
      <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontWeight: 700, fontSize: '17px', color: '#0F2044', margin: 0 }}>{c.trendTitle}</h3>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['7', '30', '90'] as Period[]).map((d) => (
              <button
                key={d}
                onClick={() => setTrendDays(d)}
                style={{
                  padding: '6px 14px', border: '1.5px solid #E5E7EB', borderRadius: '20px', cursor: 'pointer',
                  fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 600,
                  background: trendDays === d ? '#0F2044' : '#fff',
                  color: trendDays === d ? '#fff' : '#6B7280',
                  borderColor: trendDays === d ? '#0F2044' : '#E5E7EB',
                }}
              >
                {d} {c.dayUnit}
              </button>
            ))}
          </div>
        </div>

        {trendLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>{c.loading}</div>
        ) : trend.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>{c.noData}</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '160px', padding: '0 4px' }}>
              {trend.map((t) => {
                const height = Math.max((t.bookings / maxBookings) * 140, t.bookings > 0 ? 8 : 0);
                return (
                  <div
                    key={t.date}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'default' }}
                    title={`${new Date(t.date).toLocaleDateString(c.locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })}: ${t.bookings} ${c.bookingTooltip}`}
                  >
                    {t.bookings > 0 && <div style={{ fontSize: '9px', color: '#9CA3AF' }}>{t.bookings}</div>}
                    <div style={{
                      width: '100%', maxWidth: '28px',
                      height: `${height}px`, minHeight: t.bookings > 0 ? '8px' : '0',
                      background: t.bookings > 0 ? '#1B8A7A' : '#F0F0F0',
                      borderRadius: '4px 4px 0 0', transition: 'height 0.3s',
                    }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '2px', padding: '6px 4px 0', borderTop: '1px solid #F0F0F0' }}>
              {trend.map((t, i) => {
                const showLabel = trendDays === '7' || i % 7 === 0;
                return (
                  <div key={t.date} style={{ flex: 1, textAlign: 'center', fontSize: '9px', color: '#9CA3AF' }}>
                    {showLabel ? new Date(t.date).toLocaleDateString(c.locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* No-show rate vs platform avg */}
        {!isLoading && stats.no_show_rate_pct !== undefined && (
          <div style={{ marginTop: '24px', borderTop: '1px solid #F0F0F0', paddingTop: '20px' }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F2044', marginBottom: '14px' }}>{c.noShowTitle}</div>
            {[
              { label: c.myBusiness, pct: stats.no_show_rate_pct ?? 0, color: (stats.no_show_rate_pct ?? 0) > PLATFORM_AVG_NO_SHOW ? '#D32F2F' : '#1B8A7A' },
              { label: c.platformAvg, pct: PLATFORM_AVG_NO_SHOW, color: '#9CA3AF' },
            ].map((item) => (
              <div key={item.label} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>{item.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: item.color }}>{item.pct}%</span>
                </div>
                <div style={{ background: '#F0F0F0', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(item.pct, 100)}%`, height: '100%', background: item.color, borderRadius: '4px', transition: 'width 0.5s' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
