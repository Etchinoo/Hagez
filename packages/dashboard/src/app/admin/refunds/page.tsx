// ============================================================
// SUPER RESERVATION PLATFORM — Admin: Manual Refund Execution
// US-073: Admin manually executes refunds for any booking.
// Refunds > 500 EGP require super_admin role.
// ============================================================

'use client';

import { useState } from 'react';
import { dashboardApi } from '@/services/api';
import { useDashboardAuth } from '@/store/auth';

interface BookingResult {
  id: string;
  booking_ref: string;
  status: string;
  deposit_amount: string;
  consumer: { full_name: string; phone: string };
  business: { name_ar: string };
  payments: Array<{ type: string; amount: string; status: string; created_at: string }>;
}

const SUPER_ADMIN_THRESHOLD = 500;

export default function RefundsPage() {
  const { user } = useDashboardAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [query, setQuery]           = useState('');
  const [booking, setBooking]       = useState<BookingResult | null>(null);
  const [searching, setSearching]   = useState(false);
  const [searchError, setSearchError] = useState('');

  const [amount, setAmount]         = useState('');
  const [reason, setReason]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback]     = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError('');
    setBooking(null);
    setFeedback('');
    try {
      const res = await dashboardApi.get<{ booking: BookingResult }>(
        `/admin/bookings/search?q=${encodeURIComponent(query.trim())}`
      );
      setBooking(res.data.booking);
      setAmount(res.data.booking.deposit_amount);
    } catch {
      setSearchError('Booking not found. Try a different reference or phone number.');
    } finally {
      setSearching(false);
    }
  };

  const amountNum = Number(amount);
  const requiresSuperAdmin = amountNum > SUPER_ADMIN_THRESHOLD && !isSuperAdmin;
  const depositNum = booking ? Number(booking.deposit_amount) : 0;
  const amountValid = amountNum > 0 && amountNum <= depositNum;

  const handleRefund = async () => {
    if (!booking || !amountValid || reason.trim().length < 5 || requiresSuperAdmin) return;
    setSubmitting(true);
    try {
      await dashboardApi.post('/admin/refunds', {
        booking_id: booking.id,
        amount_egp: amountNum,
        reason: reason.trim(),
      });
      setFeedback(`✅ Refund of ${amountNum.toLocaleString()} EGP initiated for booking ${booking.booking_ref}`);
      setBooking(null);
      setQuery('');
      setAmount('');
      setReason('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Refund failed. Try again.';
      setFeedback(`❌ ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Manual Refunds</h1>
      <p style={styles.desc}>
        Search a booking by reference number or consumer phone, then execute a full or partial refund.
        {!isSuperAdmin && <> Refunds above <strong>500 EGP</strong> require Super Admin approval.</>}
      </p>

      {feedback && (
        <div style={{ ...styles.feedback, background: feedback.startsWith('✅') ? '#ECFDF5' : '#FEE2E2',
          color: feedback.startsWith('✅') ? '#065F46' : '#B91C1C' }}>
          {feedback}
          <button style={styles.feedbackClose} onClick={() => setFeedback('')}>×</button>
        </div>
      )}

      {/* Search */}
      <div style={styles.searchRow}>
        <input
          style={styles.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="BK-20260101-XXXXX or +201XXXXXXXXX"
        />
        <button style={styles.searchBtn} onClick={handleSearch} disabled={searching}>
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>
      {searchError && <p style={styles.searchError}>{searchError}</p>}

      {/* Booking Detail */}
      {booking && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.refBadge}>{booking.booking_ref}</span>
            <span style={{ ...styles.statusBadge,
              background: booking.status === 'confirmed' ? '#ECFDF5' : '#F3F4F6',
              color: booking.status === 'confirmed' ? '#065F46' : '#374151' }}>
              {booking.status.replace(/_/g, ' ')}
            </span>
          </div>

          <div style={styles.detailGrid}>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>Consumer</div>
              <div style={styles.detailValue}>{booking.consumer.full_name}</div>
              <div style={styles.detailSub}>{booking.consumer.phone}</div>
            </div>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>Business</div>
              <div style={styles.detailValue}>{booking.business.name_ar}</div>
            </div>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>Deposit Paid</div>
              <div style={styles.detailValue}>{depositNum.toLocaleString()} EGP</div>
            </div>
          </div>

          {/* Payment history */}
          {booking.payments.length > 0 && (
            <div style={styles.payHistory}>
              <div style={styles.payHistoryTitle}>Payment History</div>
              {booking.payments.map((p, i) => (
                <div key={i} style={styles.payRow}>
                  <span style={styles.payType}>{p.type.replace(/_/g, ' ')}</span>
                  <span style={{ color: p.status === 'completed' ? '#065F46' : '#92400E', fontSize: '12px', fontWeight: 600 }}>{p.status}</span>
                  <span style={styles.payAmt}>{Number(p.amount).toLocaleString()} EGP</span>
                </div>
              ))}
            </div>
          )}

          {/* Refund form */}
          <div style={styles.refundForm}>
            <div style={styles.formRow}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Refund Amount (EGP)</label>
                <input
                  style={styles.input}
                  type="number"
                  min={1}
                  max={depositNum}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Max ${depositNum} EGP`}
                />
              </div>
              <button style={styles.fullBtn} onClick={() => setAmount(String(depositNum))}>
                Full ({depositNum} EGP)
              </button>
            </div>

            <div>
              <label style={styles.label}>Reason (required)</label>
              <textarea
                style={styles.textarea}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Consumer complained of wrong charge — verified and approved"
              />
            </div>

            {requiresSuperAdmin && (
              <div style={styles.superAdminWarning}>
                ⚠️ Refunds above {SUPER_ADMIN_THRESHOLD} EGP require Super Admin approval. Contact your Super Admin.
              </div>
            )}

            <button
              style={{
                ...styles.submitBtn,
                opacity: (!amountValid || reason.trim().length < 5 || requiresSuperAdmin || submitting) ? 0.5 : 1,
              }}
              disabled={!amountValid || reason.trim().length < 5 || requiresSuperAdmin || submitting}
              onClick={handleRefund}
            >
              {submitting ? 'Processing…' : `Refund ${amountNum > 0 ? amountNum.toLocaleString() + ' EGP' : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', fontFamily: 'Inter, sans-serif', maxWidth: '720px' },
  title: { fontSize: '24px', fontWeight: 700, color: '#0F2044', margin: '0 0 8px' },
  desc: { fontSize: '14px', color: '#6B7280', margin: '0 0 24px', lineHeight: 1.5 },
  feedback: {
    padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '20px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  feedbackClose: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'inherit' },
  searchRow: { display: 'flex', gap: '12px', marginBottom: '8px' },
  searchInput: {
    flex: 1, padding: '12px 16px', border: '1.5px solid #E5E7EB', borderRadius: '10px',
    fontSize: '14px', fontFamily: 'Inter, sans-serif',
  },
  searchBtn: {
    padding: '12px 24px', background: '#0F2044', border: 'none', borderRadius: '10px',
    fontSize: '14px', fontWeight: 600, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  searchError: { fontSize: '13px', color: '#B91C1C', margin: '4px 0 16px' },
  card: {
    background: '#fff', borderRadius: '12px', border: '1.5px solid #E5E7EB',
    padding: '24px', marginTop: '20px',
  },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' },
  refBadge: { fontFamily: 'monospace', fontWeight: 700, fontSize: '16px', color: '#0F2044' },
  statusBadge: { padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' },
  detailItem: {},
  detailLabel: { fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '4px' },
  detailValue: { fontSize: '15px', fontWeight: 600, color: '#0F2044' },
  detailSub: { fontSize: '12px', color: '#9CA3AF', marginTop: '2px' },
  payHistory: { marginBottom: '20px', background: '#F9FAFB', borderRadius: '8px', padding: '12px' },
  payHistoryTitle: { fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '10px' },
  payRow: { display: 'flex', gap: '12px', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #E5E7EB' },
  payType: { fontSize: '13px', flex: 1, color: '#374151', textTransform: 'capitalize' },
  payAmt: { fontSize: '13px', fontWeight: 600, color: '#0F2044' },
  refundForm: { display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' },
  formRow: { display: 'flex', gap: '12px', alignItems: 'flex-end' },
  label: { display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' },
  input: {
    width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: '8px',
    fontSize: '14px', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
  },
  fullBtn: {
    padding: '10px 14px', background: '#F3F4F6', border: 'none', borderRadius: '8px',
    fontSize: '13px', fontWeight: 600, color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  textarea: {
    width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: '8px',
    fontSize: '14px', resize: 'vertical', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
  },
  superAdminWarning: {
    padding: '12px 16px', background: '#FEF3C7', borderRadius: '8px',
    fontSize: '13px', color: '#92400E', fontWeight: 500,
  },
  submitBtn: {
    padding: '12px 24px', background: '#D32F2F', border: 'none', borderRadius: '10px',
    fontSize: '15px', fontWeight: 700, color: '#fff', cursor: 'pointer', alignSelf: 'flex-start',
  },
};
