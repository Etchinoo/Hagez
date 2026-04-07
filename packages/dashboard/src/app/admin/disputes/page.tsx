// ============================================================
// SUPER RESERVATION PLATFORM — Admin: Dispute Resolution
// US-071: Ops admin resolves disputed bookings.
// Resolution types: uphold (no-show stands) | reverse (full refund) | partial.
// SLA alert: disputes > 72h highlighted in red.
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '@/services/api';

interface Payment {
  type: string;
  amount: string;
  status: string;
  direction: string;
}

interface Dispute {
  id: string;
  booking_ref: string;
  deposit_amount: string;
  dispute_reason: string | null;
  dispute_submitted_at: string | null;
  created_at: string;
  consumer: { full_name: string; phone: string };
  business: { name_ar: string; name_en: string | null };
  payments: Payment[];
}

type Resolution = 'uphold' | 'reverse' | 'partial';

interface DrawerState {
  dispute: Dispute | null;
  resolution: Resolution;
  refund_amount: string;
  reason: string;
}

const EMPTY_DRAWER: DrawerState = { dispute: null, resolution: 'uphold', refund_amount: '', reason: '' };

function hoursAgo(iso: string | null) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
}

export default function DisputesPage() {
  const [disputes, setDisputes]     = useState<Dispute[]>([]);
  const [loading, setLoading]       = useState(true);
  const [drawer, setDrawer]         = useState<DrawerState>(EMPTY_DRAWER);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback]     = useState('');

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.get<{ disputes: Dispute[] }>('/admin/disputes');
      setDisputes(res.data.disputes ?? []);
    } catch {
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

  const handleResolve = async () => {
    if (!drawer.dispute || drawer.reason.trim().length < 5) return;
    if (drawer.resolution === 'partial' && !drawer.refund_amount) return;
    setSubmitting(true);
    try {
      await dashboardApi.post(`/admin/disputes/${drawer.dispute.id}/resolve`, {
        resolution: drawer.resolution,
        refund_amount: drawer.resolution === 'partial' ? Number(drawer.refund_amount) : undefined,
        reason: drawer.reason,
      });
      setFeedback(`✅ Dispute ${drawer.dispute.booking_ref} resolved — ${drawer.resolution}`);
      setDrawer(EMPTY_DRAWER);
      fetchDisputes();
    } catch {
      setFeedback('❌ Failed to resolve dispute. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const depositOf = (d: Dispute) => Number(d.deposit_amount);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Disputes</h1>
        <span style={styles.count}>{disputes.length} open</span>
      </div>

      {feedback && (
        <div style={{ ...styles.feedback, background: feedback.startsWith('✅') ? '#ECFDF5' : '#FEE2E2',
          color: feedback.startsWith('✅') ? '#065F46' : '#B91C1C' }}>
          {feedback}
          <button style={styles.feedbackClose} onClick={() => setFeedback('')}>×</button>
        </div>
      )}

      {loading ? (
        <div style={styles.loader}>Loading…</div>
      ) : disputes.length === 0 ? (
        <div style={styles.empty}>No open disputes.</div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Booking Ref</th>
                <th style={styles.th}>Consumer</th>
                <th style={styles.th}>Business</th>
                <th style={styles.th}>Deposit (EGP)</th>
                <th style={styles.th}>Submitted</th>
                <th style={styles.th}>SLA</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((d) => {
                const age = hoursAgo(d.dispute_submitted_at ?? d.created_at);
                const slaBreached = age >= 72;
                return (
                  <tr key={d.id} style={slaBreached ? styles.rowAlert : undefined}>
                    <td style={styles.td}><span style={styles.ref}>{d.booking_ref}</span></td>
                    <td style={styles.td}>
                      <div>{d.consumer.full_name}</div>
                      <div style={styles.sub}>{d.consumer.phone}</div>
                    </td>
                    <td style={styles.td}>
                      <div>{d.business.name_ar}</div>
                      {d.business.name_en && <div style={styles.sub}>{d.business.name_en}</div>}
                    </td>
                    <td style={styles.td}><strong>{depositOf(d).toLocaleString()} EGP</strong></td>
                    <td style={styles.td}>{age}h ago</td>
                    <td style={styles.td}>
                      {slaBreached
                        ? <span style={styles.slaBreach}>BREACHED ⚠️</span>
                        : <span style={styles.slaOk}>{72 - age}h left</span>}
                    </td>
                    <td style={styles.td}>
                      <button style={styles.resolveBtn}
                        onClick={() => setDrawer({ ...EMPTY_DRAWER, dispute: d })}>
                        Resolve
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Resolution Drawer */}
      {drawer.dispute && (
        <div style={styles.overlay}>
          <div style={styles.drawer}>
            <div style={styles.drawerHeader}>
              <h2 style={styles.drawerTitle}>Resolve Dispute</h2>
              <button style={styles.closeBtn} onClick={() => setDrawer(EMPTY_DRAWER)}>✕</button>
            </div>

            {/* Booking summary */}
            <div style={styles.summary}>
              <div style={styles.summaryRow}>
                <span style={styles.summaryLabel}>Booking</span>
                <span style={styles.summaryValue}>{drawer.dispute.booking_ref}</span>
              </div>
              <div style={styles.summaryRow}>
                <span style={styles.summaryLabel}>Consumer</span>
                <span style={styles.summaryValue}>{drawer.dispute.consumer.full_name} · {drawer.dispute.consumer.phone}</span>
              </div>
              <div style={styles.summaryRow}>
                <span style={styles.summaryLabel}>Business</span>
                <span style={styles.summaryValue}>{drawer.dispute.business.name_ar}</span>
              </div>
              <div style={styles.summaryRow}>
                <span style={styles.summaryLabel}>Deposit Paid</span>
                <span style={styles.summaryValue}>{depositOf(drawer.dispute).toLocaleString()} EGP</span>
              </div>
              {drawer.dispute.dispute_reason && (
                <div style={{ ...styles.summaryRow, flexDirection: 'column', gap: '4px' }}>
                  <span style={styles.summaryLabel}>Consumer Reason</span>
                  <span style={{ ...styles.summaryValue, color: '#374151' }}>{drawer.dispute.dispute_reason}</span>
                </div>
              )}
            </div>

            {/* Payment trail */}
            {drawer.dispute.payments.length > 0 && (
              <div style={styles.paymentTrail}>
                <div style={styles.trailTitle}>Payment Trail</div>
                {drawer.dispute.payments.map((p, i) => (
                  <div key={i} style={styles.trailRow}>
                    <span style={styles.trailType}>{p.type.replace(/_/g, ' ')}</span>
                    <span style={{ ...styles.trailStatus,
                      color: p.status === 'completed' ? '#065F46' : '#92400E' }}>{p.status}</span>
                    <span style={styles.trailAmt}>{Number(p.amount).toLocaleString()} EGP</span>
                  </div>
                ))}
              </div>
            )}

            {/* Resolution options */}
            <div style={styles.section}>
              <label style={styles.label}>Resolution</label>
              {(['uphold', 'reverse', 'partial'] as Resolution[]).map((r) => (
                <label key={r} style={styles.radioRow}>
                  <input
                    type="radio"
                    name="resolution"
                    value={r}
                    checked={drawer.resolution === r}
                    onChange={() => setDrawer((d) => ({ ...d, resolution: r, refund_amount: '' }))}
                  />
                  <span style={styles.radioLabel}>
                    {r === 'uphold' && `Uphold no-show — 75/25 split (Business gets ${(depositOf(drawer.dispute) * 0.75).toFixed(0)} EGP)`}
                    {r === 'reverse' && `Reverse — full refund to consumer (${depositOf(drawer.dispute).toLocaleString()} EGP)`}
                    {r === 'partial' && 'Partial refund — custom amount'}
                  </span>
                </label>
              ))}

              {drawer.resolution === 'partial' && (
                <div style={{ marginTop: '12px' }}>
                  <label style={styles.label}>Refund amount (EGP)</label>
                  <input
                    style={styles.input}
                    type="number"
                    min={1}
                    max={depositOf(drawer.dispute)}
                    value={drawer.refund_amount}
                    onChange={(e) => setDrawer((d) => ({ ...d, refund_amount: e.target.value }))}
                    placeholder={`Max ${depositOf(drawer.dispute)} EGP`}
                  />
                </div>
              )}
            </div>

            <div style={styles.section}>
              <label style={styles.label}>Resolution comments (required)</label>
              <textarea
                style={styles.textarea}
                rows={3}
                value={drawer.reason}
                onChange={(e) => setDrawer((d) => ({ ...d, reason: e.target.value }))}
                placeholder="Explain the decision for the audit log…"
              />
            </div>

            <div style={styles.drawerActions}>
              <button style={styles.cancelBtn} onClick={() => setDrawer(EMPTY_DRAWER)}>Cancel</button>
              <button
                style={styles.submitBtn}
                disabled={
                  submitting ||
                  drawer.reason.trim().length < 5 ||
                  (drawer.resolution === 'partial' && !drawer.refund_amount)
                }
                onClick={handleResolve}
              >
                {submitting ? 'Submitting…' : 'Confirm Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', fontFamily: 'Inter, sans-serif' },
  header: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' },
  title: { fontSize: '24px', fontWeight: 700, color: '#0F2044', margin: 0 },
  count: {
    padding: '4px 10px', background: '#FEE2E2', borderRadius: '20px',
    fontSize: '13px', fontWeight: 600, color: '#B91C1C',
  },
  feedback: {
    padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  feedbackClose: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'inherit' },
  loader: { color: '#6B7280', fontSize: '14px' },
  empty: { color: '#9CA3AF', fontSize: '14px', padding: '48px', textAlign: 'center' },
  tableWrap: { overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1.5px solid #E5E7EB' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: {
    padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px',
    color: '#6B7280', borderBottom: '1.5px solid #E5E7EB', background: '#F9FAFB',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  td: { padding: '14px 16px', borderBottom: '1px solid #F3F4F6', verticalAlign: 'middle' },
  rowAlert: { background: '#FFF7F7' },
  ref: { fontFamily: 'monospace', fontWeight: 600, color: '#0F2044' },
  sub: { fontSize: '12px', color: '#9CA3AF', marginTop: '2px' },
  slaBreach: { fontSize: '12px', fontWeight: 700, color: '#B91C1C' },
  slaOk: { fontSize: '12px', color: '#6B7280' },
  resolveBtn: {
    padding: '6px 14px', background: '#0F2044', border: 'none', borderRadius: '6px',
    fontSize: '13px', fontWeight: 600, color: '#fff', cursor: 'pointer',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', zIndex: 100,
  },
  drawer: {
    background: '#fff', width: '100%', maxWidth: '520px', height: '100vh',
    overflowY: 'auto', padding: '28px', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
    display: 'flex', flexDirection: 'column', gap: '0',
  },
  drawerHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  drawerTitle: { fontSize: '18px', fontWeight: 700, color: '#0F2044', margin: 0 },
  closeBtn: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#9CA3AF' },
  summary: { background: '#F9FAFB', borderRadius: '10px', padding: '16px', marginBottom: '16px' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' },
  summaryLabel: { fontSize: '12px', color: '#6B7280', fontWeight: 600, flexShrink: 0 },
  summaryValue: { fontSize: '13px', color: '#0F2044', fontWeight: 500, textAlign: 'right' },
  paymentTrail: { marginBottom: '16px' },
  trailTitle: { fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '8px', textTransform: 'uppercase' },
  trailRow: { display: 'flex', gap: '12px', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F3F4F6' },
  trailType: { fontSize: '13px', color: '#374151', flex: 1, textTransform: 'capitalize' },
  trailStatus: { fontSize: '12px', fontWeight: 600 },
  trailAmt: { fontSize: '13px', fontWeight: 600, color: '#0F2044', minWidth: '80px', textAlign: 'right' },
  section: { marginBottom: '16px' },
  label: { display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' },
  radioRow: { display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px', cursor: 'pointer' },
  radioLabel: { fontSize: '14px', color: '#374151', lineHeight: 1.4 },
  input: {
    width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: '8px',
    fontSize: '14px', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
  },
  textarea: {
    width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: '8px',
    fontSize: '14px', resize: 'vertical', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
  },
  drawerActions: { display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' },
  cancelBtn: {
    padding: '10px 20px', background: '#F3F4F6', border: 'none', borderRadius: '8px',
    fontSize: '14px', fontWeight: 600, color: '#374151', cursor: 'pointer',
  },
  submitBtn: {
    padding: '10px 20px', background: '#0F2044', border: 'none', borderRadius: '8px',
    fontSize: '14px', fontWeight: 600, color: '#fff', cursor: 'pointer',
  },
};
