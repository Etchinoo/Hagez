// ============================================================
// SUPER RESERVATION PLATFORM — Onboarding Checklist (US-062)
// 5-step first-login guide.
// - Completed steps persisted in localStorage (survives refresh).
// - Dismiss is session-only (reappears on next login until done).
// - Hides automatically when all steps are marked done.
// - Bilingual AR/EN with RTL/LTR direction.
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/i18n';
import { getCompletedSteps, ONBOARDING_STEPS_KEY } from '@/lib/onboardingUtils';

const STEPS_AR = [
  { id: 'profile',   icon: '🏪', label: 'أكمل بيانات المحل',      desc: 'اسم المحل، الوصف، الصور',               href: '/settings' },
  { id: 'hours',     icon: '🕐', label: 'حدد أوقات العمل',         desc: 'أيام وساعات عملك ومدة كل حجز',           href: '/settings' },
  { id: 'deposit',   icon: '💳', label: 'اضبط سياسة العربون',      desc: 'مبلغ العربون وشروط الإلغاء',             href: '/settings' },
  { id: 'staff',     icon: '👤', label: 'أضف موظفيك',               desc: 'الموظفون يظهرون لعملائك عند الحجز',      href: '/staff' },
  { id: 'firstslot', icon: '✅', label: 'أنشئ أول موعد',            desc: 'اعتمد الإعدادات لإنشاء مواعيد تلقائياً', href: '/settings' },
];

const STEPS_EN = [
  { id: 'profile',   icon: '🏪', label: 'Complete business info',    desc: 'Name, description, photos',              href: '/settings' },
  { id: 'hours',     icon: '🕐', label: 'Set working hours',          desc: 'Days, hours & slot duration',             href: '/settings' },
  { id: 'deposit',   icon: '💳', label: 'Set deposit policy',         desc: 'Deposit amount & cancellation terms',     href: '/settings' },
  { id: 'staff',     icon: '👤', label: 'Add your staff',             desc: 'Staff appear to customers on booking',    href: '/staff' },
  { id: 'firstslot', icon: '✅', label: 'Create your first slot',     desc: 'Save settings to generate slots automatically', href: '/settings' },
];

const COPY = {
  ar: {
    welcome:   'مرحباً بك في Hagez 🎉',
    subtitle:  'أكمل الخطوات التالية لتفعيل حجوزاتك',
    progress:  (done: number, total: number) => `${done} من ${total} خطوات مكتملة`,
    dismiss:   'إخفاء',
    arrow:     '←',
  },
  en: {
    welcome:   'Welcome to Hagez 🎉',
    subtitle:  'Complete the steps below to activate your bookings',
    progress:  (done: number, total: number) => `${done} of ${total} steps complete`,
    dismiss:   'Dismiss',
    arrow:     '→',
  },
};

export default function OnboardingChecklist() {
  const router = useRouter();
  const { dir, lang } = useLang();
  const c = COPY[lang];
  const STEPS = lang === 'ar' ? STEPS_AR : STEPS_EN;

  // Dismiss is session-only — resets on next page load/login
  const [dismissed, setDismissed] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);

  // Load completed steps from localStorage on mount
  useEffect(() => {
    setCompleted(getCompletedSteps());
  }, []);

  // Listen for markOnboardingStep() calls from other pages/tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === ONBOARDING_STEPS_KEY && e.newValue) {
        try { setCompleted(JSON.parse(e.newValue)); } catch { /* ignore */ }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const allDone = STEPS.every((s) => completed.includes(s.id));
  if (dismissed || allDone) return null;

  const doneCount = STEPS.filter((s) => completed.includes(s.id)).length;
  const pct = Math.round((doneCount / STEPS.length) * 100);

  return (
    <div style={{ ...styles.container, direction: dir }}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.dismissBtn} onClick={() => setDismissed(true)} title={c.dismiss}>✕</button>
        <div style={{ flex: 1 }}>
          <div style={styles.title}>{c.welcome}</div>
          <div style={styles.subtitle}>{c.subtitle}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={styles.progressWrap}>
        <div style={{ ...styles.progressBar, width: `${pct}%` }} />
      </div>
      <div style={styles.progressLabel}>{c.progress(doneCount, STEPS.length)}</div>

      {/* Steps */}
      <div style={styles.steps}>
        {STEPS.map((step) => {
          const done = completed.includes(step.id);
          return (
            <div
              key={step.id}
              style={{ ...styles.step, ...(done ? styles.stepDone : {}) }}
              onClick={() => { if (!done) router.push(step.href); }}
            >
              <div style={{ ...styles.stepIcon, ...(done ? styles.stepIconDone : {}) }}>
                {done ? '✓' : step.icon}
              </div>
              <div style={styles.stepContent}>
                <div style={{ ...styles.stepLabel, ...(done ? styles.stepLabelDone : {}) }}>{step.label}</div>
                <div style={styles.stepDesc}>{step.desc}</div>
              </div>
              {!done && <div style={styles.stepArrow}>{c.arrow}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#fff', borderRadius: '16px', padding: '20px 24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: '20px',
    border: '1.5px solid #E8F5F3',
  },
  header: { display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' },
  dismissBtn: { background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '16px', padding: '0', marginTop: '2px' },
  title: { fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '17px', color: '#0F2044' },
  subtitle: { fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#6B7280', marginTop: '2px' },
  progressWrap: { background: '#E5E7EB', borderRadius: '4px', height: '6px', overflow: 'hidden', marginBottom: '6px' },
  progressBar: { background: '#1B8A7A', height: '100%', borderRadius: '4px', transition: 'width 0.4s' },
  progressLabel: { fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#9CA3AF', marginBottom: '16px' },
  steps: { display: 'flex', flexDirection: 'column', gap: '8px' },
  step: {
    display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 14px',
    borderRadius: '10px', cursor: 'pointer', background: '#F7F8FA',
    border: '1.5px solid transparent', transition: 'all 0.15s',
  },
  stepDone: { background: '#F0FBF9', border: '1.5px solid #D1FAE5', cursor: 'default' },
  stepIcon: {
    width: '40px', height: '40px', borderRadius: '50%', background: '#E5E7EB',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '18px', flexShrink: 0,
  },
  stepIconDone: { background: '#1B8A7A', color: '#fff', fontSize: '16px', fontWeight: 700 },
  stepContent: { flex: 1 },
  stepLabel: { fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '14px', color: '#0F2044' },
  stepLabelDone: { color: '#1B8A7A' },
  stepDesc: { fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#9CA3AF', marginTop: '2px' },
  stepArrow: { color: '#1B8A7A', fontWeight: 700, fontSize: '16px' },
};
