// ============================================================
// SUPER RESERVATION PLATFORM — Settings Page
// Tab 1: Availability rules (slot generation)
// Tab 2: Deposit & cancellation policy (US-033)
// Tab 3: Payout preferences (US-036)
// Tab 4: Notification preferences (US-049)
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { slotsApi, businessApi, sectionsApi } from '@/services/api';

const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

type Tab = 'availability' | 'policy' | 'payout' | 'notifications' | 'sections';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('availability');

  return (
    <div style={{ padding: '24px', fontFamily: 'Cairo, sans-serif', direction: 'rtl', maxWidth: '900px' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0F2044', marginBottom: '8px' }}>الإعدادات</h2>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', borderBottom: '2px solid #E5E7EB', paddingBottom: '0' }}>
        {([
          { key: 'availability',  label: 'أوقات العمل' },
          { key: 'policy',        label: 'سياسة العربون والإلغاء' },
          { key: 'payout',        label: 'إعدادات المدفوعات' },
          { key: 'notifications', label: 'إشعارات' },
          { key: 'sections',      label: 'الأقسام (قاعة)' },
        ] as { key: Tab; label: string }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
              fontFamily: 'Cairo, sans-serif', fontSize: '15px', fontWeight: activeTab === tab.key ? 700 : 400,
              color: activeTab === tab.key ? '#1B8A7A' : '#6B7280',
              borderBottom: activeTab === tab.key ? '2px solid #1B8A7A' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'availability'  && <AvailabilityTab />}
      {activeTab === 'policy'        && <PolicyTab />}
      {activeTab === 'payout'        && <PayoutTab />}
      {activeTab === 'notifications' && <NotificationsTab />}
      {activeTab === 'sections'      && <SectionsTab />}
    </div>
  );
}

// ── Tab 1: Availability ───────────────────────────────────────

