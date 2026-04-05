// ============================================================
// SUPER RESERVATION PLATFORM — Analytics Page
// Monthly KPI cards: bookings, deposit revenue, no-show rate.
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

function AnalyticsPage() {
  const [month, setMonth] = useState(
    new Date().toISOString().slice(0, 7) // yyyy-MM
  );

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', month],
    queryFn: () => analyticsApi.summary(month).then((r) => r.data),
  });

  const stats = data ?? {};

  const kpis = [
    { label: 'إجمالي الحجوزات', value: stats.bookings_total ?? '—', icon: '📋', color: '#0F2044' },
    { label: 'حجوزات مكتملة', value: stats.bookings_completed ?? '—', icon: '✅', color: '#1B8A7A' },
    { label: 'إيراد العربون (ج.م)', value: stats.deposit_revenue_egp ? `${stats.deposit_revenue_egp.toFixed(0)}` : '—', icon: '💰', color: '#0057FF' },
    { label: 'حجوزات الغياب', value: stats.bookings_no_show ?? '—', icon: '⚠️', color: '#D32F2F' },
    { label: 'نسبة الغياب', value: stats.no_show_rate_pct !== undefined ? `${stats.no_show_rate_pct}%` : '—', icon: '📉', color: '#F59E0B' },
    { label: 'إيراد محمي (ج.م)', value: stats.revenue_protected_egp ? `${stats.revenue_protected_egp.toFixed(0)}` : '—', icon: '🛡️', color: '#1B8A7A' },
  ];

  return (
    <div style={{ padding: '24px', fontFamily: 'Cairo, sans-serif', direction: 'rtl' }}>
      {/* Month Picker */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0F2044', margin: 0 }}>الإحصائيات الشهرية</h2>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
          {kpis.map((kpi) => (
            <div key={kpi.label} style={{
              backgroundColor: '#fff', borderRadius: '16px', padding: '24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `4px solid ${kpi.color}`,
            }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>{kpi.icon}</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: kpi.color, marginBottom: '4px' }}>{kpi.value}</div>
              <div style={{ fontSize: '13px', color: '#6B7280', fontWeight: 600 }}>{kpi.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
