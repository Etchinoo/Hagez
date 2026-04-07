// ============================================================
// SUPER RESERVATION PLATFORM — Analytics Page (US-054)
// 4 KPI cards, 30-day trend bar chart, date-range filter.
// No-show rate vs platform avg. RTL.
// ============================================================

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/services/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function AnalyticsPageWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <AnalyticsPage />
    </QueryClientProvider>
  );
}

// Platform average no-show rate for comparison (hardcoded for MVP)
const PLATFORM_AVG_NO_SHOW = 12;

type Period = '7' | '30' | '90';

function AnalyticsPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
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
    { label: 'إجمالي الحجوزات',  value: stats.bookings_total ?? '—',  sub: `${stats.bookings_confirmed ?? 0} مؤكد حالياً`, color: '#0F2044' },
    { label: 'حجوزات مكتملة',    value: stats.bookings_completed ?? '—', sub: `${stats.no_shows_prevented ?? 0} غياب ممنوع`, color: '#1B8A7A' },
    { label: 'إيراد العربون',     value: stats.deposit_revenue_egp != null ? `${Math.round(stats.deposit_revenue_egp)} ج.م` : '—', sub: 'من الحجوزات المكتملة', color: '#0057FF' },
    { label: 'نسبة الغياب',       value: stats.no_show_rate_pct != null ? `${stats.no_show_rate_pct}%` : '—', sub: `متوسط المنصة ${PLATFORM_AVG_NO_SHOW}%`, color: (stats.no_show_rate_pct ?? 0) > PLATFORM_AVG_NO_SHOW ? '#D32F2F' : '#1B8A7A' },
  ];

  return (
    <div style={{ padding: '24px', fontFamily: 'Cairo, sans-serif', direction: 'rtl', maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0F2044', margin: 0 }}>الإحصائيات</h2>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={{ padding: '8px 12px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '15px' }}
        />
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>جاري التحميل...</div>
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
          <h3 style={{ fontWeight: 700, fontSize: '17px', color: '#0F2044', margin: 0 }}>حجم الحجوزات اليومية</h3>
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
                {d} يوم
              </button>
            ))}
          </div>
        </div>

        {trendLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>جاري التحميل...</div>
        ) : trend.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>لا توجد بيانات</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '160px', padding: '0 4px' }}>
              {trend.map((t) => {
                const height = Math.max((t.bookings / maxBookings) * 140, t.bookings > 0 ? 8 : 0);
                return (
                  <div
                    key={t.date}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'default' }}
                    title={`${new Date(t.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', timeZone: 'UTC' })}: ${t.bookings} حجز`}
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
                    {showLabel ? new Date(t.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* No-show rate vs platform avg */}
        {!isLoading && stats.no_show_rate_pct !== undefined && (
          <div style={{ marginTop: '24px', borderTop: '1px solid #F0F0F0', paddingTop: '20px' }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F2044', marginBottom: '14px' }}>نسبة الغياب مقارنة بالمنصة</div>
            {[
              { label: 'صالونك / مطعمك', pct: stats.no_show_rate_pct ?? 0, color: (stats.no_show_rate_pct ?? 0) > PLATFORM_AVG_NO_SHOW ? '#D32F2F' : '#1B8A7A' },
              { label: 'متوسط المنصة', pct: PLATFORM_AVG_NO_SHOW, color: '#9CA3AF' },
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
