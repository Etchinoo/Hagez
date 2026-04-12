// ============================================================
// SUPER RESERVATION PLATFORM — Business Login Page
// ============================================================

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardAuth } from '@/store/auth';
import { authApi } from '@/services/api';
import { getLoginRedirect } from '@/lib/rbac';
import { useT, useLang } from '@/lib/i18n';
import { useLanguage } from '@/store/language';
import CountryCodeSelect, { buildFullPhone } from '@/components/CountryCodeSelect';
import Link from 'next/link';
import { signInWithPhoneNumber, RecaptchaVerifier, type ConfirmationResult } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';

type Step = 'phone' | 'otp';

export default function BusinessLoginPage() {
  const router = useRouter();
  const t = useT();
  const { dir, align } = useLang();
  const lang = useLanguage((s) => s.lang);
  const setLang = useLanguage((s) => s.setLang);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('20');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  const fullPhone = buildFullPhone(countryCode, phone);

  // Clean up recaptcha on unmount
  useEffect(() => {
    return () => {
      recaptchaVerifierRef.current?.clear();
    };
  }, []);

  const getRecaptchaVerifier = useCallback(() => {
    if (recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current.clear();
    }
    recaptchaVerifierRef.current = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
      size: 'invisible',
    });
    return recaptchaVerifierRef.current;
  }, []);

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
      const verifier = getRecaptchaVerifier();
      const result = await signInWithPhoneNumber(firebaseAuth, fullPhone, verifier);
      confirmationResultRef.current = result;
      setStep('otp');
    } catch {
      setError(t('auth_err_otp_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      setError(t('auth_err_otp_required'));
      return;
    }
    if (!confirmationResultRef.current) {
      setError(t('auth_err_otp_failed'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const credential = await confirmationResultRef.current.confirm(otp);
      const idToken = await credential.user.getIdToken();
      const res = await authApi.verifyFirebaseToken(idToken);
      const { access_token, refresh_token, user } = res.data;

      const setSession = useDashboardAuth.getState().setSession;
      setSession({ access_token, refresh_token }, user);

      const role = user?.role ?? 'consumer';
      const destination = getLoginRedirect(role);
      if (!destination) {
        useDashboardAuth.getState().logout();
        setError(t('auth_err_no_business'));
        setStep('phone');
      } else {
        router.replace(destination);
      }
    } catch {
      setError(t('auth_err_otp_invalid'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container} dir={dir}>
      <div id="recaptcha-container" />
      <div style={styles.card}>
        {/* Language toggle */}
        <div style={{ textAlign: dir === 'rtl' ? 'left' : 'right', marginBottom: '8px' }}>
          <button
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            style={styles.langToggle}
          >
            {t('auth_lang_toggle')}
          </button>
        </div>

        <div style={styles.logoBlock}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Hagez" style={{ width: '100%', height: 'auto', marginBottom: '8px' }} />
          <h1 style={styles.title}>{t('auth_business_dashboard')}</h1>
        </div>

        {step === 'phone' ? (
          <>
            <label style={{ ...styles.label, textAlign: align }}>{t('auth_phone_label')}</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', direction: 'ltr' }}>
              <CountryCodeSelect value={countryCode} onChange={setCountryCode} />
              <input
                style={{ ...styles.input, flex: 1, marginBottom: 0 }}
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
            {error && <p style={{ ...styles.error, textAlign: align }}>{error}</p>}
            <button style={styles.button} onClick={handleRequestOtp} disabled={loading}>
              {loading ? t('auth_sending') : t('auth_send_otp')}
            </button>
          </>
        ) : (
          <>
            <p style={{ ...styles.sentTo, textAlign: align }}>
              {t('auth_otp_sent_to')} {fullPhone}
            </p>
            <label style={{ ...styles.label, textAlign: align }}>{t('auth_otp_label')}</label>
            <input
              style={{ ...styles.input, textAlign: 'center', letterSpacing: '12px', fontSize: '24px' }}
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
              placeholder="1111"
              autoFocus
            />
            {error && <p style={{ ...styles.error, textAlign: align }}>{error}</p>}
            <button style={styles.button} onClick={handleVerifyOtp} disabled={loading}>
              {loading ? t('auth_verifying') : t('auth_confirm_login')}
            </button>
            <button style={styles.linkButton} onClick={() => { setStep('phone'); setOtp(''); }}>
              {t('auth_change_phone')}
            </button>
          </>
        )}

        {step === 'phone' && (
          <p style={styles.signupRow}>
            {t('auth_new_business')}{' '}
            <Link href="/signup" style={styles.signupLink}>{t('auth_signup_here')}</Link>
          </p>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #0F2044 0%, #1B8A7A 100%)',
    padding: '24px',
  },
  card: {
    background: '#fff', borderRadius: '20px', padding: '48px 40px',
    width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  logoBlock: { textAlign: 'center', marginBottom: '32px' },
  title: { fontFamily: 'Cairo, sans-serif', fontSize: '22px', fontWeight: 700, color: '#0F2044', margin: 0 },
  label: { display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: '15px', fontWeight: 600, color: '#0F2044', marginBottom: '8px' },
  sentTo: { fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#6B7280', marginBottom: '16px' },
  input: {
    width: '100%', padding: '14px 16px', border: '1.5px solid #E5E7EB', borderRadius: '12px',
    fontFamily: 'Cairo, sans-serif', fontSize: '18px', color: '#0F2044',
    outline: 'none', boxSizing: 'border-box', marginBottom: '8px',
  },
  error: { fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#D32F2F', marginBottom: '8px' },
  button: {
    width: '100%', padding: '16px', background: '#1B8A7A', border: 'none', borderRadius: '12px',
    fontFamily: 'Cairo, sans-serif', fontSize: '17px', fontWeight: 700, color: '#fff',
    cursor: 'pointer', marginTop: '8px',
  },
  linkButton: {
    width: '100%', padding: '12px', background: 'none', border: 'none',
    fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#1B8A7A',
    cursor: 'pointer', marginTop: '8px',
  },
  signupRow: {
    fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#6B7280',
    textAlign: 'center', marginTop: '20px',
  },
  signupLink: { color: '#1B8A7A', fontWeight: 700, textDecoration: 'none' },
  langToggle: {
    background: 'none', border: '1px solid #E5E7EB', borderRadius: '8px',
    padding: '6px 14px', fontFamily: 'Cairo, sans-serif', fontSize: '13px',
    color: '#0F2044', cursor: 'pointer',
  },
};