function AvailabilityTab() {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [rules, setRules] = useState([
    { day_of_week: 0, open_time: '09:00', close_time: '22:00', slot_duration_min: 90, capacity: 4, deposit_amount: 100, enabled: true },
    { day_of_week: 1, open_time: '09:00', close_time: '22:00', slot_duration_min: 90, capacity: 4, deposit_amount: 100, enabled: true },
    { day_of_week: 2, open_time: '09:00', close_time: '22:00', slot_duration_min: 90, capacity: 4, deposit_amount: 100, enabled: true },
    { day_of_week: 3, open_time: '09:00', close_time: '22:00', slot_duration_min: 90, capacity: 4, deposit_amount: 100, enabled: true },
    { day_of_week: 4, open_time: '09:00', close_time: '22:00', slot_duration_min: 90, capacity: 4, deposit_amount: 100, enabled: true },
    { day_of_week: 5, open_time: '12:00', close_time: '24:00', slot_duration_min: 90, capacity: 4, deposit_amount: 150, enabled: true },
    { day_of_week: 6, open_time: '12:00', close_time: '24:00', slot_duration_min: 90, capacity: 4, deposit_amount: 150, enabled: true },
  ]);

  const updateRule = (dayIndex: number, field: string, value: any) => {
    setRules((prev) => prev.map((r, i) => i === dayIndex ? { ...r, [field]: value } : r));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const enabledRules = rules.filter((r) => r.enabled).map((r) => ({ ...r, weeks_ahead: 4 }));
      await slotsApi.createBulk(enabledRules);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      alert('فشل الحفظ. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>
        حدد أيام عملك وأوقات الحجوزات. سيتم إنشاء المواعيد تلقائياً للـ 4 أسابيع القادمة.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {rules.map((rule, i) => (
          <div key={i} style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', opacity: rule.enabled ? 1 : 0.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
                <input type="checkbox" checked={rule.enabled} onChange={(e) => updateRule(i, 'enabled', e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                <span style={{ fontWeight: 700, fontSize: '15px', color: '#0F2044' }}>{DAYS_AR[i]}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="time" value={rule.open_time} onChange={(e) => updateRule(i, 'open_time', e.target.value)} style={inputStyle} disabled={!rule.enabled} />
                <span style={{ color: '#6B7280' }}>إلى</span>
                <input type="time" value={rule.close_time} onChange={(e) => updateRule(i, 'close_time', e.target.value)} style={inputStyle} disabled={!rule.enabled} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={labelStyle}>مدة الجلسة (دقيقة)</label>
                <input type="number" min={30} max={240} step={15} value={rule.slot_duration_min} onChange={(e) => updateRule(i, 'slot_duration_min', parseInt(e.target.value))} style={{ ...inputStyle, width: '80px' }} disabled={!rule.enabled} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={labelStyle}>الطاقة الاستيعابية</label>
                <input type="number" min={1} max={50} value={rule.capacity} onChange={(e) => updateRule(i, 'capacity', parseInt(e.target.value))} style={{ ...inputStyle, width: '70px' }} disabled={!rule.enabled} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={labelStyle}>العربون (ج.م)</label>
                <input type="number" min={0} step={50} value={rule.deposit_amount} onChange={(e) => updateRule(i, 'deposit_amount', parseInt(e.target.value))} style={{ ...inputStyle, width: '90px' }} disabled={!rule.enabled} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={handleSave} disabled={saving} style={saveButtonStyle(saving)}>
          {saving ? 'جاري الحفظ...' : 'حفظ وإنشاء المواعيد'}
        </button>
        {success && <span style={{ color: '#1B8A7A', fontSize: '15px' }}>✅ تم حفظ الإعدادات بنجاح</span>}
      </div>
    </div>
  );
}

// ── Tab 2: Deposit & Cancellation Policy (US-033) ─────────────

function PolicyTab() {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [policy, setPolicy] = useState({
    deposit_type: 'fixed' as 'fixed' | 'percentage',
    deposit_value: 100,
    cancellation_window_hours: 24,
  });

  useEffect(() => {
    businessApi.getPolicy().then((r) => {
      if (r.data) setPolicy({
        deposit_type: r.data.deposit_type,
        deposit_value: r.data.deposit_value,
        cancellation_window_hours: r.data.cancellation_window_hours,
      });
    }).catch(() => {});
  }, []);

  const policyPreviewAr = buildPolicyPreview(
    policy.deposit_type,
    policy.deposit_value,
    policy.cancellation_window_hours
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await businessApi.updatePolicy(policy);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      alert('فشل الحفظ. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>
        حدد مبلغ العربون وسياسة الإلغاء. التغييرات تسري على الحجوزات الجديدة فقط.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Deposit type toggle */}
        <div style={sectionCard}>
          <h3 style={sectionTitle}>نوع العربون</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            {(['fixed', 'percentage'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setPolicy((p) => ({ ...p, deposit_type: type }))}
                style={{
                  padding: '10px 20px', border: `1.5px solid ${policy.deposit_type === type ? '#1B8A7A' : '#E5E7EB'}`,
                  borderRadius: '10px', background: policy.deposit_type === type ? '#E8F5F3' : '#fff',
                  fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: 600,
                  color: policy.deposit_type === type ? '#1B8A7A' : '#6B7280', cursor: 'pointer',
                }}
              >
                {type === 'fixed' ? 'مبلغ ثابت (ج.م)' : 'نسبة مئوية (%)'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
            <label style={{ ...labelStyle, fontSize: '14px' }}>
              {policy.deposit_type === 'fixed' ? 'مبلغ العربون (ج.م)' : 'نسبة العربون (%)'}
            </label>
            <input
              type="number"
              min={0}
              max={policy.deposit_type === 'percentage' ? 100 : 9999}
              step={policy.deposit_type === 'fixed' ? 25 : 5}
              value={policy.deposit_value}
              onChange={(e) => setPolicy((p) => ({ ...p, deposit_value: Number(e.target.value) }))}
              style={{ ...inputStyle, width: '110px', fontSize: '16px' }}
            />
            <span style={{ color: '#6B7280', fontSize: '14px' }}>
              {policy.deposit_type === 'fixed' ? 'ج.م' : '%'}
            </span>
          </div>
        </div>

        {/* Cancellation window */}
        <div style={sectionCard}>
          <h3 style={sectionTitle}>نافذة الإلغاء المجاني</h3>
          <p style={{ color: '#6B7280', fontSize: '13px', marginBottom: '12px' }}>
            الإلغاء قبل هذه المدة = استرداد كامل. بعدها = يُحتجز العربون.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="number"
              min={0}
              max={168}
              step={1}
              value={policy.cancellation_window_hours}
              onChange={(e) => setPolicy((p) => ({ ...p, cancellation_window_hours: Number(e.target.value) }))}
              style={{ ...inputStyle, width: '90px', fontSize: '16px' }}
            />
            <label style={{ color: '#0F2044', fontSize: '14px', fontWeight: 600 }}>ساعة قبل الموعد</label>
          </div>
          {policy.cancellation_window_hours === 0 && (
            <p style={{ color: '#D32F2F', fontSize: '12px', marginTop: '8px' }}>
              ⚠️ العربون غير قابل للاسترداد في جميع الأحوال
            </p>
          )}
        </div>

        {/* Consumer-facing policy preview */}
        <div style={{ ...sectionCard, background: '#F0FBF9', border: '1.5px solid #0B8B8F30' }}>
          <h3 style={{ ...sectionTitle, color: '#0B8B8F' }}>معاينة كما يراها العميل</h3>
          <p style={{ fontSize: '14px', color: '#0F2044', lineHeight: '1.7', margin: 0 }}>
            {policyPreviewAr}
          </p>
          <p style={{ fontSize: '11px', color: '#6B7280', marginTop: '8px', marginBottom: 0 }}>
            رسوم الحجز (تُضاف من المنصة): مطعم 25 ج.م • صالون 15 ج.م
          </p>
        </div>
      </div>

      <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={handleSave} disabled={saving} style={saveButtonStyle(saving)}>
          {saving ? 'جاري الحفظ...' : 'حفظ السياسة'}
        </button>
        {success && <span style={{ color: '#1B8A7A', fontSize: '15px' }}>✅ تم حفظ السياسة بنجاح</span>}
      </div>
    </div>
  );
}

// ── Tab 3: Payout Preferences (US-036) ───────────────────────

function PayoutTab() {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pref, setPref] = useState({
    payout_method: 'paymob_wallet' as 'paymob_wallet' | 'bank_transfer',
    payout_threshold_egp: 50,
  });

  useEffect(() => {
    businessApi.getPolicy().then((r) => {
      if (r.data?.payout_method) {
        setPref({
          payout_method: r.data.payout_method,
          payout_threshold_egp: r.data.payout_threshold_egp ?? 50,
        });
      }
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await businessApi.updatePolicy(pref);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      alert('فشل الحفظ. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>
        يتم تحويل مستحقاتك يومياً الساعة 11 مساءً بتوقيت القاهرة.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={sectionCard}>
          <h3 style={sectionTitle}>طريقة الاستلام</h3>
          {([
            { id: 'paymob_wallet', label: 'محفظة Paymob', subtitle: 'يُحول مباشرة إلى محفظتك في Paymob' },
            { id: 'bank_transfer', label: 'تحويل بنكي', subtitle: 'يُحول إلى حساب البنك المرتبط بـ Paymob' },
          ] as const).map((opt) => (
            <div
              key={opt.id}
              onClick={() => setPref((p) => ({ ...p, payout_method: opt.id }))}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px 16px', borderRadius: '10px', cursor: 'pointer',
                border: `1.5px solid ${pref.payout_method === opt.id ? '#1B8A7A' : '#E5E7EB'}`,
                background: pref.payout_method === opt.id ? '#E8F5F3' : '#fff',
                marginBottom: '10px',
              }}
            >
              <input type="radio" readOnly checked={pref.payout_method === opt.id} style={{ accentColor: '#1B8A7A' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F2044' }}>{opt.label}</div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{opt.subtitle}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={sectionCard}>
          <h3 style={sectionTitle}>الحد الأدنى للتحويل</h3>
          <p style={{ color: '#6B7280', fontSize: '13px', marginBottom: '12px' }}>
            إذا كان المبلغ المتراكم أقل من الحد الأدنى، يُؤجل التحويل لليوم التالي.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="number"
              min={0}
              max={5000}
              step={50}
              value={pref.payout_threshold_egp}
              onChange={(e) => setPref((p) => ({ ...p, payout_threshold_egp: Number(e.target.value) }))}
              style={{ ...inputStyle, width: '100px', fontSize: '16px' }}
            />
            <label style={{ color: '#0F2044', fontSize: '14px', fontWeight: 600 }}>ج.م</label>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={handleSave} disabled={saving} style={saveButtonStyle(saving)}>
          {saving ? 'جاري الحفظ...' : 'حفظ إعدادات الاستلام'}
        </button>
        {success && <span style={{ color: '#1B8A7A', fontSize: '15px' }}>✅ تم الحفظ بنجاح</span>}
      </div>
    </div>
  );
}

// ── Tab 5: Sections Config (US-060) — Restaurant only ─────────

function SectionsTab() {
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name_ar: '', name_en: '', capacity: 10 });

  useEffect(() => {
    sectionsApi.list().then((r) => {
      setSections(r.data.sections ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!form.name_ar.trim()) return;
    setSaving(true);
    try {
      const res = await sectionsApi.create(form);
      setSections((s) => [...s, res.data]);
      setForm({ name_ar: '', name_en: '', capacity: 10 });
      setShowForm(false);
    } catch {
      alert('فشل الإضافة. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, is_active: boolean) => {
    await sectionsApi.update(id, { is_active });
    setSections((s) => s.map((sec) => sec.id === id ? { ...sec, is_active } : sec));
  };

  const active = sections.filter((s) => s.is_active);
  const inactive = sections.filter((s) => !s.is_active);

  return (
    <div>
      <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>
        أضف أقسام قاعتك (داخلي، خارجي، VIP...) لتمكين تفضيلات الحجز.
      </p>

      {/* Add form */}
      {showForm ? (
        <div style={sectionCard}>
          <h3 style={sectionTitle}>قسم جديد</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: '6px' }}>الاسم بالعربية *</label>
              <input style={inputStyle} value={form.name_ar} onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} placeholder="داخلي" />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: '6px' }}>السعة (عدد الأشخاص)</label>
              <input type="number" min={1} max={500} style={{ ...inputStyle, width: '100px' }} value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowForm(false)} style={{ ...saveButtonStyle(false), background: '#6B7280', padding: '10px 16px', fontSize: '14px' }}>إلغاء</button>
              <button onClick={handleAdd} disabled={saving} style={{ ...saveButtonStyle(saving), padding: '10px 16px', fontSize: '14px' }}>إضافة</button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} style={{ ...saveButtonStyle(false), marginBottom: '20px' }}>+ إضافة قسم</button>
      )}

      {/* Active sections */}
      {loading ? (
        <div style={{ color: '#6B7280', fontSize: '14px' }}>جاري التحميل...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {active.map((sec) => (
            <div key={sec.id} style={{ ...sectionCard, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
              <button onClick={() => handleToggle(sec.id, false)} style={{ padding: '6px 12px', background: '#FEF2F2', border: 'none', borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#D32F2F', cursor: 'pointer' }}>تعطيل</button>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#0F2044' }}>{sec.name_ar}</div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>سعة {sec.capacity} شخص</div>
              </div>
            </div>
          ))}
          {inactive.map((sec) => (
            <div key={sec.id} style={{ ...sectionCard, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0, opacity: 0.5 }}>
              <button onClick={() => handleToggle(sec.id, true)} style={{ padding: '6px 12px', background: '#E8F5F3', border: 'none', borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#1B8A7A', cursor: 'pointer' }}>تفعيل</button>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600, fontSize: '15px', color: '#0F2044' }}>{sec.name_ar} (معطّل)</div>
                <div style={{ fontSize: '12px', color: '#6B7280' }}>سعة {sec.capacity} شخص</div>
              </div>
            </div>
          ))}
          {active.length === 0 && !showForm && (
            <p style={{ color: '#9CA3AF', fontSize: '14px', textAlign: 'center', padding: '32px' }}>لم تضف أقساماً بعد</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab 4: Notification Preferences (US-049) ─────────────────

function NotificationsTab() {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [prefs, setPrefs] = useState({
    notify_new_booking_push: true,
    notify_cancellation_push: true,
    notify_payout_whatsapp: true,
  });

  useEffect(() => {
    businessApi.getPolicy().then((r) => {
      if (r.data) {
        setPrefs({
          notify_new_booking_push: r.data.notify_new_booking_push ?? true,
          notify_cancellation_push: r.data.notify_cancellation_push ?? true,
          notify_payout_whatsapp: r.data.notify_payout_whatsapp ?? true,
        });
      }
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await businessApi.updatePolicy(prefs);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      alert('فشل الحفظ. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const toggleItems: { key: keyof typeof prefs; title: string; subtitle: string; channel: string }[] = [
    {
      key: 'notify_new_booking_push',
      title: 'إشعار حجز جديد',
      subtitle: 'إشعار فوري على لوحة التحكم عند وصول حجز جديد',
      channel: 'Push',
    },
    {
      key: 'notify_cancellation_push',
      title: 'إشعار الإلغاء',
      subtitle: 'إشعار فوري عند إلغاء أحد العملاء لحجزه',
      channel: 'Push',
    },
    {
      key: 'notify_payout_whatsapp',
      title: 'إشعار التحويل المالي',
      subtitle: 'رسالة واتساب عند إرسال مستحقاتك أو في حالة فشل التحويل',
      channel: 'WhatsApp',
    },
  ];

  return (
    <div>
      <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>
        تحكم في الإشعارات التي تتلقاها عبر التطبيق وواتساب.
      </p>

      <div style={sectionCard}>
        <h3 style={sectionTitle}>إعدادات الإشعارات</h3>
        {toggleItems.map((item, i) => (
          <div
            key={item.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: i === 0 ? 0 : '16px',
              paddingBottom: '16px',
              borderBottom: i < toggleItems.length - 1 ? '1px solid #F0F0F0' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Toggle switch */}
              <div
                onClick={() => setPrefs((p) => ({ ...p, [item.key]: !p[item.key] }))}
                style={{
                  width: '48px', height: '28px', borderRadius: '14px', cursor: 'pointer',
                  backgroundColor: prefs[item.key] ? '#1B8A7A' : '#D1D5DB',
                  position: 'relative', transition: 'background 0.2s',
                  flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '3px',
                  left: prefs[item.key] ? '22px' : '3px',
                  width: '22px', height: '22px', borderRadius: '50%',
                  backgroundColor: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  transition: 'left 0.2s',
                }} />
              </div>
              <span
                style={{
                  fontSize: '12px', fontWeight: 700,
                  color: item.channel === 'WhatsApp' ? '#25D366' : '#1B8A7A',
                  backgroundColor: item.channel === 'WhatsApp' ? '#E8F9EE' : '#E8F5F3',
                  padding: '2px 8px', borderRadius: '12px',
                }}
              >
                {item.channel}
              </span>
            </div>
            <div style={{ textAlign: 'right', flex: 1, marginRight: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F2044' }}>{item.title}</div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{item.subtitle}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={handleSave} disabled={saving} style={saveButtonStyle(saving)}>
          {saving ? 'جاري الحفظ...' : 'حفظ إعدادات الإشعارات'}
        </button>
        {success && <span style={{ color: '#1B8A7A', fontSize: '15px' }}>✅ تم الحفظ بنجاح</span>}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function buildPolicyPreview(
  depositType: string,
  depositValue: number,
  cancellationWindowHours: number
): string {
  const depositText = depositType === 'fixed'
    ? `${depositValue} ج.م`
    : `${depositValue}% من قيمة الخدمة`;

  if (cancellationWindowHours === 0) {
    return `يُطلب عربون ${depositText}. سياسة الإلغاء: العربون غير قابل للاسترداد.`;
  }

  return `يُطلب عربون ${depositText}. يمكن الإلغاء مجاناً قبل ${cancellationWindowHours} ساعة من الموعد. الإلغاء بعد ذلك يُفقدك العربون.`;
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px', border: '1.5px solid #E5E7EB', borderRadius: '8px',
  fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#0F2044',
};
const labelStyle: React.CSSProperties = {
  fontSize: '12px', color: '#6B7280', fontWeight: 600, whiteSpace: 'nowrap',
};
const sectionCard: React.CSSProperties = {
  backgroundColor: '#fff', borderRadius: '12px', padding: '20px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};
const sectionTitle: React.CSSProperties = {
  fontSize: '16px', fontWeight: 700, color: '#0F2044', marginTop: 0, marginBottom: '14px',
};
const saveButtonStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '14px 32px', background: '#1B8A7A', border: 'none', borderRadius: '12px',
  fontFamily: 'Cairo, sans-serif', fontSize: '16px', fontWeight: 700, color: '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.7 : 1,
});
