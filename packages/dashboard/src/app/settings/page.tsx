// ============================================================
// SUPER RESERVATION PLATFORM — Settings Page
// Configure availability rules, deposit policy, cancellation window.
// ============================================================

'use client';

import { useState } from 'react';
import { slotsApi } from '@/services/api';

const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default function SettingsPage() {
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
    } catch (err) {
      alert('فشل الحفظ. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'Cairo, sans-serif', direction: 'rtl', maxWidth: '900px' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0F2044', marginBottom: '8px' }}>إعدادات التوافر</h2>
      <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>
        حدد أيام عملك وأوقات الحجوزات. سيتم إنشاء المواعيد تلقائياً للـ 4 أسابيع القادمة.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {rules.map((rule, i) => (
          <div key={i} style={{
            backgroundColor: '#fff', borderRadius: '12px', padding: '16px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)', opacity: rule.enabled ? 1 : 0.5,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {/* Day toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) => updateRule(i, 'enabled', e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 700, fontSize: '15px', color: '#0F2044' }}>{DAYS_AR[i]}</span>
              </div>

              {/* Time range */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="time" value={rule.open_time} onChange={(e) => updateRule(i, 'open_time', e.target.value)} style={inputStyle} disabled={!rule.enabled} />
                <span style={{ color: '#6B7280' }}>إلى</span>
                <input type="time" value={rule.close_time} onChange={(e) => updateRule(i, 'close_time', e.target.value)} style={inputStyle} disabled={!rule.enabled} />
              </div>

              {/* Slot duration */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={labelStyle}>مدة الجلسة (دقيقة)</label>
                <input type="number" min={30} max={240} step={15} value={rule.slot_duration_min} onChange={(e) => updateRule(i, 'slot_duration_min', parseInt(e.target.value))} style={{ ...inputStyle, width: '80px' }} disabled={!rule.enabled} />
              </div>

              {/* Capacity */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={labelStyle}>الطاقة الاستيعابية</label>
                <input type="number" min={1} max={50} value={rule.capacity} onChange={(e) => updateRule(i, 'capacity', parseInt(e.target.value))} style={{ ...inputStyle, width: '70px' }} disabled={!rule.enabled} />
              </div>

              {/* Deposit */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={labelStyle}>العربون (ج.م)</label>
                <input type="number" min={0} step={50} value={rule.deposit_amount} onChange={(e) => updateRule(i, 'deposit_amount', parseInt(e.target.value))} style={{ ...inputStyle, width: '90px' }} disabled={!rule.enabled} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '14px 32px', background: '#1B8A7A', border: 'none', borderRadius: '12px',
            fontFamily: 'Cairo, sans-serif', fontSize: '16px', fontWeight: 700, color: '#fff',
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'جاري الحفظ...' : 'حفظ وإنشاء المواعيد'}
        </button>
        {success && (
          <span style={{ fontFamily: 'Cairo, sans-serif', color: '#1B8A7A', fontSize: '15px' }}>
            ✅ تم حفظ الإعدادات وإنشاء المواعيد بنجاح
          </span>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px', border: '1.5px solid #E5E7EB', borderRadius: '8px',
  fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#0F2044',
};
const labelStyle: React.CSSProperties = {
  fontSize: '12px', color: '#6B7280', fontWeight: 600, whiteSpace: 'nowrap',
};
