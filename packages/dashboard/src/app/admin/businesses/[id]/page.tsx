// ============================================================
// SUPER RESERVATION PLATFORM — Admin: Business Detail
// Edit profile, policy, tier (super_admin), manage services.
// Services tab shows catalog items for the business's category.
// Admin assigns/unassigns; business owner sets prices & details.
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { dashboardApi } from '@/services/api';
import { useDashboardAuth } from '@/store/auth';

const CATEGORIES = [
  { value: 'restaurant',  label: 'Restaurant'     },
  { value: 'salon',       label: 'Beauty Salon'   },
  { value: 'court',       label: 'Sports Court'   },
  { value: 'gaming_cafe', label: 'Gaming Cafe'    },
  { value: 'car_wash',    label: 'Car Wash'       },
  { value: 'medical',     label: 'Medical Clinic' },
];

const TIERS = ['free', 'starter', 'growth', 'pro', 'enterprise'];

const TIER_COLOR: Record<string, string> = {
  free: '#6B7280', starter: '#1B8A7A', growth: '#0057FF',
  pro: '#7C3AED', enterprise: '#D97706',
};

type Tab = 'profile' | 'services';

interface CatalogItem {
  id: string;
  category: string;
  name_ar: string;
  name_en: string | null;
  typical_duration_min: number;
  is_active: boolean;
}

interface BusinessService {
  id: string;
  name_ar: string;
  name_en: string | null;
  price_egp: number;
  duration_min: number;
  is_active: boolean;
}

interface Business {
  id: string;
  name_ar: string;
  name_en: string | null;
  category: string;
  district: string;
  status: string;
  subscription_tier: string;
  description_ar: string | null;
  description_en: string | null;
  policy_deposit_type: string;
  policy_deposit_value: number;
  policy_cancellation_window_hours: number;
  payout_method: string;
  payout_threshold_egp: number;
  notify_new_booking_push: boolean;
  notify_cancellation_push: boolean;
  notify_payout_whatsapp: boolean;
  owner: { id: string; full_name: string; phone: string; email: string | null };
  services: BusinessService[];
}

