// ============================================================
// SUPER RESERVATION PLATFORM — Dynamic Pricing Page (EP-14)
// US-103: Surge pricing rules + last-minute discounts config
// US-105: Demand-based auto-pricing opt-in
// US-106: Pricing analytics (revenue uplift, discount-driven bookings)
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { pricingApi } from '@/services/api';
import { useToast } from '@/components/Toast';
import { useLang } from '@/lib/i18n';
import DashboardShell from '@/components/DashboardShell';

const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const COPY = {
  ar: {
    title:          'التسعير الديناميكي',
    subtitle:       'اضبط أسعار حجوزاتك تلقائياً بناءً على الوقت، الطلب، أو قرب الموعد.',
    kpi1:           'حجوزات مسعَّرة ديناميكياً',
    kpi2:           'عائد إضافي من الذروة (ج.م)',
    kpi3:           'حجوزات بالخصم اللحظي',
    kpi4:           'متوسط معامل التسعير',
    loading:        'جاري التحميل...',
    noRules:        'لا توجد قواعد',
    noRulesDesc:    'أضف قاعدة تسعير لتطبيقها تلقائياً على الحجوزات',
    addRule:        'إضافة قاعدة',
    newRule:        'قاعدة',
    newRuleSuffix:  'جديدة',
    lblName:        'اسم القاعدة (للاستخدام الداخلي)',
    phName:         'مثال: ذروة ليلة الجمعة',
    lblMultiplier:  'معامل الزيادة (×)',
    lblTime:        'نافذة الوقت (ساعة)',
    to:             'إلى',
    lblDays:        'أيام التطبيق (اتركه فارغاً = كل الأيام)',
    allDays:        'كل الأيام',
    lblDiscount:    'الخصم (%)',
    lblBefore:      'تطبيق الخصم قبل الموعد بـ',
    minUnit:        'دقيقة',
    hourUnit:       'ساعة',
    lblFillRate:    'تفعيل عند امتلاء %',
    lblMaxMult:     'الحد الأقصى للزيادة (×)',
    cancel:         'إلغاء',
    saving:         'جاري الحفظ...',
    saveRule:       'إضافة القاعدة',
    deactivate:     'إيقاف',
    activate:       'تفعيل',
    delete:         'حذف',
    surge_label:    'سعر الذروة',
    surge_desc:     'رفع السعر في أوقات الطلب العالي (مثل: المساء والعطل)',
    lm_label:       'خصم اللحظة الأخيرة',
    lm_desc:        'تخفيض تلقائي للمواعيد الفارغة قبيل موعدها',
    demand_label:   'تسعير حسب الطلب',
    demand_desc:    'زيادة تلقائية بناءً على نسبة امتلاء المواعيد',
    upliftNote:     'زيادة',
    errNameRequired:'يرجى إدخال اسم القاعدة أولاً',
    errSaveFailed:  'فشل الحفظ',
  },
  en: {
    title:          'Dynamic Pricing',
    subtitle:       'Automatically adjust your booking prices based on time, demand, or proximity to the appointment.',
    kpi1:           'Dynamically priced bookings',
    kpi2:           'Surge revenue uplift (EGP)',
    kpi3:           'Last-minute discount bookings',
    kpi4:           'Avg. pricing multiplier',
    loading:        'Loading...',
    noRules:        'No rules yet',
    noRulesDesc:    'Add a pricing rule to apply it automatically to bookings',
    addRule:        'Add rule',
    newRule:        'New',
    newRuleSuffix:  'rule',
    lblName:        'Rule name (internal use)',
    phName:         'e.g. Friday night surge',
    lblMultiplier:  'Multiplier (×)',
    lblTime:        'Time window (hour)',
    to:             'to',
    lblDays:        'Apply on days (leave empty = all days)',
    allDays:        'All days',
    lblDiscount:    'Discount (%)',
    lblBefore:      'Apply discount before appointment by',
    minUnit:        'min',
    hourUnit:       'hr',
    lblFillRate:    'Activate at fill rate %',
    lblMaxMult:     'Maximum multiplier (×)',
    cancel:         'Cancel',
    saving:         'Saving...',
    saveRule:       'Add rule',
    deactivate:     'Deactivate',
    activate:       'Activate',
    delete:         'Delete',
    surge_label:    'Surge pricing',
    surge_desc:     'Increase price during high-demand periods (evenings, weekends)',
    lm_label:       'Last-minute discount',
    lm_desc:        'Automatically discount empty slots close to their start time',
    demand_label:   'Demand-based pricing',
    demand_desc:    'Automatically increase price based on slot fill rate',
    upliftNote:     'increase',
    errNameRequired: 'Please enter a rule name first',
    errSaveFailed:   'Failed to save',
  },
};

export default function PricingPageWrapper() {
  return (
    <DashboardShell pageTitle="page_pricing">
      <PricingPage />
    </DashboardShell>
  );
}

