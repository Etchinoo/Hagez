// ============================================================
// SUPER RESERVATION PLATFORM — Business Login Page
// ============================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardAuth } from '@/store/auth';
import { authApi } from '@/services/api';

type Step = 'phone' | 'otp';

export default function BusinessLoginPage() {
  const router = useRouter();
  const login = useDashboardAuth((s) => s.loginWithOtp);
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestOtp = async () => {
    setLoading(true);
    setError('');
    try {
      await authApi.requestOtp(phone);
      setStep('otp');
    } catch {
      setError('فشل إرسال الكود. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    setError('');
    try {
      await login(phone, otp);
      router.replace('/');
    } catch {
      setError('الكود غير صحيح أو منتهي الصلاحية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoBlock}>
          <div style={styles.logo} />
          <h1 style={styles.title}>لوحة تحكم الأعمال</h1>
          <p style={styles.subtitle}>سوبر ريزرفيشن</p>
        </div>

        {step === 'phone' ? (
          <>
            <label style={styles.label}>رقم الهاتف</label>
            <input
              style={styles.input}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+201XXXXXXXXX"
              dir="rtl"
              autoFocus
            />
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.button} onClick={handleRequestOtp} disabled={loading}>
              {loading ? 'جاري الإرسال...' : 'إرسال كود التحقق'}
            </button>
          </>
        ) : (
          <>
            <p style={styles.sentTo}>أرسلنا الكود إلى {phone}</p>
            <label style={styles.label}>كود التحقق</label>
            <input
              style={{ ...styles.input, textAlign: 'center', letterSpacing: '12px', fontSize: '24px' }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="000000"
              autoFocus
            />
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.button} onClick={handleVerifyOtp} disabled={loading}>
              {loading ? 'جاري التحقق...' : 'تأكيد الدخول'}
            </button>
            <button style={styles.linkButton} onClick={() => { setStep('phone'); setOtp(''); }}>
              تغيير رقم الهاتف
            </button>
          </>
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
  logo: { width: '64px', height: '64px', borderRadius: '16px', background: '#0F2044', margin: '0 auto 16px' },
  title: { fontFamily: 'Cairo, sans-serif', fontSize: '22px', fontWeight: 700, color: '#0F2044', margin: 0 },
  subtitle: { fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#6B7280', marginTop: '4px' },
  label: { display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: '15px', fontWeight: 600, color: '#0F2044', marginBottom: '8px', textAlign: 'right' },
  sentTo: { fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#6B7280', textAlign: 'right', marginBottom: '16px' },
  input: {
    width: '100%', padding: '14px 16px', border: '1.5px solid #E5E7EB', borderRadius: '12px',
    fontFamily: 'Cairo, sans-serif', fontSize: '18px', color: '#0F2044',
    outline: 'none', direction: 'rtl', boxSizing: 'border-box', marginBottom: '8px',
  },
  error: { fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#D32F2F', textAlign: 'right', marginBottom: '8px' },
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
};
