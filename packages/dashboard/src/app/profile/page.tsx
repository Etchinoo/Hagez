// ============================================================
// SUPER RESERVATION PLATFORM — Business Profile Page
// Business name, descriptions, category (editable), district,
// owner name, subscription plan & plan-change requests.
// RTL/LTR bilingual.
// ============================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { businessApi } from '@/services/api';
import { useDashboardAuth } from '@/store/auth';
import { useLang } from '@/lib/i18n';
import { useToast } from '@/components/Toast';
import DashboardShell from '@/components/DashboardShell';

// ── All supported categories ─────────────────────────────────
const CATEGORIES: { value: string; icon: string; ar: string; en: string }[] = [
  { value: 'restaurant',  icon: '🍽️', ar: 'مطعم',            en: 'Restaurant'    },
  { value: 'salon',       icon: '✂️', ar: 'صالون تجميل',     en: 'Beauty Salon'  },
  { value: 'court',       icon: '⚽', ar: 'ملعب رياضي',      en: 'Sports Court'  },
  { value: 'gaming_cafe', icon: '🎮', ar: 'كافيه جيمنج',     en: 'Gaming Cafe'   },
  { value: 'car_wash',    icon: '🚗', ar: 'غسيل سيارات',     en: 'Car Wash'      },
  { value: 'medical',     icon: '🏥', ar: 'عيادة طبية',      en: 'Medical Clinic'},
];

const PLAN_ORDER = ['free', 'starter', 'growth', 'pro', 'enterprise'];

const PLAN_PERKS: Record<string, { bookings: string; branches: number; color: string }> = {
  free:       { bookings: '50',        branches: 1,  color: '#6B7280' },
  starter:    { bookings: '200',       branches: 1,  color: '#1B8A7A' },
  growth:     { bookings: '1,000',     branches: 3,  color: '#0057FF' },
  pro:        { bookings: '5,000',     branches: 5,  color: '#7C3AED' },
  enterprise: { bookings: 'unlimited', branches: 10, color: '#D97706' },
};

const COPY = {
  ar: {
    title:          'الملف الشخصي',
    subtitle:       'بيانات نشاطك التجاري وإعدادات الحساب',
    saveBtn:        'حفظ التغييرات',
    saving:         'جاري الحفظ...',
    savedOk:        'تم الحفظ بنجاح',
    savedErr:       'فشل الحفظ. حاول مرة أخرى.',
    secBusiness:    'بيانات النشاط التجاري',
    secOwner:       'بيانات المالك',
    secPlan:        'باقة الاشتراك',
    lblNameAr:      'الاسم بالعربية *',
    lblNameEn:      'الاسم بالإنجليزية',
    lblDescAr:      'وصف النشاط (عربي)',
    lblDescEn:      'وصف النشاط (إنجليزي)',
    lblCategory:    'فئة النشاط',
    lblDistrict:    'الحي / المنطقة',
    phNameAr:       'مثال: مطعم النيل الذهبي',
    phNameEn:       'e.g. Golden Nile Restaurant',
    phDescAr:       'وصف مختصر يراه العملاء...',
    phDescEn:       'A short description visible to customers...',
    phDistrict:     'مثال: الزمالك',
    lblOwnerName:   'الاسم الكامل',
    lblOwnerPhone:  'رقم الجوال (للتسجيل)',
    phOwnerName:    'مثال: أحمد محمد',
    currentPlan:    'الباقة الحالية',
    planFree:       'مجاني',
    planStarter:    'Starter',
    planGrowth:     'Growth',
    planPro:        'Pro',
    planEnterprise: 'Enterprise',
    upgradeBtn:     'طلب ترقية',
    downgradeBtn:   'طلب تخفيض',
    cancelBtn:      'إلغاء الاشتراك',
    planRequestSent:'تم إرسال طلبك. سيتواصل معك فريق Hagez قريباً.',
    planRequestFail:'فشل إرسال الطلب. حاول مجدداً.',
    confirmCancel:  'هل أنت متأكد من رغبتك في إلغاء اشتراكك؟',
    perkBookings:   'حجوزات / شهر',
    perkUnlimited:  'غير محدود',
    perkBranches:   'فرع',
    loading:        'جاري التحميل...',
  },
  en: {
    title:          'Profile',
    subtitle:       'Your business information and account settings',
    saveBtn:        'Save changes',
    saving:         'Saving...',
    savedOk:        'Saved successfully',
    savedErr:       'Save failed. Please try again.',
    secBusiness:    'Business details',
    secOwner:       'Owner details',
    secPlan:        'Subscription plan',
    lblNameAr:      'Name (Arabic) *',
    lblNameEn:      'Name (English)',
    lblDescAr:      'Description (Arabic)',
    lblDescEn:      'Description (English)',
    lblCategory:    'Business category',
    lblDistrict:    'District / Area',
    phNameAr:       'e.g. مطعم النيل الذهبي',
    phNameEn:       'e.g. Golden Nile Restaurant',
    phDescAr:       'Short description visible to customers...',
    phDescEn:       'A short description visible to customers...',
    phDistrict:     'e.g. Zamalek',
    lblOwnerName:   'Full name',
    lblOwnerPhone:  'Login phone number',
    phOwnerName:    'e.g. Ahmed Mohamed',
    currentPlan:    'Current plan',
    planFree:       'Free',
    planStarter:    'Starter',
    planGrowth:     'Growth',
    planPro:        'Pro',
    planEnterprise: 'Enterprise',
    upgradeBtn:     'Request upgrade',
    downgradeBtn:   'Request downgrade',
    cancelBtn:      'Cancel subscription',
    planRequestSent:'Your request has been sent. The Hagez team will contact you soon.',
    planRequestFail:'Request failed. Please try again.',
    confirmCancel:  'Are you sure you want to cancel your subscription?',
    perkBookings:   'bookings/mo',
    perkUnlimited:  'Unlimited',
    perkBranches:   'branch',
    loading:        'Loading...',
  },
};

