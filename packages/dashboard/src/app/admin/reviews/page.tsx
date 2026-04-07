// ============================================================
// SUPER RESERVATION PLATFORM — Admin: Review Moderation Queue
// US-076: Ops admin manually moderates flagged / slow reviews.
// Auto-moderation runs every 10 min — this queue shows stragglers.
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '@/services/api';

interface PendingReview {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  consumer: { full_name: string; phone: string };
  business: { name_ar: string; name_en: string | null };
  booking:  { booking_ref: string };
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span>
      {[1,2,3,4,5].map((s) => (
        <span key={s} style={{ color: s <= rating ? '#F59E0B' : '#D1D5DB', fontSize: '16px' }}>★</span>
      ))}
    </span>
  );
}

function hoursAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
}

export default function ReviewsPage() {
  const [reviews, setReviews]       = useState<PendingReview[]>([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [feedback, setFeedback]     = useState('');

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.get<{ reviews: PendingReview[]; total: number }>('/admin/reviews/pending');
      setReviews(res.data.reviews ?? []);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const moderate = async (id: string, action: 'approve' | 'reject') => {
    setSubmitting(id);
    try {
      await dashboardApi.patch(`/admin/reviews/${id}/moderate`, { action });
      setFeedback(`✅ Review ${action}d`);
      setReviews((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setFeedback('❌ Action failed. Try again.');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Review Moderation</h1>
        <span style={styles.count}>{reviews.length} pending</span>
      </div>
      <p style={styles.desc}>
        Auto-moderation approves clean reviews every 10 min. Reviews shown here need manual decision.
      </p>

      {feedback && (
        <div style={{ ...styles.feedback, background: feedback.startsWith('✅') ? '#ECFDF5' : '#FEE2E2',
          color: feedback.startsWith('✅') ? '#065F46' : '#B91C1C' }}>
          {feedback}
          <button style={styles.feedbackClose} onClick={() => setFeedback('')}>×</button>
        </div>
      )}

      {loading ? (
        <div style={styles.loader}>Loading…</div>
      ) : reviews.length === 0 ? (
        <div style={styles.empty}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
          <div>No pending reviews. Auto-moderation is up to date.</div>
        </div>
      ) : (
        <div style={styles.list}>
          {reviews.map((r) => {
            const age = hoursAgo(r.created_at);
            const sla = age >= 4;
            return (
              <div key={r.id} style={{ ...styles.card, ...(sla ? styles.cardSla : {}) }}>
                <div style={styles.cardTop}>
                  <div>
                    <div style={styles.bizName}>{r.business.name_ar}</div>
                    {r.business.name_en && <div style={styles.bizNameEn}>{r.business.name_en}</div>}
                  </div>
                  <div style={styles.meta}>
                    <span style={styles.ref}>{r.booking.booking_ref}</span>
                    {sla && <span style={styles.slaBadge}>SLA {age}h ⚠️</span>}
                  </div>
                </div>

                <div style={styles.ratingRow}>
                  <StarDisplay rating={r.rating} />
                  <span style={styles.ratingNum}>{r.rating}/5</span>
                  <span style={styles.consumer}>
                    {r.consumer.full_name} · {r.consumer.phone}
                  </span>
                </div>

                {r.body && <p style={styles.body}>{r.body}</p>}
                {!r.body && <p style={styles.noBody}>No written review — rating only.</p>}

                <div style={styles.actions}>
                  <button
                    style={styles.approveBtn}
                    disabled={submitting === r.id}
                    onClick={() => moderate(r.id, 'approve')}
                  >
                    {submitting === r.id ? '…' : '✓ Approve'}
                  </button>
                  <button
                    style={styles.rejectBtn}
                    disabled={submitting === r.id}
                    onClick={() => moderate(r.id, 'reject')}
                  >
                    {submitting === r.id ? '…' : '✕ Reject'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', fontFamily: 'Inter, sans-serif', maxWidth: '800px' },
  header: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' },
  title: { fontSize: '24px', fontWeight: 700, color: '#0F2044', margin: 0 },
  count: { padding: '4px 10px', background: '#FEF3C7', borderRadius: '20px', fontSize: '13px', fontWeight: 600, color: '#92400E' },
  desc: { fontSize: '13px', color: '#6B7280', margin: '0 0 24px' },
  feedback: {
    padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  feedbackClose: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'inherit' },
  loader: { color: '#6B7280', fontSize: '14px' },
  empty: { textAlign: 'center', padding: '64px 0', color: '#6B7280', fontSize: '15px' },
  list: { display: 'flex', flexDirection: 'column', gap: '16px' },
  card: {
    background: '#fff', borderRadius: '12px', border: '1.5px solid #E5E7EB',
    padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  cardSla: { borderColor: '#FCA5A5', background: '#FFF7F7' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' },
  bizName: { fontWeight: 700, fontSize: '15px', color: '#0F2044' },
  bizNameEn: { fontSize: '12px', color: '#9CA3AF', marginTop: '2px' },
  meta: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' },
  ref: { fontFamily: 'monospace', fontSize: '12px', color: '#6B7280' },
  slaBadge: { fontSize: '12px', fontWeight: 700, color: '#B91C1C' },
  ratingRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
  ratingNum: { fontSize: '13px', fontWeight: 600, color: '#374151' },
  consumer: { fontSize: '13px', color: '#6B7280', marginLeft: 'auto' },
  body: { fontSize: '14px', color: '#374151', lineHeight: 1.6, margin: '0 0 16px', padding: '12px', background: '#F9FAFB', borderRadius: '8px' },
  noBody: { fontSize: '13px', color: '#9CA3AF', fontStyle: 'italic', margin: '0 0 16px' },
  actions: { display: 'flex', gap: '10px' },
  approveBtn: {
    padding: '8px 20px', background: '#1B8A7A', border: 'none', borderRadius: '8px',
    fontSize: '14px', fontWeight: 600, color: '#fff', cursor: 'pointer',
  },
  rejectBtn: {
    padding: '8px 20px', background: '#FEE2E2', border: 'none', borderRadius: '8px',
    fontSize: '14px', fontWeight: 600, color: '#B91C1C', cursor: 'pointer',
  },
};
