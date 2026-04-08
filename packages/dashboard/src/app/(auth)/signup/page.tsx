// ============================================================
// SUPER RESERVATION PLATFORM — Business Owner Signup
// 4-step wizard: phone → OTP → business details → submitted
// New business is created with status 'pending' for admin review.
// Admin approves via the console; owner is notified.
// ============================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, dashboardApi } from '@/services/api';
import { useDashboardAuth } from '@/store/auth';

type Step = 'phone' | 'otp' | 'details' | 'submitted';

const CATEGORIES = [
  { value: 'restaurant',  label: 'مطعم'              },
  { value: 'salon',       label: 'صالون تجميل'       },
  { value: 'court',       label: 'ملعب رياضي'         },
  { value: 'gaming_cafe', label: 'كافيه جيمنج'        },
  { value: 'car_wash',    label: 'غسيل سيارات'        },
  { value: 'medical',     label: 'عيادة طبية'         },
];

function normalizePhone(raw: string): string {
  const p = raw.trim().replace(/\s+/g, '');
  if (p.startsWith('+')) return p;
  if (p.startsWith('00')) return '+' + p.slice(2);
  if (p.startsWith('0')) return '+2' + p;
  return '+20' + p;
}

export default function SignupPage() {
  const router    = useRouter();
  const setSession = useDashboardAuth((s) => s.setSession);
  const patchUser  = useDashboardAuth((s) => s.patchUser);

  const [step, setStep]     = useState<Step>('phone');
  const [phone, setPhone]   = useState('');
  const [otp, setOtp]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  // Temporary tokens from OTP verify — used for /business/signup call
  const [tempTokens, setTempTokens] = useState<{ access_token: string; refresh_token: string } | null>(null);

  const [form, setForm] = useState({
    full_name:      '',
    name_ar:        '',
    name_en:        '',
    category:       'restaurant',
    district:       '',
    description_ar: '',
  });

  // ── Step 1: Request OTP ──────────────────────────────────────

  const handleRequestOtp = async () => {
    const normalised = normalizePhone(phone);
    if (!/^\+\d{10,15}$/.test(normalised)) {
      setError('رقم الهاتف غير صحيح. مثال: 01001234567');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authApi.requestOtp(normalised);
      setPhone(normalised);
      setStep('otp');
    } catch {
      setError('فشل إرسال الكود. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ───────────────────────────────────────

  const handleVerifyOtp = async () => {
    if (!otp.trim()) { setError('يرجى إدخال كود التحقق.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await authApi.verifyOtp(phone, otp);
      const { access_token, refresh_token, user } = res.data;

      // If already a business owner → just log them in and redirect
      if (user.role === 'business_owner') {
        setSession({ access_token, refresh_token }, user);
        router.replace('/');
        return;
      }

      // New user (consumer role) → store tokens temporarily, continue to details
      setTempTokens({ access_token, refresh_token });
      // Put tokens in localStorage so dashboardApi interceptor picks them up
      localStorage.setItem('reservr_biz_access_token', access_token);
      localStorage.setItem('reservr_biz_refresh_token', refresh_token);

      setStep('details');
    } catch {
      setError('الكود غير صحيح أو منتهي الصلاحية.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Submit business details ─────────────────────────

  const handleSubmitDetails = async () => {
    if (!form.full_name.trim() || !form.name_ar.trim() || !form.district.trim()) {
      setError('الاسم ونشاطك التجاري والحي كلها حقول مطلوبة.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await dashboardApi.post('/business/signup', {
        full_name:      form.full_name.trim(),
        name_ar:        form.name_ar.trim(),
        name_en:        form.name_en.trim() || undefined,
        category:       form.category,
        district:       form.district.trim(),
        description_ar: form.description_ar.trim() || undefined,
      });

      const { access_token, refresh_token, user } = res.data;
      // Store final tokens with updated role (business_owner)
      setSession({ access_token, refresh_token }, user);

      setStep('submitted');
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      if (code === 'BUSINESS_EXISTS') {
        setError('يوجد نشاط تجاري مرتبط بهذا الحساب. يرجى تسجيل الدخول.');
      } else {
        setError(err?.response?.data?.error?.message ?? 'حدث خطأ. حاول مرة أخرى.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={st.container}>
      <div style={st.card}>

        {/* Logo */}
        <div style={st.logoBlock}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Hagez" style={{ height: '52px', marginBottom: '6px' }} />
          <h1 style={st.title}>سجّل نشاطك التجاري</h1>
          {step !== 'submitted' && (
            <p style={st.subtitle}>
              {step === 'phone'   && 'أدخل رقم هاتفك لتبدأ'}
              {step === 'otp'     && 'تحقق من رقمك'}
              {step === 'details' && 'أكمل بيانات نشاطك'}
            </p>
          )}
        </div>

        {/* Progress dots */}
        {step !== 'submitted' && (
          <div style={st.dots}>
            {(['phone', 'otp', 'details'] as Step[]).map((s, i) => (
              <div
                key={s}
                style={{
                  ...st.dot,
                  background: step === s ? '#1B8A7A' :
                    (['phone', 'otp', 'details'].indexOf(step) > i) ? '#0F2044' : '#E5E7EB',
                }}
              />
            ))}
          </div>
        )}

        {/* ── Step 1: Phone ── */}
        {step === 'phone' && (
          <>
            <label style={st.label}>رقم الهاتف</label>
            <input
              style={st.input}
              type="tel"
              name="phone"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRequestOtp()}
              placeholder="01XXXXXXXXX"
              dir="ltr"
              autoFocus
            />
            {error && <p style={st.error}>{error}</p>}
            <button style={st.btn} onClick={handleRequestOtp} disabled={loading}>
              {loading ? 'جاري الإرسال...' : 'إرسال كود التحقق'}
            </button>
            <p style={st.switchLink}>
              لديك حساب بالفعل؟{' '}
              <button style={st.link} onClick={() => router.push('/login')}>سجّل الدخول</button>
            </p>
          </>
        )}

        {/* ── Step 2: OTP ── */}
        {step === 'otp' && (
          <>
            <p style={st.sentTo}>أرسلنا كود التحقق إلى {phone}</p>
            <label style={st.label}>كود التحقق</label>
            <input
              style={{ ...st.input, textAlign: 'center', letterSpacing: '12px', fontSize: '24px' }}
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
              placeholder="1111"
              autoFocus
            />
            {error && <p style={st.error}>{error}</p>}
            <button style={st.btn} onClick={handleVerifyOtp} disabled={loading}>
              {loading ? 'جاري التحقق...' : 'تأكيد'}
            </button>
            <button style={st.ghostBtn} onClick={() => { setStep('phone'); setOtp(''); setError(''); }}>
              تغيير رقم الهاتف
            </button>
          </>
        )}

        {/* ── Step 3: Business details ── */}
        {step === 'details' && (
          <>
            {/* Owner name */}
            <div style={st.fieldGroup}>
              <label style={st.label}>اسمك الكامل *</label>
              <input
                style={st.input}
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="مثال: أحمد محمد علي"
                dir="rtl"
              />
            </div>

            {/* Business name Arabic */}
            <div style={st.fieldGroup}>
              <label style={st.label}>اسم النشاط التجاري (عربي) *</label>
              <input
                style={st.input}
                value={form.name_ar}
                onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                placeholder="مثال: مطعم النيل الذهبي"
                dir="rtl"
              />
            </div>

            {/* Business name English */}
            <div style={st.fieldGroup}>
              <label style={st.label}>اسم النشاط (إنجليزي)</label>
              <input
                style={{ ...st.input, direction: 'ltr' }}
                value={form.name_en}
                onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                placeholder="e.g. Golden Nile Restaurant"
              />
            </div>

            {/* Category */}
            <div style={st.fieldGroup}>
              <label style={st.label}>نوع النشاط *</label>
              <div style={st.chips}>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    style={{
                      ...st.chip,
                      ...(form.category === c.value ? st.chipActive : {}),
                    }}
                    onClick={() => setForm((f) => ({ ...f, category: c.value }))}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* District */}
            <div style={st.fieldGroup}>
              <label style={st.label}>الحي / المنطقة *</label>
              <input
                style={st.input}
                value={form.district}
                onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
                placeholder="مثال: الزمالك، المعادي، مدينة نصر"
                dir="rtl"
              />
            </div>

            {/* Description */}
            <div style={st.fieldGroup}>
              <label style={st.label}>وصف مختصر (اختياري)</label>
              <textarea
                style={{ ...st.input, height: '72px', resize: 'vertical', paddingTop: '10px' }}
                value={form.description_ar}
                onChange={(e) => setForm((f) => ({ ...f, description_ar: e.target.value }))}
                placeholder="اكتب وصفاً قصيراً عن نشاطك..."
                dir="rtl"
              />
            </div>

            {error && <p style={st.error}>{error}</p>}
            <button style={st.btn} onClick={handleSubmitDetails} disabled={loading}>
              {loading ? 'جاري الإرسال...' : 'تقديم الطلب'}
            </button>
            <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#9CA3AF', textAlign: 'center', marginTop: '12px' }}>
              سيراجع فريق Hagez طلبك خلال 24 ساعة
            </p>
          </>
        )}

        {/* ── Step 4: Submitted ── */}
        {step === 'submitted' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={st.successIcon}>✅</div>
            <h2 style={st.successTitle}>تم استلام طلبك!</h2>
            <p style={st.successBody}>
              سيراجع فريق Hagez بيانات نشاطك خلال 24 ساعة وسيتواصل معك عبر واتساب أو رسالة نصية عند الموافقة.
            </p>
            <button style={{ ...st.btn, marginTop: '24px' }} onClick={() => router.push('/')}>
              الذهاب للوحة التحكم
            </button>
            <button style={st.ghostBtn} onClick={() => router.push('/login')}>
              تسجيل الخروج
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

const st: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #0F2044 0%, #1B8A7A 100%)',
    padding: '24px',
  },
  card: {
    background: '#fff', borderRadius: '20px', padding: '40px 36px',
    width: '100%', maxWidth: '460px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
  },
  logoBlock: { textAlign: 'center', marginBottom: '20px' },
  title:     { fontFamily: 'Cairo, sans-serif', fontSize: '20px', fontWeight: 700, color: '#0F2044', margin: '0 0 4px' },
  subtitle:  { fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#6B7280', margin: 0 },
  dots:      { display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' },
  dot:       { width: '10px', height: '10px', borderRadius: '50%', transition: 'background 0.2s' },
  label: {
    display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: '14px',
    fontWeight: 600, color: '#0F2044', marginBottom: '6px', textAlign: 'right',
  },
  sentTo: { fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#6B7280', textAlign: 'right', marginBottom: '14px' },
  input: {
    width: '100%', padding: '13px 14px', border: '1.5px solid #E5E7EB', borderRadius: '10px',
    fontFamily: 'Cairo, sans-serif', fontSize: '16px', color: '#0F2044',
    outline: 'none', boxSizing: 'border-box', marginBottom: '6px',
  },
  fieldGroup: { marginBottom: '14px' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end' },
  chip: {
    padding: '8px 16px', borderRadius: '20px', border: '1.5px solid #E5E7EB',
    background: '#F9FAFB', fontFamily: 'Cairo, sans-serif', fontSize: '13px',
    fontWeight: 600, color: '#6B7280', cursor: 'pointer',
  },
  chipActive: { background: '#0F2044', borderColor: '#0F2044', color: '#fff' },
  error: {
    fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#D32F2F',
    textAlign: 'right', marginBottom: '8px', marginTop: '2px',
  },
  btn: {
    width: '100%', padding: '15px', background: '#1B8A7A', border: 'none', borderRadius: '12px',
    fontFamily: 'Cairo, sans-serif', fontSize: '16px', fontWeight: 700, color: '#fff',
    cursor: 'pointer', marginTop: '10px',
  },
  ghostBtn: {
    width: '100%', padding: '11px', background: 'none', border: 'none',
    fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#1B8A7A',
    cursor: 'pointer', marginTop: '6px',
  },
  switchLink: {
    fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#6B7280',
    textAlign: 'center', marginTop: '16px',
  },
  link: {
    background: 'none', border: 'none', fontFamily: 'Cairo, sans-serif',
    fontSize: '14px', color: '#1B8A7A', fontWeight: 700, cursor: 'pointer',
  },
  successIcon:  { fontSize: '48px', marginBottom: '16px' },
  successTitle: { fontFamily: 'Cairo, sans-serif', fontSize: '20px', fontWeight: 700, color: '#0F2044', margin: '0 0 12px' },
  successBody:  { fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#6B7280', lineHeight: '1.7' },
};