const PLAN_LABEL_KEY: Record<string, keyof typeof COPY.ar> = {
  free:       'planFree',
  starter:    'planStarter',
  growth:     'planGrowth',
  pro:        'planPro',
  enterprise: 'planEnterprise',
};

export default function ProfilePageWrapper() {
  return (
    <DashboardShell pageTitle="page_profile">
      <ProfilePage />
    </DashboardShell>
  );
}

function ProfilePage() {
  const { dir, lang } = useLang();
  const c = COPY[lang];
  const { user, patchUser } = useDashboardAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [bizForm, setBizForm] = useState({
    name_ar: '', name_en: '', description_ar: '', description_en: '',
    district: '', category: '',
  });
  const [ownerName, setOwnerName] = useState('');
  const [planChanging, setPlanChanging] = useState(false);
  const formInitialized = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ['business-profile'],
    queryFn: () => businessApi.getProfile().then((r) => r.data),
  });

  // Initialise the form exactly once from the server data.
  // Subsequent refetches (triggered by invalidateQueries after save)
  // must NOT overwrite the user's current edits.
  useEffect(() => {
    if (!data || formInitialized.current) return;
    formInitialized.current = true;
    const b = data.business ?? {};
    setBizForm({
      name_ar:        b.name_ar        ?? '',
      name_en:        b.name_en        ?? '',
      description_ar: b.description_ar ?? '',
      description_en: b.description_en ?? '',
      district:       b.district       ?? '',
      category:       b.category       ?? '',
    });
    setOwnerName(data.owner?.full_name ?? user?.full_name ?? '');
  }, [data, user]);

  const saveBizMutation = useMutation({
    mutationFn: () => businessApi.updateProfile(bizForm),
    onSuccess: (res) => {
      toast.success(c.savedOk);
      // Update the cache directly with the server response — no refetch,
      // so the form is never reset mid-session, but the next visit loads
      // correct data from cache.
      const saved = res.data?.business;
      qc.setQueryData(['business-profile'], (old: any) => ({
        ...old,
        business: saved ?? { ...(old?.business ?? {}), ...bizForm },
      }));
      // Sync category into auth store so settings page + nav update immediately
      if (bizForm.category) patchUser({ business_category: bizForm.category });
    },
    onError: () => toast.error(c.savedErr),
  });

  const saveOwnerMutation = useMutation({
    mutationFn: () => businessApi.updateOwnerName(ownerName),
    onSuccess: (res) => {
      toast.success(c.savedOk);
      const savedOwner = res.data?.owner;
      qc.setQueryData(['business-profile'], (old: any) => ({
        ...old,
        owner: savedOwner ?? { ...(old?.owner ?? {}), full_name: ownerName },
      }));
      if (ownerName) patchUser({ full_name: ownerName });
    },
    onError: () => toast.error(c.savedErr),
  });

  const requestPlan = async (action: 'upgrade' | 'downgrade' | 'cancel', target_tier?: string) => {
    if (action === 'cancel' && !window.confirm(c.confirmCancel)) return;
    setPlanChanging(true);
    try {
      await businessApi.requestPlanChange({ action, target_tier });
      toast.success(c.planRequestSent);
    } catch {
      toast.error(c.planRequestFail);
    } finally {
      setPlanChanging(false);
    }
  };

  const planTier  = (data?.business?.subscription_tier ?? 'free') as string;
  const planPerks = PLAN_PERKS[planTier] ?? PLAN_PERKS.free;
  const planIdx   = PLAN_ORDER.indexOf(planTier);
  const saving    = saveBizMutation.isPending || saveOwnerMutation.isPending;

  if (isLoading) {
    return <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontFamily: 'Cairo, sans-serif' }}>{c.loading}</div>;
  }

  return (
    <div style={{ padding: '24px', fontFamily: 'Cairo, sans-serif', direction: dir, maxWidth: '860px', margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F2044', margin: 0 }}>{c.title}</h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0' }}>{c.subtitle}</p>
      </div>

      {/* ── Business Details ─────────────────────────────── */}
      <Section title={c.secBusiness}>
        <TwoCol>
          <Field label={c.lblNameAr}>
            <input style={inp} value={bizForm.name_ar} dir="rtl"
              onChange={(e) => setBizForm((f) => ({ ...f, name_ar: e.target.value }))}
              placeholder={c.phNameAr} />
          </Field>
          <Field label={c.lblNameEn}>
            <input style={{ ...inp, direction: 'ltr' }} value={bizForm.name_en} dir="ltr"
              onChange={(e) => setBizForm((f) => ({ ...f, name_en: e.target.value }))}
              placeholder={c.phNameEn} />
          </Field>
        </TwoCol>

        <Field label={c.lblDescAr}>
          <textarea style={{ ...inp, height: 80, resize: 'vertical' as const }} dir="rtl"
            value={bizForm.description_ar}
            onChange={(e) => setBizForm((f) => ({ ...f, description_ar: e.target.value }))}
            placeholder={c.phDescAr} />
        </Field>
        <Field label={c.lblDescEn}>
          <textarea style={{ ...inp, height: 80, resize: 'vertical' as const, direction: 'ltr' }} dir="ltr"
            value={bizForm.description_en}
            onChange={(e) => setBizForm((f) => ({ ...f, description_en: e.target.value }))}
            placeholder={c.phDescEn} />
        </Field>

        <Field label={c.lblDistrict}>
          <input style={inp} value={bizForm.district}
            onChange={(e) => setBizForm((f) => ({ ...f, district: e.target.value }))}
            placeholder={c.phDistrict} />
        </Field>

        {/* Category selector — all categories */}
        <Field label={c.lblCategory}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {CATEGORIES.map((cat) => {
              const selected = bizForm.category === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setBizForm((f) => ({ ...f, category: cat.value }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 20, cursor: 'pointer',
                    fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 600,
                    border: `1.5px solid ${selected ? '#1B8A7A' : '#E5E7EB'}`,
                    background: selected ? '#E8F5F3' : '#fff',
                    color: selected ? '#1B8A7A' : '#6B7280',
                    transition: 'all 0.15s',
                  }}
                >
                  <span>{cat.icon}</span>
                  <span>{lang === 'ar' ? cat.ar : cat.en}</span>
                </button>
              );
            })}
          </div>
        </Field>

        <div style={{ marginTop: 16 }}>
          <button style={saveBtn(saving)} disabled={saving} onClick={() => saveBizMutation.mutate()}>
            {saveBizMutation.isPending ? c.saving : c.saveBtn}
          </button>
        </div>
      </Section>

      {/* ── Owner Details ────────────────────────────────── */}
      <Section title={c.secOwner}>
        <TwoCol>
          <Field label={c.lblOwnerName}>
            <input style={inp} value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder={c.phOwnerName} />
          </Field>
          <Field label={c.lblOwnerPhone}>
            <input style={{ ...inp, direction: 'ltr', color: '#6B7280' }}
              value={user?.phone ?? data?.owner?.phone ?? ''} readOnly />
          </Field>
        </TwoCol>
        <div style={{ marginTop: 16 }}>
          <button style={saveBtn(saveOwnerMutation.isPending)} disabled={saveOwnerMutation.isPending}
            onClick={() => saveOwnerMutation.mutate()}>
            {saveOwnerMutation.isPending ? c.saving : c.saveBtn}
          </button>
        </div>
      </Section>

      {/* ── Subscription Plan ────────────────────────────── */}
      <Section title={c.secPlan}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: '#6B7280' }}>{c.currentPlan}:</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: planPerks.color, background: planPerks.color + '18', padding: '4px 16px', borderRadius: 20 }}>
            {c[PLAN_LABEL_KEY[planTier]] as string}
          </div>
        </div>

        {/* Plan comparison grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, marginBottom: 24 }}>
          {PLAN_ORDER.map((plan) => {
            const perks = PLAN_PERKS[plan];
            const isCurrent = plan === planTier;
            return (
              <div key={plan} style={{
                borderRadius: 12, padding: '14px 10px', textAlign: 'center',
                border: `2px solid ${isCurrent ? perks.color : '#E5E7EB'}`,
                background: isCurrent ? perks.color + '12' : '#FAFAFA',
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: perks.color, marginBottom: 6 }}>
                  {c[PLAN_LABEL_KEY[plan]] as string}
                </div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>
                  {plan === 'enterprise' ? c.perkUnlimited : perks.bookings} {c.perkBookings}
                </div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                  {perks.branches} {c.perkBranches}
                </div>
                {isCurrent && <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: perks.color }}>✓</div>}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {planIdx < PLAN_ORDER.length - 1 && (
            <button style={{ ...saveBtn(planChanging), background: '#0057FF' }}
              disabled={planChanging}
              onClick={() => requestPlan('upgrade', PLAN_ORDER[planIdx + 1])}>
              {c.upgradeBtn}
            </button>
          )}
          {planIdx > 0 && (
            <button style={{ ...saveBtn(planChanging), background: '#6B7280' }}
              disabled={planChanging}
              onClick={() => requestPlan('downgrade', PLAN_ORDER[planIdx - 1])}>
              {c.downgradeBtn}
            </button>
          )}
          {planTier !== 'free' && (
            <button style={{ ...saveBtn(planChanging), background: '#DC2626' }}
              disabled={planChanging}
              onClick={() => requestPlan('cancel')}>
              {c.cancelBtn}
            </button>
          )}
        </div>
      </Section>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', marginBottom: 16, border: '1px solid #F0F0F0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F2044', margin: '0 0 18px' }}>{title}</h2>
      {children}
    </div>
  );
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB',
  borderRadius: 8, fontFamily: 'Cairo, sans-serif', fontSize: 14,
  color: '#0F2044', boxSizing: 'border-box',
};

const saveBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '10px 24px', background: '#1B8A7A', border: 'none',
  borderRadius: 10, fontFamily: 'Cairo, sans-serif', fontSize: 14,
  fontWeight: 700, color: '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.7 : 1,
});
