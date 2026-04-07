// ============================================================
// SUPER RESERVATION PLATFORM — Admin: Business Verification
// US-070: Pending business verification queue (approve / reject).
// US-072: Suspend / reactivate business accounts.
// SLA alert: pending > 24h highlighted in red.
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '@/services/api';
import { useDashboardAuth } from '@/store/auth';

type TabKey = 'pending' | 'active' | 'suspended';

interface Business {
  id: string;
  name_ar: string;
  name_en: string | null;
  category: string;
  district: string;
  status: string;
  created_at: string;
  owner: { full_name: string; phone: string; email: string | null };
}

interface ModalState {
  type: 'reject' | 'suspend' | null;
  business: Business | null;
  reason: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  restaurant: 'Restaurant', salon: 'Salon', court: 'Sports Court',
  gaming_cafe: 'Gaming Cafe', car_wash: 'Car Wash', medical: 'Medical',
};

function msToHours(ms: number) { return Math.floor(ms / 3_600_000); }

export default function BusinessesPage() {
  const { user } = useDashboardAuth();
  const [tab, setTab]             = useState<TabKey>('pending');
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState<ModalState>({ type: null, business: null, reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback]   = useState('');

  const fetchBusinesses = useCallback(async (status: TabKey) => {
    setLoading(true);
    try {
      const endpoint = status === 'pending'
        ? '/admin/businesses/pending'
        : `/admin/businesses?status=${status}`;
      const res = await dashboardApi.get<{ businesses: Business[] }>(endpoint);
      setBusinesses(res.data.businesses ?? []);
    } catch {
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBusinesses(tab); }, [tab, fetchBusinesses]);

  const handleApprove = async (b: Business) => {
    try {
      await dashboardApi.patch(`/admin/businesses/${b.id}/verify`, { approved: true });
      setFeedback(`✅ ${b.name_ar} approved`);
      fetchBusinesses(tab);
    } catch {
      setFeedback('❌ Failed to approve. Try again.');
    }
  };

  const handleReject = async () => {
    if (!modal.business || !modal.reason.trim()) return;
    setSubmitting(true);
    try {
      await dashboardApi.patch(`/admin/businesses/${modal.business.id}/verify`, {
        approved: false,
        rejection_reason: modal.reason,
      });
      setFeedback(`✅ ${modal.business.name_ar} rejected`);
      setModal({ type: null, business: null, reason: '' });
      fetchBusinesses(tab);
    } catch {
      setFeedback('❌ Failed to reject. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuspend = async () => {
    if (!modal.business || modal.reason.trim().length < 10) return;
    setSubmitting(true);
    try {
      await dashboardApi.patch(`/admin/businesses/${modal.business.id}/suspend`, { reason: modal.reason });
      setFeedback(`✅ ${modal.business.name_ar} suspended`);
      setModal({ type: null, business: null, reason: '' });
      fetchBusinesses(tab);
    } catch {
      setFeedback('❌ Failed to suspend. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const hoursAgo = (iso: string) => msToHours(Date.now() - new Date(iso).getTime());

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Businesses</h1>
        <div style={styles.tabs}>
          {(['pending', 'active', 'suspended'] as TabKey[]).map((t) => (
            <button
              key={t}
              style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
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
      ) : businesses.length === 0 ? (
        <div style={styles.empty}>No {tab} businesses.</div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Business</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>District</th>
                <th style={styles.th}>Owner</th>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Submitted</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((b) => {
                const age = hoursAgo(b.created_at);
                const slaBreached = tab === 'pending' && age >= 24;
                return (
                  <tr key={b.id} style={slaBreached ? styles.rowAlert : undefined}>
                    <td style={styles.td}>
                      <div style={styles.bizName}>{b.name_ar}</div>
                      {b.name_en && <div style={styles.bizNameEn}>{b.name_en}</div>}
                    </td>
                    <td style={styles.td}>{CATEGORY_LABEL[b.category] ?? b.category}</td>
                    <td style={styles.td}>{b.district}</td>
                    <td style={styles.td}>{b.owner.full_name}</td>
                    <td style={styles.td}>
                      <a href={`tel:${b.owner.phone}`} style={styles.phone}>{b.owner.phone}</a>
                    </td>
                    <td style={styles.td}>
                      <span style={slaBreached ? styles.slaBadge : styles.ageText}>
                        {age}h ago{slaBreached ? ' ⚠️' : ''}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {tab === 'pending' && (
                        <div style={styles.actions}>
                          <button style={styles.approveBtn} onClick={() => handleApprove(b)}>Approve</button>
                          <button style={styles.rejectBtn}
                            onClick={() => setModal({ type: 'reject', business: b, reason: '' })}>
                            Reject
                          </button>
                        </div>
                      )}
                      {tab === 'active' && (
                        <button style={styles.suspendBtn}
                          onClick={() => setModal({ type: 'suspend', business: b, reason: '' })}>
                          Suspend
                        </button>
                      )}
                      {tab === 'suspended' && isSuperAdmin && (
                        <button style={styles.approveBtn}
                          onClick={async () => {
                            await dashboardApi.patch(`/admin/businesses/${b.id}/verify`, { approved: true });
                            fetchBusinesses(tab);
                          }}>
                          Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject / Suspend Modal */}
      {modal.type && modal.business && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>
              {modal.type === 'reject' ? 'Reject Business' : 'Suspend Business'}
            </h2>
            <p style={styles.modalBiz}>{modal.business.name_ar}</p>
            <label style={styles.label}>
              {modal.type === 'reject' ? 'Rejection reason' : 'Suspension reason (min 10 chars)'}
            </label>
            <textarea
              style={styles.textarea}
              rows={4}
              value={modal.reason}
              onChange={(e) => setModal((m) => ({ ...m, reason: e.target.value }))}
              placeholder={modal.type === 'reject'
                ? 'e.g. Incomplete registration documents'
                : 'e.g. Multiple consumer complaints about no-shows'}
            />
            <div style={styles.modalActions}>
              <button style={styles.cancelBtn}
                onClick={() => setModal({ type: null, business: null, reason: '' })}>
                Cancel
              </button>
              <button
                style={modal.type === 'reject' ? styles.rejectBtn : styles.suspendBtn}
                disabled={submitting || (modal.type === 'suspend' && modal.reason.trim().length < 10)}
                onClick={modal.type === 'reject' ? handleReject : handleSuspend}
              >
                {submitting ? 'Submitting…' : modal.type === 'reject' ? 'Confirm Reject' : 'Confirm Suspend'}
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
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' },
  title: { fontSize: '24px', fontWeight: 700, color: '#0F2044', margin: 0 },
  tabs: { display: 'flex', gap: '8px' },
  tab: {
    padding: '8px 18px', borderRadius: '8px', border: '1.5px solid #E5E7EB',
    background: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', color: '#6B7280',
  },
  tabActive: { background: '#0F2044', color: '#fff', borderColor: '#0F2044' },
  feedback: {
    padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  feedbackClose: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'inherit' },
  loader: { color: '#6B7280', fontSize: '14px' },
  empty: { color: '#9CA3AF', fontSize: '14px', padding: '32px', textAlign: 'center' },
  tableWrap: { overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1.5px solid #E5E7EB' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: {
    padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '12px',
    color: '#6B7280', borderBottom: '1.5px solid #E5E7EB', background: '#F9FAFB',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  td: { padding: '14px 16px', borderBottom: '1px solid #F3F4F6', verticalAlign: 'middle' },
  rowAlert: { background: '#FFF7F7' },
  bizName: { fontWeight: 600, color: '#0F2044' },
  bizNameEn: { fontSize: '12px', color: '#9CA3AF', marginTop: '2px' },
  phone: { color: '#1B8A7A', textDecoration: 'none', fontWeight: 500 },
  ageText: { fontSize: '13px', color: '#6B7280' },
  slaBadge: { fontSize: '13px', color: '#B91C1C', fontWeight: 600 },
  actions: { display: 'flex', gap: '8px' },
  approveBtn: {
    padding: '6px 14px', background: '#1B8A7A', border: 'none', borderRadius: '6px',
    fontSize: '13px', fontWeight: 600, color: '#fff', cursor: 'pointer',
  },
  rejectBtn: {
    padding: '6px 14px', background: '#FEE2E2', border: 'none', borderRadius: '6px',
    fontSize: '13px', fontWeight: 600, color: '#B91C1C', cursor: 'pointer',
  },
  suspendBtn: {
    padding: '6px 14px', background: '#FEF3C7', border: 'none', borderRadius: '6px',
    fontSize: '13px', fontWeight: 600, color: '#92400E', cursor: 'pointer',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modal: {
    background: '#fff', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '460px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  modalTitle: { fontSize: '18px', fontWeight: 700, color: '#0F2044', margin: '0 0 4px' },
  modalBiz: { fontSize: '14px', color: '#6B7280', margin: '0 0 20px' },
  label: { display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' },
  textarea: {
    width: '100%', padding: '12px', border: '1.5px solid #E5E7EB', borderRadius: '8px',
    fontSize: '14px', resize: 'vertical', fontFamily: 'Inter, sans-serif',
    boxSizing: 'border-box', marginBottom: '16px',
  },
  modalActions: { display: 'flex', gap: '12px', justifyContent: 'flex-end' },
  cancelBtn: {
    padding: '8px 18px', background: '#F3F4F6', border: 'none', borderRadius: '8px',
    fontSize: '14px', fontWeight: 600, color: '#374151', cursor: 'pointer',
  },
};
