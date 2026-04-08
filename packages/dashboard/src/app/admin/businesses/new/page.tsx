// ============================================================
// SUPER RESERVATION PLATFORM — Admin: Create Business
// Admin creates a new business and links it to an owner by phone.
// Owner account is auto-created if they haven't signed up yet.
// ============================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { dashboardApi } from '@/services/api';

function normalizePhone(raw: string): string {
  const p = raw.trim().replace(/\s+/g, '');
  if (p.startsWith('+')) return p;
  if (p.startsWith('00')) return '+' + p.slice(2);
  if (p.startsWith('0')) return '+2' + p;
  return '+20' + p;
}

const CATEGORIES = [
  { value: 'restaurant',  label: 'Restaurant'     },
  { value: 'salon',       label: 'Beauty Salon'   },
  { value: 'court',       label: 'Sports Court'   },
  { value: 'gaming_cafe', label: 'Gaming Cafe'    },
  { value: 'car_wash',    label: 'Car Wash'       },
  { value: 'medical',     label: 'Medical Clinic' },
];

const TIERS = ['free', 'starter', 'growth', 'pro', 'enterprise'];

const EMPTY = {
  owner_phone:        '',
  name_ar:            '',
  name_en:            '',
  category:           '',
  district:           '',
  status:             'active',
  subscription_tier:  'free',
  description_ar:     '',
  description_en:     '',
  // Policy defaults (match business model defaults)
  deposit_type:              'fixed',
  deposit_value:             '0',
  cancellation_window_hours: '24',
  payout_method:             'paymob_wallet',
  payout_threshold_egp:      '50',
};