type RuleType = 'surge' | 'last_minute' | 'demand';

const RULE_TYPE_CONFIG_AR: Record<RuleType, { label: string; icon: string; color: string; desc: string }> = {
  surge:       { label: 'سعر الذروة',           icon: '🔴', color: '#D32F2F', desc: 'رفع السعر في أوقات الطلب العالي (مثل: المساء والعطل)' },
  last_minute: { label: 'خصم اللحظة الأخيرة',   icon: '🟢', color: '#1B8A7A', desc: 'تخفيض تلقائي للمواعيد الفارغة قبيل موعدها' },
  demand:      { label: 'تسعير حسب الطلب',       icon: '📈', color: '#0057FF', desc: 'زيادة تلقائية بناءً على نسبة امتلاء المواعيد' },
};

const RULE_TYPE_CONFIG_EN: Record<RuleType, { label: string; icon: string; color: string; desc: string }> = {
  surge:       { label: 'Surge pricing',          icon: '🔴', color: '#D32F2F', desc: 'Increase price during high-demand periods (evenings, weekends)' },
  last_minute: { label: 'Last-minute discount',   icon: '🟢', color: '#1B8A7A', desc: 'Automatically discount empty slots close to their start time' },
  demand:      { label: 'Demand-based pricing',   icon: '📈', color: '#0057FF', desc: 'Automatically increase price based on slot fill rate' },
};

function emptyForm(type: RuleType) {
  return {
    rule_type: type,
    name_ar: '',
    multiplier: 1.5,
    max_multiplier: 2.0,
    days_of_week: [] as number[],
    hour_start: 18,
    hour_end: 23,
    minutes_before: 120,
    discount_pct: 20,
    fill_rate_pct: 70,
  };
}

