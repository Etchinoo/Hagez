// ============================================================
// SUPER RESERVATION PLATFORM — Business Login Page
// ============================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardAuth } from '@/store/auth';
import { authApi } from '@/services/api';
import { getLoginRedirect } from '@/lib/rbac';
import Link from 'next/link';

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
    if (!phone.trim()) {
      setError('يرجى إدخال رقم الهاتف.');
      return;
    }
    if (!/^\+\d{10,15}$/.test(phone.trim())) {
      setError('رقم الهاتف غير صحيح. مثال: +201000000001');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authApi.requestOtp(phone.trim());
      setStep('otp');
    } catch {
      setError('فشل إرسال الكود. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      setError('يرجى إدخال كود التحقق.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(phone, otp);
      // RBAC: redirect to the correct zone based on the verified role
      const authStore = (await import('@/store/auth')).useDashboardAuth.getState();
      const role = authStore.user?.role ?? 'consumer';
      const destination = getLoginRedirect(role);
      if (!destination) {
        // Consumer account — not allowed in any dashboard zone
        authStore.logout();
        setError('هذا الحساب غير مرتبط بنشاط تجاري. تواصل مع فريق Hagez.');
        setStep('phone');
      } else {
        router.replace(destination);
      }
    } catch {
      setError('الكود غير صحيح أو منتهي الصلاحية.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoBlock}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Hagez" style={{ width: '100%', height: 'auto', marginBottom: '8px' }} />
          <h1 style={styles.title}>لوحة تحكم الأعمال</h1>
        </div>

        {step === 'phone' ? (
          <>
            <label style={styles.label}>رقم الهاتف</label>
            <input
              style={styles.input}
              type="tel"
              name="phone"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRequestOtp()}
              placeholder="+201XXXXXXXXX"
              dir="ltr"
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
              maxLength={4}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
              placeholder="1111"
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

        {step === 'phone' && (
          <p style={styles.signupRow}>
            نشاط تجاري جديد؟{' '}
            <Link href="/signup" style={styles.signupLink}>سجّل هنا</Link>
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
  signupRow: {
    fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#6B7280',
    textAlign: 'center', marginTop: '20px',
  },
  signupLink: { color: '#1B8A7A', fontWeight: 700, textDecoration: 'none' },
};