export default function CreateBusinessPage() {
  const router = useRouter();
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const set = (field: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.owner_phone || !form.name_ar || !form.category || !form.district) {
      setError('Owner phone, Arabic name, category, and district are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        owner_phone:              normalizePhone(form.owner_phone),
        name_ar:                  form.name_ar,
        name_en:                  form.name_en || undefined,
        category:                 form.category,
        district:                 form.district,
        status:                   form.status,
        subscription_tier:        form.subscription_tier,
        description_ar:           form.description_ar || undefined,
        description_en:           form.description_en || undefined,
        policy_deposit_type:             form.deposit_type,
        policy_deposit_value:            Number(form.deposit_value),
        policy_cancellation_window_hours: Number(form.cancellation_window_hours),
        payout_method:                   form.payout_method,
        payout_threshold_egp:            Number(form.payout_threshold_egp),
      };
      const res = await dashboardApi.post('/admin/businesses', payload);
      const biz = res.data.business;
      setSuccess(`✅ Business "${biz.name_ar}" created successfully.`);
      setTimeout(() => router.push(`/admin/businesses/${biz.id}`), 1200);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to create business.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => router.push('/admin/businesses')}>← Businesses</button>
        <h1 style={s.title}>Create Business</h1>
      </div>

      <form onSubmit={handleSubmit}>

        {/* Owner */}
        <Section title="Owner">
          <Field label="Owner phone *" hint="Account will be created automatically if the owner hasn't signed up yet.">
            <input style={inp} type="tel" value={form.owner_phone} onChange={set('owner_phone')}
              placeholder="01XXXXXXXXX or +201XXXXXXXXX" dir="ltr" />
          </Field>
        </Section>

        {/* Business info */}
        <Section title="Business Details">
          <TwoCol>
            <Field label="Name (Arabic) *">
              <input style={inp} value={form.name_ar} onChange={set('name_ar')} dir="rtl"
                placeholder="e.g. مطعم النيل الذهبي" />
            </Field>
            <Field label="Name (English)">
              <input style={inp} value={form.name_en} onChange={set('name_en')} dir="ltr"
                placeholder="e.g. Golden Nile Restaurant" />
            </Field>
          </TwoCol>

          <Field label="Category *">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  style={{
                    ...chip,
                    ...(form.category === c.value ? chipActive : {}),
                  }}
                  onClick={() => setForm((f) => ({ ...f, category: c.value }))}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </Field>

          <TwoCol>
            <Field label="District *">
              <input style={inp} value={form.district} onChange={set('district')}
                placeholder="e.g. Zamalek" />
            </Field>
            <Field label="Status">
              <select style={inp} value={form.status} onChange={set('status')}>
                <option value="active">Active</option>
                <option value="pending">Pending (requires approval)</option>
                <option value="suspended">Suspended</option>
              </select>
            </Field>
          </TwoCol>

          <Field label="Description (Arabic)">
            <textarea style={{ ...inp, height: 72, resize: 'vertical' as const }}
              value={form.description_ar} onChange={set('description_ar')} dir="rtl"
              placeholder="Short description in Arabic..." />
          </Field>
          <Field label="Description (English)">
            <textarea style={{ ...inp, height: 72, resize: 'vertical' as const }}
              value={form.description_en} onChange={set('description_en')}
              placeholder="Short description in English..." />
          </Field>
        </Section>

        {/* Booking Policy */}
        <Section title="Booking Policy">
          <TwoCol>
            <Field label="Deposit type">
              <select style={inp} value={form.deposit_type} onChange={set('deposit_type')}>
                <option value="fixed">Fixed amount (EGP)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </Field>
            <Field label={form.deposit_type === 'fixed' ? 'Deposit amount (EGP)' : 'Deposit percentage (%)'}>
              <input style={inp} type="number" min="0" value={form.deposit_value} onChange={set('deposit_value')}
                placeholder="0" />
            </Field>
          </TwoCol>
          <TwoCol>
            <Field label="Free cancellation window (hours)">
              <input style={inp} type="number" min="0" max="168" value={form.cancellation_window_hours}
                onChange={set('cancellation_window_hours')} placeholder="24" />
            </Field>
            <Field label="Payout method">
              <select style={inp} value={form.payout_method} onChange={set('payout_method')}>
                <option value="paymob_wallet">Paymob Wallet</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </Field>
          </TwoCol>
          <TwoCol>
            <Field label="Payout threshold (EGP)" hint="Minimum balance before automatic payout is triggered">
              <input style={inp} type="number" min="0" value={form.payout_threshold_egp}
                onChange={set('payout_threshold_egp')} placeholder="50" />
            </Field>
          </TwoCol>
        </Section>

        {/* Subscription */}
        <Section title="Subscription">
          <Field label="Initial tier">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {TIERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  style={{
                    ...chip,
                    ...(form.subscription_tier === t ? chipActive : {}),
                  }}
                  onClick={() => setForm((f) => ({ ...f, subscription_tier: t }))}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {error   && <div style={s.errBox}>{error}</div>}
        {success && <div style={s.okBox}>{success}</div>}

        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <button type="button" style={s.cancelBtn} onClick={() => router.push('/admin/businesses')}>
            Cancel
          </button>
          <button type="submit" style={{ ...s.submitBtn, opacity: saving ? 0.7 : 1 }} disabled={saving}>
            {saving ? 'Creating…' : 'Create Business'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', marginBottom: 16, border: '1px solid #E5E7EB' }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px' }}>{title}</h2>
      {children}
    </div>
  );
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginBottom: 4 }}>{children}</div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</label>
      {hint && <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 6px' }}>{hint}</p>}
      {children}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8,
  fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#0F2044', boxSizing: 'border-box',
};

const chip: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 20, border: '1.5px solid #E5E7EB',
  background: '#F9FAFB', fontFamily: 'Inter, sans-serif', fontSize: 13,
  fontWeight: 600, color: '#6B7280', cursor: 'pointer',
};

const chipActive: React.CSSProperties = {
  background: '#0F2044', borderColor: '#0F2044', color: '#fff',
};

const s: Record<string, React.CSSProperties> = {
  page:      { padding: '32px', fontFamily: 'Inter, sans-serif', maxWidth: 860, margin: '0 auto' },
  header:    { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 },
  back:      { background: 'none', border: 'none', fontSize: 14, color: '#1B8A7A', cursor: 'pointer', fontWeight: 600 },
  title:     { fontSize: 24, fontWeight: 700, color: '#0F2044', margin: 0 },
  errBox:    { background: '#FEE2E2', color: '#B91C1C', borderRadius: 8, padding: '12px 16px', fontSize: 14, marginBottom: 16 },
  okBox:     { background: '#ECFDF5', color: '#065F46', borderRadius: 8, padding: '12px 16px', fontSize: 14, marginBottom: 16 },
  cancelBtn: { padding: '10px 24px', background: '#F3F4F6', border: 'none', borderRadius: 8, fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer' },
  submitBtn: { padding: '10px 28px', background: '#0F2044', border: 'none', borderRadius: 8, fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer' },
};
