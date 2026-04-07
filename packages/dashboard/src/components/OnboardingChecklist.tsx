// ============================================================
// SUPER RESERVATION PLATFORM — Onboarding Checklist (US-062)
// 5-step first-login guide. Dismisses after all steps done
// or after the user explicitly closes it.
// Persisted in localStorage so it survives refreshes.
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const STORAGE_KEY = 'reservr_onboarding_dismissed';

const STEPS = [
  { id: 'profile',   icon: '🏪', label: 'أكمل بيانات المحل',      desc: 'اسم المحل، الوصف، الصور',              href: '/settings' },
  { id: 'hours',     icon: '🕐', label: 'حدد أوقات العمل',         desc: 'أيام وساعات عملك ومدة كل حجز',          href: '/settings' },
  { id: 'deposit',   icon: '💳', label: 'اضبط سياسة العربون',      desc: 'مبلغ العربون وشروط الإلغاء',            href: '/settings' },
  { id: 'staff',     icon: '👤', label: 'أضف موظفيك',               desc: 'الموظفون يظهرون لعملائك عند الحجز',     href: '/staff' },
  { id: 'firstslot', icon: '✅', label: 'أنشئ أول موعد',            desc: 'اعتمد الإعدادات لإنشاء مواعيد تلقائياً', href: '/settings' },
];

export default function OnboardingChecklist({ completedSteps = [] }: { completedSteps?: string[] }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [completed, setCompleted] = useState<string[]>(completedSteps);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDismissed(localStorage.getItem(STORAGE_KEY) === 'true');
    }
  }, []);

  const allDone = STEPS.every((s) => completed.includes(s.id));

  const dismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
  };

  const markDone = (id: string) => {
    setCompleted((c) => c.includes(id) ? c : [...c, id]);
  };

  if (dismissed || allDone) return null;

  const doneCount = STEPS.filter((s) => completed.includes(s.id)).length;
  const pct = Math.round((doneCount / STEPS.length) * 100);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.dismissBtn} onClick={dismiss} title="إخفاء">✕</button>
        <div style={{ flex: 1 }}>
          <div style={styles.title}>مرحباً بك في Super Reservation 🎉</div>
          <div style={styles.subtitle}>أكمل الخطوات التالية لتفعيل حجوزاتك</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={styles.progressWrap}>
        <div style={{ ...styles.progressBar, width: `${pct}%` }} />
      </div>
      <div style={styles.progressLabel}>{doneCount} من {STEPS.length} خطوات مكتملة</div>

      {/* Steps */}
      <div style={styles.steps}>
        {STEPS.map((step) => {
          const done = completed.includes(step.id);
          return (
            <div
              key={step.id}
              style={{ ...styles.step, ...(done ? styles.stepDone : {}) }}
              onClick={() => { if (!done) { markDone(step.id); router.push(step.href); } }}
            >
              <div style={{ ...styles.stepIcon, ...(done ? styles.stepIconDone : {}) }}>
                {done ? '✓' : step.icon}
              </div>
              <div style={styles.stepContent}>
                <div style={{ ...styles.stepLabel, ...(done ? styles.stepLabelDone : {}) }}>{step.label}</div>
                <div style={styles.stepDesc}>{step.desc}</div>
              </div>
              {!done && <div style={styles.stepArrow}>←</div>}
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
    direction: 'rtl', border: '1.5px solid #E8F5F3',
  },
  header: { display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' },
  dismissBtn: { background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '16px', padding: '0', marginTop: '2px' },
  title: { fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '17px', color: '#0F2044' },
  subtitle: { fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#6B7280', marginTop: '2px' },
  progressWrap: { background: '#E5E7EB', borderRadius: '4px', height: '6px', overflow: 'hidden', marginBottom: '6px' },
  progressBar: { background: '#1B8A7A', height: '100%', borderRadius: '4px', transition: 'width 0.4s' },
  progressLabel: { fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#9CA3AF', marginBottom: '16px', textAlign: 'right' },
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