export default function BusinessDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const router    = useRouter();
  const { user }  = useDashboardAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [business, setBusiness]   = useState<Business | null>(null);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<Tab>('profile');

  // Profile form
  const [pForm, setPForm] = useState({
    name_ar: '', name_en: '', category: '', district: '',
    description_ar: '', description_en: '',
    status: 'active',
    deposit_type: 'fixed', deposit_value: '0',
    cancellation_window_hours: '24',
    payout_method: 'paymob_wallet', payout_threshold_egp: '50',
    notify_new_booking_push: true,
    notify_cancellation_push: true,
    notify_payout_whatsapp: true,
  });
  const [pSaving, setPSaving] = useState(false);
  const [pMsg, setPMsg]       = useState('');

  // Tier
  const [tier, setTier]           = useState('free');
  const [tierSaving, setTierSaving] = useState(false);
  const [tierMsg, setTierMsg]     = useState('');

  // Services
  const [services, setServices]     = useState<BusinessService[]>([]);
  const [catalog, setCatalog]       = useState<CatalogItem[]>([]);
  const [svcLoading, setSvcLoading] = useState(false);
  const [svcMsg, setSvcMsg]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.get<{ business: Business }>(`/admin/businesses/${id}`);
      const b   = res.data.business;
      setBusiness(b);
      setPForm({
        name_ar:        b.name_ar        ?? '',
        name_en:        b.name_en        ?? '',
        category:       b.category       ?? '',
        district:       b.district       ?? '',
        description_ar: b.description_ar ?? '',
        description_en: b.description_en ?? '',
        status:         b.status         ?? 'active',
        deposit_type:              b.policy_deposit_type ?? 'fixed',
        deposit_value:             String(b.policy_deposit_value ?? 0),
        cancellation_window_hours: String(b.policy_cancellation_window_hours ?? 24),
        payout_method:             b.payout_method ?? 'paymob_wallet',
        payout_threshold_egp:      String(b.payout_threshold_egp ?? 50),
        notify_new_booking_push:   b.notify_new_booking_push  ?? true,
        notify_cancellation_push:  b.notify_cancellation_push ?? true,
        notify_payout_whatsapp:    b.notify_payout_whatsapp   ?? true,
      });
      setTier(b.subscription_tier);
      setServices(b.services ?? []);
    } catch {
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Load catalog when switching to services tab
  useEffect(() => {
    if (tab !== 'services' || !business) return;
    (async () => {
      setSvcLoading(true);
      try {
        const res = await dashboardApi.get<{ items: CatalogItem[] }>(
          `/admin/services?category=${business.category}`
        );
        setCatalog(res.data.items ?? []);
      } catch {
        setCatalog([]);
      } finally {
        setSvcLoading(false);
      }
    })();
  }, [tab, business]);

  // ── Profile save ─────────────────────────────────────────────

  const saveProfile = async () => {
    setPSaving(true); setPMsg('');
    try {
      await dashboardApi.put(`/admin/businesses/${id}`, {
        name_ar:        pForm.name_ar,
        name_en:        pForm.name_en  || null,
        category:       pForm.category,
        district:       pForm.district,
        description_ar: pForm.description_ar || null,
        description_en: pForm.description_en || null,
        status:         pForm.status,
        policy_deposit_type:              pForm.deposit_type,
        policy_deposit_value:             Number(pForm.deposit_value),
        policy_cancellation_window_hours: Number(pForm.cancellation_window_hours),
        payout_method:                   pForm.payout_method,
        payout_threshold_egp:            Number(pForm.payout_threshold_egp),
        notify_new_booking_push:          pForm.notify_new_booking_push,
        notify_cancellation_push:         pForm.notify_cancellation_push,
        notify_payout_whatsapp:           pForm.notify_payout_whatsapp,
      });
      setBusiness((b) => b ? { ...b, category: pForm.category, status: pForm.status } : b);
      setPMsg('✅ Business updated.');
    } catch {
      setPMsg('❌ Failed to save.');
    } finally {
      setPSaving(false);
    }
  };

  // ── Tier save ─────────────────────────────────────────────────

  const saveTier = async () => {
    setTierSaving(true); setTierMsg('');
    try {
      await dashboardApi.patch(`/admin/businesses/${id}/tier`, { tier });
      setTierMsg(`✅ Tier set to ${tier}.`);
    } catch {
      setTierMsg('❌ Failed to change tier.');
    } finally {
      setTierSaving(false);
    }
  };

  // ── Service catalog helpers ───────────────────────────────────

  // Returns the BusinessService that matches a catalog item (by name_ar)
  const getAssigned = (item: CatalogItem) =>
    services.find((s) => s.name_ar === item.name_ar);

  const assignService = async (item: CatalogItem) => {
    setSvcMsg('');
    try {
      const res = await dashboardApi.post(`/admin/businesses/${id}/services`, {
        name_ar:     item.name_ar,
        name_en:     item.name_en || undefined,
        price_egp:   0,                       // business owner will set their own price
        duration_min: item.typical_duration_min,
      });
      setServices((sv) => [...sv, res.data.service]);
      setSvcMsg(`✅ "${item.name_ar}" assigned. Business owner can now set pricing.`);
    } catch {
      setSvcMsg('❌ Failed to assign service.');
    }
  };

  const unassignService = async (svcId: string, name: string) => {
    setSvcMsg('');
    try {
      await dashboardApi.delete(`/admin/businesses/${id}/services/${svcId}`);
      setServices((sv) => sv.filter((s) => s.id !== svcId));
      setSvcMsg(`✅ "${name}" removed.`);
    } catch {
      setSvcMsg('❌ Failed to remove service.');
    }
  };

  if (loading) return <div style={s.loader}>Loading…</div>;
  if (!business) return <div style={s.loader}>Business not found.</div>;

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <button style={s.back} onClick={() => router.push('/admin/businesses')}>← Businesses</button>
        <div style={{ flex: 1 }}>
          <h1 style={s.title}>{business.name_ar}</h1>
          {business.name_en && <p style={s.subtitle}>{business.name_en}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ ...s.badge, background: TIER_COLOR[business.subscription_tier] + '22', color: TIER_COLOR[business.subscription_tier] }}>
            {business.subscription_tier}
          </span>
          <span style={{ ...s.badge, background: business.status === 'active' ? '#ECFDF5' : business.status === 'pending' ? '#FEF3C7' : '#FEE2E2', color: business.status === 'active' ? '#065F46' : business.status === 'pending' ? '#92400E' : '#B91C1C' }}>
            {business.status}
          </span>
        </div>
      </div>

      {/* Owner strip */}
      <div style={s.ownerStrip}>
        <span style={s.ownerLabel}>Owner</span>
        <strong>{business.owner.full_name}</strong>
        <a href={`tel:${business.owner.phone}`} style={s.phone}>{business.owner.phone}</a>
        {business.owner.email && <span style={{ color: '#6B7280' }}>{business.owner.email}</span>}
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {(['profile', 'services'] as Tab[]).map((t) => (
          <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>
            {t === 'profile' ? 'Profile & Policy' : `Services (${services.length})`}
          </button>
        ))}
      </div>

      {/* ── Profile & Policy tab ──────────────────────────────── */}
      {tab === 'profile' && (
        <div>
          <Card title="Business Details">
            <TwoCol>
              <Field label="Name (Arabic) *">
                <input style={inp} value={pForm.name_ar} dir="rtl"
                  onChange={(e) => setPForm((f) => ({ ...f, name_ar: e.target.value }))} />
              </Field>
              <Field label="Name (English)">
                <input style={inp} value={pForm.name_en} dir="ltr"
                  onChange={(e) => setPForm((f) => ({ ...f, name_en: e.target.value }))} />
              </Field>
            </TwoCol>

            <Field label="Category">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {CATEGORIES.map((c) => (
                  <button key={c.value} type="button"
                    style={{ ...chip, ...(pForm.category === c.value ? chipActive : {}) }}
                    onClick={() => setPForm((f) => ({ ...f, category: c.value }))}>
                    {c.label}
                  </button>
                ))}
              </div>
            </Field>

            <TwoCol>
              <Field label="District">
                <input style={inp} value={pForm.district}
                  onChange={(e) => setPForm((f) => ({ ...f, district: e.target.value }))} />
              </Field>
              <Field label="Status">
                <select style={inp} value={pForm.status}
                  onChange={(e) => setPForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                </select>
              </Field>
            </TwoCol>

            <Field label="Description (Arabic)">
              <textarea style={{ ...inp, height: 72, resize: 'vertical' as const }} dir="rtl"
                value={pForm.description_ar}
                onChange={(e) => setPForm((f) => ({ ...f, description_ar: e.target.value }))} />
            </Field>
            <Field label="Description (English)">
              <textarea style={{ ...inp, height: 72, resize: 'vertical' as const }}
                value={pForm.description_en}
                onChange={(e) => setPForm((f) => ({ ...f, description_en: e.target.value }))} />
            </Field>
          </Card>

          <Card title="Booking Policy">
            <TwoCol>
              <Field label="Deposit type">
                <select style={inp} value={pForm.deposit_type}
                  onChange={(e) => setPForm((f) => ({ ...f, deposit_type: e.target.value }))}>
                  <option value="fixed">Fixed amount (EGP)</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
              </Field>
              <Field label={pForm.deposit_type === 'fixed' ? 'Deposit amount (EGP)' : 'Deposit percentage (%)'}>
                <input style={inp} type="number" min="0" value={pForm.deposit_value}
                  onChange={(e) => setPForm((f) => ({ ...f, deposit_value: e.target.value }))} />
              </Field>
            </TwoCol>
            <TwoCol>
              <Field label="Free cancellation window (hours)">
                <input style={inp} type="number" min="0" max="168" value={pForm.cancellation_window_hours}
                  onChange={(e) => setPForm((f) => ({ ...f, cancellation_window_hours: e.target.value }))} />
              </Field>
              <Field label="Payout method">
                <select style={inp} value={pForm.payout_method}
                  onChange={(e) => setPForm((f) => ({ ...f, payout_method: e.target.value }))}>
                  <option value="paymob_wallet">Paymob Wallet</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </Field>
            </TwoCol>
            <TwoCol>
              <Field label="Payout threshold (EGP)">
                <input style={inp} type="number" min="0" value={pForm.payout_threshold_egp}
                  onChange={(e) => setPForm((f) => ({ ...f, payout_threshold_egp: e.target.value }))} />
              </Field>
            </TwoCol>
          </Card>

          <Card title="Notifications">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { key: 'notify_new_booking_push',  label: 'New booking push notification' },
                { key: 'notify_cancellation_push', label: 'Cancellation push notification' },
                { key: 'notify_payout_whatsapp',   label: 'Payout WhatsApp notification' },
              ].map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#374151', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={pForm[key as keyof typeof pForm] as boolean}
                    onChange={(e) => setPForm((f) => ({ ...f, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </Card>

          {pMsg && <Msg text={pMsg} />}
          <button style={{ ...s.saveBtn, opacity: pSaving ? 0.7 : 1 }} disabled={pSaving} onClick={saveProfile}>
            {pSaving ? 'Saving…' : 'Save All Changes'}
          </button>

          {/* Tier — super_admin only */}
          {isSuperAdmin && (
            <Card title="Subscription Tier  (super admin only)" style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {TIERS.map((t) => (
                  <button key={t} type="button"
                    style={{ ...chip, ...(tier === t ? chipActive : {}) }}
                    onClick={() => setTier(t)}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <button style={{ ...s.saveBtn, opacity: tierSaving ? 0.7 : 1 }} disabled={tierSaving} onClick={saveTier}>
                {tierSaving ? 'Saving…' : 'Set Tier'}
              </button>
              {tierMsg && <div style={{ marginTop: 10 }}><Msg text={tierMsg} /></div>}
            </Card>
          )}
        </div>
      )}

      {/* ── Services tab ─────────────────────────────────────── */}
      {tab === 'services' && (
        <div>
          {svcMsg && <Msg text={svcMsg} />}

          {svcLoading ? (
            <div style={{ color: '#9CA3AF', fontSize: 14 }}>Loading catalog…</div>
          ) : catalog.filter((i) => i.is_active).length === 0 ? (
            <Card title="Service Catalog">
              <p style={{ fontSize: 14, color: '#9CA3AF' }}>
                No catalog services defined for <strong>{CATEGORIES.find((c) => c.value === pForm.category)?.label ?? pForm.category}</strong> yet.
                Go to <button style={s.inlineLink} onClick={() => router.push('/admin/services')}>Service Catalog</button> to add them.
              </p>
            </Card>
          ) : (
            <Card title={`Service Catalog — ${CATEGORIES.find((c) => c.value === business.category)?.label ?? business.category}`}>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
                Assign services from the catalog to this business. The business owner sets their own pricing.
              </p>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Service (Arabic)</th>
                    <th style={s.th}>English</th>
                    <th style={s.th}>Default Duration</th>
                    <th style={s.th}>Business Price</th>
                    <th style={s.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.filter((i) => i.is_active).map((item) => {
                    const assigned = getAssigned(item);
                    return (
                      <tr key={item.id} style={{ opacity: assigned ? 1 : 0.75 }}>
                        <td style={s.td}>
                          <span style={{ fontWeight: 600, color: '#0F2044' }}>{item.name_ar}</span>
                        </td>
                        <td style={s.td}>{item.name_en ?? '—'}</td>
                        <td style={s.td}>{item.typical_duration_min} min</td>
                        <td style={s.td}>
                          {assigned
                            ? Number(assigned.price_egp) > 0
                              ? <span style={{ fontWeight: 600, color: '#1B8A7A' }}>{Number(assigned.price_egp)} EGP</span>
                              : <span style={{ color: '#9CA3AF', fontSize: 12 }}>Not set by business yet</span>
                            : <span style={{ color: '#D1D5DB', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={s.td}>
                          {assigned ? (
                            <button
                              style={s.unassignBtn}
                              onClick={() => unassignService(assigned.id, item.name_ar)}
                            >
                              Remove
                            </button>
                          ) : (
                            <button
                              style={s.assignBtn}
                              onClick={() => assignService(item)}
                            >
                              + Assign
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function Card({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', marginBottom: 16, border: '1px solid #E5E7EB', ...style }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 16px' }}>{title}</h3>
      {children}
    </div>
  );
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 4 }}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function Msg({ text }: { text: string }) {
  const ok = text.startsWith('✅');
  return (
    <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12,
      background: ok ? '#ECFDF5' : '#FEE2E2', color: ok ? '#065F46' : '#B91C1C' }}>
      {text}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8,
  fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#0F2044', boxSizing: 'border-box',
};

const chip: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 20, border: '1.5px solid #E5E7EB',
  background: '#F9FAFB', fontFamily: 'Inter, sans-serif', fontSize: 13,
  fontWeight: 600, color: '#6B7280', cursor: 'pointer',
};

const chipActive: React.CSSProperties = {
  background: '#0F2044', borderColor: '#0F2044', color: '#fff',
};

const s: Record<string, React.CSSProperties> = {
  page:       { padding: '32px', fontFamily: 'Inter, sans-serif', maxWidth: 960, margin: '0 auto' },
  loader:     { padding: 48, color: '#9CA3AF', fontFamily: 'Inter, sans-serif' },
  header:     { display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexWrap: 'wrap' },
  back:       { background: 'none', border: 'none', fontSize: 14, color: '#1B8A7A', cursor: 'pointer', fontWeight: 600, paddingTop: 4 },
  title:      { fontSize: 24, fontWeight: 700, color: '#0F2044', margin: 0 },
  subtitle:   { fontSize: 14, color: '#9CA3AF', margin: '4px 0 0' },
  badge:      { padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  ownerStrip: { display: 'flex', gap: 16, alignItems: 'center', background: '#F9FAFB', borderRadius: 10, padding: '12px 20px', marginBottom: 20, fontSize: 14, flexWrap: 'wrap' },
  ownerLabel: { fontWeight: 700, color: '#6B7280', fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  phone:      { color: '#1B8A7A', textDecoration: 'none', fontWeight: 500 },
  tabs:       { display: 'flex', gap: 8, marginBottom: 20 },
  tab:        { padding: '8px 18px', borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#6B7280' },
  tabActive:  { background: '#0F2044', color: '#fff', borderColor: '#0F2044' },
  saveBtn:    { padding: '10px 28px', background: '#0F2044', border: 'none', borderRadius: 8, fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', marginBottom: 8 },
  table:      { width: '100%', borderCollapse: 'collapse' as const, fontSize: 14 },
  th:         { padding: '10px 12px', textAlign: 'left' as const, fontSize: 12, fontWeight: 700, color: '#6B7280', borderBottom: '1.5px solid #E5E7EB', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  td:         { padding: '12px 12px', borderBottom: '1px solid #F3F4F6', verticalAlign: 'middle' as const },
  assignBtn:  { padding: '6px 14px', background: '#ECFDF5', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#065F46', cursor: 'pointer' },
  unassignBtn:{ padding: '6px 14px', background: '#FEE2E2', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#B91C1C', cursor: 'pointer' },
  inlineLink: { background: 'none', border: 'none', color: '#1B8A7A', fontWeight: 700, cursor: 'pointer', fontSize: 14, padding: 0 },
};