export function PricingPage() {
  const { toast } = useToast();
  const { dir, lang } = useLang();
  const c = COPY[lang];
  const DAYS = lang === 'ar' ? DAYS_AR : DAYS_EN;
  const RULE_TYPE_CONFIG = lang === 'ar' ? RULE_TYPE_CONFIG_AR : RULE_TYPE_CONFIG_EN;
  const [rules, setRules] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<RuleType>('surge');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm('surge'));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      pricingApi.list().then((r) => setRules(r.data.rules ?? [])),
      pricingApi.analytics(30).then((r) => setAnalytics(r.data)),
    ]).finally(() => setLoading(false));
  }, []);

  const handleTypeChange = (t: RuleType) => {
    setActiveType(t);
    setForm(emptyForm(t));
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.name_ar.trim()) {
      toast.error(c.errNameRequired);
      return;
    }
    setSaving(true);
    try {
      const payload: any = { rule_type: form.rule_type, name_ar: form.name_ar };
      if (form.rule_type === 'surge') {
        payload.multiplier = form.multiplier;
        payload.days_of_week = form.days_of_week;
        payload.hour_start = form.hour_start;
        payload.hour_end = form.hour_end;
      } else if (form.rule_type === 'last_minute') {
        payload.discount_pct = form.discount_pct;
        payload.minutes_before = form.minutes_before;
      } else {
        payload.multiplier = form.multiplier;
        payload.max_multiplier = form.max_multiplier;
        payload.fill_rate_pct = form.fill_rate_pct;
      }
      const res = await pricingApi.create(payload);
      setRules((r) => [...r, res.data]);
      setForm(emptyForm(activeType));
      setShowForm(false);
    } catch (e: any) {
      toast.error(e.response?.data?.error?.message_ar ?? c.errSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    await pricingApi.toggle(id, !current);
    setRules((r) => r.map((rule) => rule.id === id ? { ...rule, is_active: !current } : rule));
  };

  const handleDelete = async (id: string) => {
    await pricingApi.remove(id);
    setRules((r) => r.filter((rule) => rule.id !== id));
  };

  const filtered = rules.filter((r) => r.rule_type === activeType);
  const cfg = RULE_TYPE_CONFIG[activeType];

  return (
    <div style={{ padding: '24px', fontFamily: 'Cairo, sans-serif', direction: dir, maxWidth: '960px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0F2044', margin: '0 0 6px' }}>{c.title}</h2>
      <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 28px' }}>{c.subtitle}</p>

      {/* Pricing Analytics Cards (US-106) */}
      {analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px', marginBottom: '32px' }}>
          {[
            { label: c.kpi1, value: analytics.total_priced_bookings, color: '#0F2044' },
            { label: c.kpi2, value: analytics.revenue_uplift_egp?.toFixed(0) ?? '0', color: '#D32F2F' },
            { label: c.kpi3, value: analytics.discount_bookings,   color: '#1B8A7A' },
            { label: c.kpi4, value: `×${analytics.avg_multiplier}`, color: '#0057FF' },
          ].map((kpi) => (
            <div key={kpi.label} style={{ background: '#fff', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', borderTop: `3px solid ${kpi.color}` }}>
              <div style={{ fontSize: '26px', fontWeight: 700, color: kpi.color, marginBottom: '4px' }}>{kpi.value}</div>
              <div style={{ fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>{kpi.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Rule type tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        {(Object.entries(RULE_TYPE_CONFIG) as [RuleType, typeof cfg][]).map(([type, c]) => (
          <button
            key={type}
            onClick={() => handleTypeChange(type)}
            style={{
              padding: '10px 20px', border: `1.5px solid ${activeType === type ? c.color : '#E5E7EB'}`,
              borderRadius: '24px', background: activeType === type ? `${c.color}15` : '#fff',
              fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: 700,
              color: activeType === type ? c.color : '#6B7280', cursor: 'pointer',
            }}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Rule type description */}
      <div style={{ background: '#F7F8FA', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', color: '#6B7280', fontSize: '13px' }}>
        {cfg.desc}
      </div>

      {/* Add rule form */}
      {showForm && (
        <div style={card}>
          <h3 style={cardTitle}>{c.newRule} {cfg.label} {c.newRuleSuffix}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>{c.lblName}</label>
              <input style={inp} value={form.name_ar} onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} placeholder={c.phName} />
            </div>

            {activeType === 'surge' && (
              <>
                <div>
                  <label style={lbl}>{c.lblMultiplier}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="range" min={1.1} max={3.0} step={0.1} value={form.multiplier}
                      onChange={(e) => setForm((f) => ({ ...f, multiplier: Number(e.target.value) }))}
                      style={{ flex: 1, accentColor: '#D32F2F' }} />
                    <span style={{ fontWeight: 700, color: '#D32F2F', minWidth: '40px' }}>×{form.multiplier.toFixed(1)}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
                    ×{form.multiplier.toFixed(1)} = {c.upliftNote} {Math.round((form.multiplier - 1) * 100)}%
                  </div>
                </div>
                <div>
                  <label style={lbl}>{c.lblTime}</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select style={inp} value={form.hour_start} onChange={(e) => setForm((f) => ({ ...f, hour_start: Number(e.target.value) }))}>
                      {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}:00</option>)}
                    </select>
                    <span style={{ color: '#6B7280' }}>{c.to}</span>
                    <select style={inp} value={form.hour_end} onChange={(e) => setForm((f) => ({ ...f, hour_end: Number(e.target.value) }))}>
                      {Array.from({ length: 24 }, (_, i) => <option key={i} value={i + 1}>{i + 1}:00</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>{c.lblDays}</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {DAYS.map((day, i) => (
                      <button key={i}
                        onClick={() => setForm((f) => ({
                          ...f,
                          days_of_week: f.days_of_week.includes(i)
                            ? f.days_of_week.filter((d) => d !== i)
                            : [...f.days_of_week, i],
                        }))}
                        style={{
                          padding: '6px 12px', border: `1.5px solid ${form.days_of_week.includes(i) ? '#D32F2F' : '#E5E7EB'}`,
                          borderRadius: '16px', background: form.days_of_week.includes(i) ? '#FEF2F2' : '#fff',
                          fontFamily: 'Cairo, sans-serif', fontSize: '13px',
                          color: form.days_of_week.includes(i) ? '#D32F2F' : '#6B7280', cursor: 'pointer',
                        }}
                      >{day}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeType === 'last_minute' && (
              <>
                <div>
                  <label style={lbl}>{c.lblDiscount}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="range" min={5} max={60} step={5} value={form.discount_pct}
                      onChange={(e) => setForm((f) => ({ ...f, discount_pct: Number(e.target.value) }))}
                      style={{ flex: 1, accentColor: '#1B8A7A' }} />
                    <span style={{ fontWeight: 700, color: '#1B8A7A', minWidth: '40px' }}>{form.discount_pct}%</span>
                  </div>
                </div>
                <div>
                  <label style={lbl}>{c.lblBefore}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="number" min={30} max={1440} step={30} style={{ ...inp, width: '90px' }} value={form.minutes_before}
                      onChange={(e) => setForm((f) => ({ ...f, minutes_before: Number(e.target.value) }))} />
                    <span style={{ color: '#6B7280', fontSize: '13px' }}>{c.minUnit}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
                    {form.minutes_before >= 60 ? `${form.minutes_before / 60} ${c.hourUnit}` : `${form.minutes_before} ${c.minUnit}`}
                  </div>
                </div>
              </>
            )}

            {activeType === 'demand' && (
              <>
                <div>
                  <label style={lbl}>{c.lblFillRate}</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {[50, 70, 90].map((pct) => (
                      <button key={pct} onClick={() => setForm((f) => ({ ...f, fill_rate_pct: pct }))}
                        style={{ padding: '8px 16px', border: `1.5px solid ${form.fill_rate_pct === pct ? '#0057FF' : '#E5E7EB'}`,
                          borderRadius: '10px', background: form.fill_rate_pct === pct ? '#E8F0FF' : '#fff',
                          fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: 700,
                          color: form.fill_rate_pct === pct ? '#0057FF' : '#6B7280', cursor: 'pointer' }}>
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={lbl}>{c.lblMultiplier}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="range" min={1.1} max={2.0} step={0.1} value={form.multiplier}
                      onChange={(e) => setForm((f) => ({ ...f, multiplier: Number(e.target.value) }))}
                      style={{ flex: 1, accentColor: '#0057FF' }} />
                    <span style={{ fontWeight: 700, color: '#0057FF', minWidth: '40px' }}>×{form.multiplier.toFixed(1)}</span>
                  </div>
                </div>
                <div>
                  <label style={lbl}>{c.lblMaxMult}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="range" min={form.multiplier} max={3.0} step={0.1} value={form.max_multiplier}
                      onChange={(e) => setForm((f) => ({ ...f, max_multiplier: Number(e.target.value) }))}
                      style={{ flex: 1, accentColor: '#0057FF' }} />
                    <span style={{ fontWeight: 700, color: '#0057FF', minWidth: '40px' }}>×{form.max_multiplier.toFixed(1)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setShowForm(false)} style={btnSecondary}>{c.cancel}</button>
            <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, background: cfg.color }}>
              {saving ? c.saving : c.saveRule}
            </button>
          </div>
        </div>
      )}

      {/* Existing rules list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>{c.loading}</div>
      ) : filtered.length === 0 && !showForm ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '72px 24px', textAlign: 'center' }}>
          <div style={{ width: 88, height: 88, borderRadius: 22, background: '#F7F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, marginBottom: 20 }}>
            {cfg.icon}
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#0F2044', marginBottom: 8 }}>{c.noRules} — {cfg.label}</div>
          <div style={{ fontSize: '14px', color: '#9CA3AF', marginBottom: 28, maxWidth: 360, lineHeight: '1.7' }}>
            {c.noRulesDesc}
          </div>
          <button onClick={() => setShowForm(true)} style={{ ...btnPrimary, background: cfg.color, padding: '12px 28px', fontSize: '15px' }}>
            {cfg.icon} {c.addRule} — {cfg.label}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((rule) => (
            <div key={rule.id} style={{
              ...card,
              display: 'flex', alignItems: 'center', gap: '16px',
              opacity: rule.is_active ? 1 : 0.5,
              borderInlineStart: `4px solid ${rule.is_active ? cfg.color : '#D1D5DB'}`,
              padding: '16px 20px', marginBottom: 0,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#0F2044' }}>{rule.name_ar}</div>
                <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>
                  {rule.rule_type === 'surge' && `×${Number(rule.multiplier).toFixed(1)} — ${rule.days_of_week.length === 0 ? c.allDays : rule.days_of_week.map((d: number) => DAYS[d]).join(', ')} ${rule.hour_start ?? 0}:00–${rule.hour_end ?? 24}:00`}
                  {rule.rule_type === 'last_minute' && `${rule.discount_pct}% — ${rule.minutes_before} ${c.minUnit}`}
                  {rule.rule_type === 'demand' && `×${Number(rule.multiplier).toFixed(1)}–×${Number(rule.max_multiplier ?? rule.multiplier).toFixed(1)} @ ${rule.fill_rate_pct}%+`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleToggle(rule.id, rule.is_active)}
                  style={{ padding: '6px 12px', border: 'none', borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '13px', cursor: 'pointer',
                    background: rule.is_active ? '#FEF2F2' : '#E8F5F3', color: rule.is_active ? '#D32F2F' : '#1B8A7A', fontWeight: 600 }}>
                  {rule.is_active ? c.deactivate : c.activate}
                </button>
                <button onClick={() => handleDelete(rule.id)}
                  style={{ padding: '6px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', background: 'none', fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#9CA3AF', cursor: 'pointer' }}>
                  {c.delete}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: '#fff', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: '20px' };
const cardTitle: React.CSSProperties = { fontWeight: 700, fontSize: '17px', color: '#0F2044', marginTop: 0, marginBottom: '18px' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '6px' };
const inp: React.CSSProperties = { width: '100%', border: '1.5px solid #E5E7EB', borderRadius: '8px', padding: '9px 12px', fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#0F2044', boxSizing: 'border-box' };
const btnPrimary: React.CSSProperties = { padding: '10px 22px', border: 'none', borderRadius: '10px', fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: 700, color: '#fff', cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '10px 22px', background: '#F7F8FA', border: '1px solid #E5E7EB', borderRadius: '10px', fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: 600, color: '#6B7280', cursor: 'pointer' };
