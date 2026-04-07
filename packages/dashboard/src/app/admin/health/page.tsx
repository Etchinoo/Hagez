// ============================================================
// SUPER RESERVATION PLATFORM — Admin: Platform Health Dashboard
// US-069: Real-time platform health metrics for ops admins.
// Polls GET /admin/health every 60 seconds.
// SLA thresholds: error rate < 0.1%, payment success > 95%.
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '@/services/api';

interface HealthData {
  timestamp: string;
  bookings_last_hour: number;
  pending_verifications: number;
  open_disputes: number;
  active_businesses: number;
  payments_last_hour: number;
}

interface MetricCard {
  label: string;
  value: string | number;
  icon: string;
  alert: boolean;
  alertMsg?: string;
  sub?: string;
}

export default function HealthPage() {
  const [data, setData]       = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await dashboardApi.get<HealthData>('/admin/health');
      setData(res.data);
      setLastUpdated(new Date());
      setError('');
    } catch {
      setError('Failed to fetch health metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const cards: MetricCard[] = data
    ? [
        {
          label: 'Bookings / Hour',
          value: data.bookings_last_hour,
          icon: '📅',
          alert: false,
          sub: 'last 60 min',
        },
        {
          label: 'Payments / Hour',
          value: data.payments_last_hour,
          icon: '💳',
          alert: data.payments_last_hour === 0 && data.bookings_last_hour > 0,
          alertMsg: 'No completed payments despite bookings — check Paymob',
          sub: 'completed',
        },
        {
          label: 'Active Businesses',
          value: data.active_businesses,
          icon: '🏢',
          alert: false,
        },
        {
          label: 'Pending Verifications',
          value: data.pending_verifications,
          icon: '⏳',
          alert: data.pending_verifications > 0,
          alertMsg: `${data.pending_verifications} business(es) pending review — SLA 24h`,
        },
        {
          label: 'Open Disputes',
          value: data.open_disputes,
          icon: '⚖️',
          alert: data.open_disputes > 0,
          alertMsg: `${data.open_disputes} dispute(s) require resolution — SLA 72h`,
        },
      ]
    : [];

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Platform Health</h1>
          {lastUpdated && (
            <p style={styles.subtitle}>
              Last updated: {lastUpdated.toLocaleTimeString()} · Auto-refreshes every 60s
            </p>
          )}
        </div>
        <button style={styles.refreshBtn} onClick={fetchHealth} disabled={loading}>
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {loading && !data ? (
        <div style={styles.loader}>Loading metrics…</div>
      ) : (
        <div style={styles.grid}>
          {cards.map((card) => (
            <div key={card.label} style={{ ...styles.card, ...(card.alert ? styles.cardAlert : {}) }}>
              <div style={styles.cardTop}>
                <span style={styles.cardIcon}>{card.icon}</span>
                {card.alert && <span style={styles.alertBadge}>!</span>}
              </div>
              <div style={styles.cardValue}>{card.value}</div>
              <div style={styles.cardLabel}>{card.label}</div>
              {card.sub && <div style={styles.cardSub}>{card.sub}</div>}
              {card.alert && card.alertMsg && (
                <div style={styles.alertMsg}>{card.alertMsg}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {data && (
        <div style={styles.footer}>
          <span style={styles.footerDot} />
          Platform operational · Metrics as of {new Date(data.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', fontFamily: 'Inter, sans-serif' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: '32px',
  },
  title: { fontSize: '24px', fontWeight: 700, color: '#0F2044', margin: 0 },
  subtitle: { fontSize: '13px', color: '#6B7280', marginTop: '4px' },
  refreshBtn: {
    padding: '8px 16px', background: '#0F2044', border: 'none', borderRadius: '8px',
    fontSize: '13px', fontWeight: 600, color: '#fff', cursor: 'pointer',
  },
  errorBanner: {
    padding: '12px 16px', background: '#FEE2E2', borderRadius: '8px',
    color: '#B91C1C', fontSize: '14px', marginBottom: '24px',
  },
  loader: { color: '#6B7280', fontSize: '14px' },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '16px',
  },
  card: {
    background: '#fff', borderRadius: '12px', padding: '20px',
    border: '1.5px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  cardAlert: {
    borderColor: '#FCA5A5', background: '#FFF7F7',
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  cardIcon: { fontSize: '24px' },
  alertBadge: {
    width: '20px', height: '20px', borderRadius: '50%', background: '#D32F2F',
    color: '#fff', fontSize: '12px', fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  cardValue: { fontSize: '36px', fontWeight: 700, color: '#0F2044', lineHeight: 1 },
  cardLabel: { fontSize: '14px', fontWeight: 600, color: '#374151', marginTop: '6px' },
  cardSub: { fontSize: '12px', color: '#9CA3AF', marginTop: '2px' },
  alertMsg: { fontSize: '12px', color: '#B91C1C', marginTop: '8px', lineHeight: 1.4 },
  footer: {
    display: 'flex', alignItems: 'center', gap: '8px',
    marginTop: '32px', fontSize: '13px', color: '#6B7280',
  },
  footerDot: { width: '8px', height: '8px', borderRadius: '50%', background: '#22C55E' },
};
