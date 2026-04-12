// ============================================================
// SUPER RESERVATION PLATFORM — Business Owner Signup
// 4-step wizard: phone -> OTP -> business details -> submitted
// New business is created with status 'pending' for admin review.
// Admin approves via the console; owner is notified.
// ============================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, dashboardApi } from '@/services/api';
import { useDashboardAuth } from '@/store/auth';
import { useT, useLang } from '@/lib/i18n';
import { useLanguage } from '@/store/language';
import CountryCodeSelect, { buildFullPhone } from '@/components/CountryCodeSelect';

type Step = 'phone' | 'otp' | 'details' | 'submitted';

const CATEGORY_KEYS = [
  { value: 'restaurant',  key: 'cat_restaurant'  as const },
  { value: 'salon',       key: 'cat_salon'       as const },
  { value: 'court',       key: 'cat_court'       as const },
  { value: 'gaming_cafe', key: 'cat_gaming_cafe' as const },
  { value: 'car_wash',    key: 'cat_car_wash'    as const },
  { value: 'medical',     key: 'cat_medical'     as const },
];

export default function SignupPage() {
  const router     = useRouter();
  const setSession = useDashboardAuth((s) => s.setSession);
  const t = useT();
  const { dir, align } = useLang();
  const lang = useLanguage((s) => s.lang);
  const setLang = useLanguage((s) => s.setLang);

  const [step, setStep]     = useState<Step>('phone');
  const [phone, setPhone]   = useState('');
  const [countryCode, setCountryCode] = useState('20');
  const [otp, setOtp]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const [tempTokens, setTempTokens] = useState<{ access_token: string; refresh_token: string } | null>(null);

  const [form, setForm] = useState({
    full_name:      '',
    name_ar:        '',
    name_en:        '',
    category:       'restaurant',
    district:       '',
    description_ar: '',
  });

  const fullPhone = buildFullPhone(countryCode, phone);

  // ── Step 1: Request OTP ──────────────────────────────────────

  const handleRequestOtp = async () => {
    if (!phone.trim()) {
      setError(t('auth_err_phone_required'));
      return;
    }
    if (!/^\+\d{10,15}$/.test(fullPhone)) {
      setError(t('auth_err_phone_invalid'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authApi.requestOtp(fullPhone);
      setStep('otp');
    } catch {
      setError(t('auth_err_otp_failed'));
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ───────────────────────────────────────

  const handleVerifyOtp = async () => {
    if (!otp.trim()) { setError(t('auth_err_otp_required')); return; }
    setLoading(true);
    setError('');
    try {
      const res = await authApi.verifyOtp(fullPhone, otp);
      const { access_token, refresh_token, user } = res.data;

      if (user.role === 'business_owner') {
        setSession({ access_token, refresh_token }, user);
        router.replace('/');
        return;
      }

      setTempTokens({ access_token, refresh_token });
      localStorage.setItem('reservr_biz_access_token', access_token);
      localStorage.setItem('reservr_biz_refresh_token', refresh_token);

      setStep('details');
    } catch {
      setError(t('auth_err_otp_invalid'));
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Submit business details ─────────────────────────

  const handleSubmitDetails = async () => {
    if (!form.full_name.trim() || !form.name_ar.trim() || !form.district.trim()) {
      setError(t('signup_err_required_fields'));
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
      setSession({ access_token, refresh_token }, user);

      setStep('submitted');
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      if (code === 'BUSINESS_EXISTS') {
        setError(t('signup_err_business_exists'));
      } else {
        setError(err?.response?.data?.error?.message ?? t('signup_err_generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={st.container} dir={dir}>
      <div style={st.card}>

        {/* Language toggle */}
        <div style={{ textAlign: dir === 'rtl' ? 'left' : 'right', marginBottom: '8px' }}>
          <button
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            style={st.langToggle}
          >
            {t('auth_lang_toggle')}
          </button>
        </div>

        {/* Logo */}
        <div style={st.logoBlock}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Hagez" style={{ height: '52px', marginBottom: '6px' }} />
          <h1 style={st.title}>{t('signup_title')}</h1>
          {step !== 'submitted' && (
            <p style={st.subtitle}>
              {step === 'phone'   && t('signup_step_phone')}
              {step === 'otp'     && t('signup_step_otp')}
              {step === 'details' && t('signup_step_details')}
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
            <label style={{ ...st.label, textAlign: align }}>{t('auth_phone_label')}</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', direction: 'ltr' }}>
              <CountryCodeSelect value={countryCode} onChange={setCountryCode} />
              <input
                style={{ ...st.input, flex: 1, marginBottom: 0 }}
                type="tel"
                name="phone"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRequestOtp()}
                placeholder={t('auth_phone_placeholder')}
                dir="ltr"
                autoFocus
              />
            </div>
            {error && <p style={{ ...st.error, textAlign: align }}>{error}</p>}
            <button style={st.btn} onClick={handleRequestOtp} disabled={loading}>
              {loading ? t('auth_sending') : t('auth_send_otp')}
            </button>
            <p style={st.switchLink}>
              {t('signup_has_account')}{' '}
              <button style={st.link} onClick={() => router.push('/login')}>{t('signup_login')}</button>
            </p>
          </>
        )}

        {/* ── Step 2: OTP ── */}
        {step === 'otp' && (
          <>
            <p style={{ ...st.sentTo, textAlign: align }}>{t('auth_otp_sent_to')} {fullPhone}</p>
            <label style={{ ...st.label, textAlign: align }}>{t('auth_otp_label')}</label>
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
            {error && <p style={{ ...st.error, textAlign: align }}>{error}</p>}
            <button style={st.btn} onClick={handleVerifyOtp} disabled={loading}>
              {loading ? t('auth_verifying') : t('signup_confirm')}
            </button>
            <button style={st.ghostBtn} onClick={() => { setStep('phone'); setOtp(''); setError(''); }}>
              {t('auth_change_phone')}
            </button>
          </>
        )}

        {/* ── Step 3: Business details ── */}
        {step === 'details' && (
          <>
            {/* Owner name */}
            <div style={st.fieldGroup}>
              <label style={{ ...st.label, textAlign: align }}>{t('signup_full_name')}</label>
              <input
                style={st.input}
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder={t('signup_full_name_placeholder')}
                dir={dir}
              />
            </div>

            {/* Business name Arabic */}
            <div style={st.fieldGroup}>
              <label style={{ ...st.label, textAlign: align }}>{t('signup_biz_name_ar')}</label>
              <input
                style={st.input}
                value={form.name_ar}
                onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                placeholder={t('signup_biz_name_ar_placeholder')}
                dir="rtl"
              />
            </div>

            {/* Business name English */}
            <div style={st.fieldGroup}>
              <label style={{ ...st.label, textAlign: align }}>{t('signup_biz_name_en')}</label>
              <input
                style={{ ...st.input, direction: 'ltr' }}
                value={form.name_en}
                onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                placeholder={t('signup_biz_name_en_placeholder')}
              />
            </div>

            {/* Category */}
            <div style={st.fieldGroup}>
              <label style={{ ...st.label, textAlign: align }}>{t('signup_category')}</label>
              <div style={{ ...st.chips, justifyContent: dir === 'rtl' ? 'flex-end' : 'flex-start' }}>
                {CATEGORY_KEYS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    style={{
                      ...st.chip,
                      ...(form.category === c.value ? st.chipActive : {}),
                    }}
                    onClick={() => setForm((f) => ({ ...f, category: c.value }))}
                  >
                    {t(c.key)}
                  </button>
                ))}
              </div>
            </div>

            {/* District */}
            <div style={st.fieldGroup}>
              <label style={{ ...st.label, textAlign: align }}>{t('signup_district')}</label>
              <input
                style={st.input}
                value={form.district}
                onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
                placeholder={t('signup_district_placeholder')}
                dir={dir}
              />
            </div>

            {/* Description */}
            <div style={st.fieldGroup}>
              <label style={{ ...st.label, textAlign: align }}>{t('signup_description')}</label>
              <textarea
                style={{ ...st.input, height: '72px', resize: 'vertical', paddingTop: '10px' }}
                value={form.description_ar}
                onChange={(e) => setForm((f) => ({ ...f, description_ar: e.target.value }))}
                placeholder={t('signup_description_placeholder')}
                dir={dir}
              />
            </div>

            {error && <p style={{ ...st.error, textAlign: align }}>{error}</p>}
            <button style={st.btn} onClick={handleSubmitDetails} disabled={loading}>
              {loading ? t('auth_sending') : t('signup_submit')}
            </button>
            <p style={{ fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#9CA3AF', textAlign: 'center', marginTop: '12px' }}>
              {t('signup_review_note')}
            </p>
          </>
        )}

        {/* ── Step 4: Submitted ── */}
        {step === 'submitted' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={st.successIcon}>&#x2705;</div>
            <h2 style={st.successTitle}>{t('signup_success_title')}</h2>
            <p style={st.successBody}>{t('signup_success_body')}</p>
            <button style={{ ...st.btn, marginTop: '24px' }} onClick={() => router.push('/')}>
              {t('signup_go_dashboard')}
            </button>
            <button style={st.ghostBtn} onClick={() => router.push('/login')}>
              {t('signup_logout')}
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
    fontWeight: 600, color: '#0F2044', marginBottom: '6px',
  },
  sentTo: { fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#6B7280', marginBottom: '14px' },
  input: {
    width: '100%', padding: '13px 14px', border: '1.5px solid #E5E7EB', borderRadius: '10px',
    fontFamily: 'Cairo, sans-serif', fontSize: '16px', color: '#0F2044',
    outline: 'none', boxSizing: 'border-box', marginBottom: '6px',
  },
  fieldGroup: { marginBottom: '14px' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  chip: {
    padding: '8px 16px', borderRadius: '20px', border: '1.5px solid #E5E7EB',
    background: '#F9FAFB', fontFamily: 'Cairo, sans-serif', fontSize: '13px',
    fontWeight: 600, color: '#6B7280', cursor: 'pointer',
  },
  chipActive: { background: '#0F2044', borderColor: '#0F2044', color: '#fff' },
  error: {
    fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#D32F2F',
    marginBottom: '8px', marginTop: '2px',
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
  langToggle: {
    background: 'none', border: '1px solid #E5E7EB', borderRadius: '8px',
    padding: '6px 14px', fontFamily: 'Cairo, sans-serif', fontSize: '13px',
    color: '#0F2044', cursor: 'pointer',
  },
};
