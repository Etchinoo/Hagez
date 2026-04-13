// ============================================================
// SUPER RESERVATION PLATFORM — Staff Management Page (US-057)
// Category-aware: salon shows specialisations, restaurant/cafe
// shows role selector. All categories support service assignment.
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffApi, servicesApi } from '@/services/api';
import { markOnboardingStep } from '@/lib/onboardingUtils';
import { useLang } from '@/lib/i18n';
import { useDashboardAuth } from '@/store/auth';
import DashboardShell from '@/components/DashboardShell';

// ── Salon specialisations ────────────────────────────────────
const SALON_SPECS: Record<string, { ar: string; en: string }> = {
  haircut:   { ar: 'قص شعر',      en: 'Haircut'        },
  colour:    { ar: 'صبغ شعر',     en: 'Hair Colour'    },
  treatment: { ar: 'علاج شعر',    en: 'Hair Treatment' },
  blowdry:   { ar: 'سشوار',       en: 'Blow Dry'       },
  beard:     { ar: 'لحية',        en: 'Beard'          },
  facial:    { ar: 'عناية بالوجه',en: 'Facial'         },
  nails:     { ar: 'مناكير',      en: 'Nails'          },
  makeup:    { ar: 'مكياج',       en: 'Makeup'         },
};

// ── Restaurant / Café roles ──────────────────────────────────
const RESTO_ROLES: Record<string, { ar: string; en: string }> = {
  waiter:   { ar: 'نادل',         en: 'Waiter'        },
  host:     { ar: 'مضيف',         en: 'Host'          },
  manager:  { ar: 'مدير',         en: 'Manager'       },
  chef:     { ar: 'طباخ',         en: 'Chef'          },
  cashier:  { ar: 'كاشير',        en: 'Cashier'       },
};

// ── Gaming Cafe roles ────────────────────────────────────────
const GAMING_ROLES: Record<string, { ar: string; en: string }> = {
  station_tech: { ar: 'فني محطات',  en: 'Station Tech'  },
  floor_staff:  { ar: 'موظف أرضي',  en: 'Floor Staff'   },
  manager:      { ar: 'مدير',       en: 'Manager'       },
  cashier:      { ar: 'كاشير',      en: 'Cashier'       },
};

const OWNER_LABEL = { ar: 'المالك', en: 'Owner' };

const COPY = {
  ar: {
    title:        'إدارة الموظفين',
    subtitle:     'إضافة وتعديل وتعطيل الموظفين في نشاطك التجاري',
    addBtn:       '+ إضافة موظف',
    formNew:      'موظف جديد',
    formEdit:     'تعديل الموظف',
    lblNameAr:    'الاسم بالعربية *',
    lblNameEn:    'الاسم بالإنجليزية',
    lblRole:      'الدور الوظيفي',
    lblSpecs:     'التخصصات',
    lblServices:  'الخدمات المسندة',
    servicesHint: 'اختر الخدمات التي يقدمها هذا الموظف',
    phNameAr:     'مثال: أحمد محمد',
    phNameEn:     'Ahmed Mohamed',
    cancel:       'إلغاء',
    save:         'إضافة الموظف',
    saveEdit:     'حفظ التعديلات',
    loading:      'جاري التحميل...',
    inactiveHdr:  'موظفون معطّلون',
    edit:         'تعديل',
    deactivate:   'تعطيل',
    reactivate:   'إعادة تفعيل',
    role:         'الدور',
    specs:        'التخصصات',
    services:     'الخدمات',
    noServices:   'لا توجد خدمات مضافة',
  },
  en: {
    title:        'Staff Management',
    subtitle:     'Add, edit, and deactivate staff members in your business',
    addBtn:       '+ Add staff member',
    formNew:      'New staff member',
    formEdit:     'Edit staff member',
    lblNameAr:    'Name (Arabic) *',
    lblNameEn:    'Name (English)',
    lblRole:      'Role',
    lblSpecs:     'Specialisations',
    lblServices:  'Assigned services',
    servicesHint: 'Select the services this staff member provides',
    phNameAr:     'e.g. Ahmed Mohamed',
    phNameEn:     'Ahmed Mohamed',
    cancel:       'Cancel',
    save:         'Add staff member',
    saveEdit:     'Save changes',
    loading:      'Loading...',
    inactiveHdr:  'Inactive staff',
    edit:         'Edit',
    deactivate:   'Deactivate',
    reactivate:   'Re-enable',
    role:         'Role',
    specs:        'Specialisations',
    services:     'Services',
    noServices:   'No services added yet',
  },
};

export default function StaffPageWrapper() {
  return <DashboardShell pageTitle="page_staff"><StaffPage /></DashboardShell>;
}

function StaffPage() {
  const { dir, align, lang } = useLang();
  const c = COPY[lang];
  const { user } = useDashboardAuth();
  const category = user?.business_category ?? 'salon';
  const isRestoOrCafe = category === 'restaurant' || category === 'cafe';
  const isGaming = category === 'gaming_cafe';

  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // specialisations stores: salon → spec keys, restaurant/cafe → single role key + service IDs prefixed 'svc:'
  const [form, setForm] = useState({ name_ar: '', name_en: '', specialisations: [] as string[] });

  const { data, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list().then((r) => r.data),
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: () => servicesApi.list().then((r) => r.data),
  });

  const services: any[] = servicesData?.services ?? [];
  const activeServices = services.filter((s) => s.is_active !== false);

  const createMutation = useMutation({
    mutationFn: () => staffApi.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); markOnboardingStep('staff'); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => staffApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); resetForm(); },
  });

  const resetForm = () => {
    setForm({ name_ar: '', name_en: '', specialisations: [] });
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (member: any) => {
    setForm({ name_ar: member.name_ar, name_en: member.name_en ?? '', specialisations: member.specialisations ?? [] });
    setEditingId(member.id);
    setShowForm(true);
  };

  // ── Tag toggle helpers ───────────────────────────────────────

  /** For salon: toggle a specialisation key */
  const toggleSpec = (spec: string) => {
    setForm((f) => ({
      ...f,
      specialisations: f.specialisations.includes(spec)
        ? f.specialisations.filter((s) => s !== spec)
        : [...f.specialisations, spec],
    }));
  };

  /** For restaurant/cafe/gaming: select a single role (replace any existing role key) */
  const setRole = (role: string) => {
    const allRoleKeys = new Set([...Object.keys(RESTO_ROLES), ...Object.keys(GAMING_ROLES)]);
    setForm((f) => {
      const withoutRoles = f.specialisations.filter((s) => !allRoleKeys.has(s));
      return { ...f, specialisations: [role, ...withoutRoles] };
    });
  };

  /** Toggle a service ID (prefixed with 'svc:') */
  const toggleService = (svcId: string) => {
    const tag = `svc:${svcId}`;
    setForm((f) => ({
      ...f,
      specialisations: f.specialisations.includes(tag)
        ? f.specialisations.filter((s) => s !== tag)
        : [...f.specialisations, tag],
    }));
  };

  const allRoleKeys = new Set([...Object.keys(RESTO_ROLES), ...Object.keys(GAMING_ROLES)]);
  const selectedRole = form.specialisations.find((s) => allRoleKeys.has(s));
  const selectedServiceIds = form.specialisations.filter((s) => s.startsWith('svc:')).map((s) => s.replace('svc:', ''));

  const handleSave = () => {
    if (!form.name_ar.trim()) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate();
    }
  };

  // ── Display helpers ──────────────────────────────────────────

  const getRoleLabel = (specs: string[]) => {
    const role = specs.find((s) => allRoleKeys.has(s));
    if (!role) return null;
    const dict = GAMING_ROLES[role] ?? RESTO_ROLES[role];
    return lang === 'ar' ? dict.ar : dict.en;
  };

  const getSpecLabels = (specs: string[]) =>
    specs
      .filter((s) => Object.keys(SALON_SPECS).includes(s))
      .map((s) => (lang === 'ar' ? SALON_SPECS[s].ar : SALON_SPECS[s].en));

  const getServiceNames = (specs: string[]) => {
    const ids = specs.filter((s) => s.startsWith('svc:')).map((s) => s.replace('svc:', ''));
    return ids
      .map((id) => services.find((sv) => sv.id === id))
      .filter(Boolean)
      .map((sv: any) => (lang === 'ar' ? sv.name_ar : sv.name_en ?? sv.name_ar));
  };

  const staff: any[] = data?.staff ?? [];
  const active = staff.filter((s) => s.is_active);
  const inactive = staff.filter((s) => !s.is_active);

  // Fix #8: auto-mark 'staff' onboarding step as soon as there is at least one
  // active staff member (the owner card always counts, but we wait for the API
  // to confirm at least one staff row so the step is truly meaningful).
  useEffect(() => {
    if (!isLoading && (active.length > 0 || user)) {
      markOnboardingStep('staff');
    }
  }, [isLoading, active.length, user]);

  return (
    <div style={{ padding: '24px', fontFamily: 'Cairo, sans-serif', direction: dir, maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0F2044', margin: 0, textAlign: align }}>{c.title}</h2>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0', textAlign: align }}>{c.subtitle}</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} style={btnStyle('#1B8A7A')}>
          {c.addBtn}
        </button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div style={card}>
          <h3 style={{ ...cardTitle, textAlign: align }}>{editingId ? c.formEdit : c.formNew}</h3>

          {/* Name fields */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ ...labelSt, textAlign: align }}>{c.lblNameAr}</label>
              <input
                style={inputSt}
                value={form.name_ar}
                onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                placeholder={c.phNameAr}
                dir="rtl"
              />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ ...labelSt, textAlign: align }}>{c.lblNameEn}</label>
              <input
                style={inputSt}
                value={form.name_en}
                onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                placeholder={c.phNameEn}
                dir="ltr"
              />
            </div>
          </div>

          {/* Role (restaurant/cafe/gaming) OR Specialisations (salon) */}
          {isRestoOrCafe ? (
            <>
              <label style={{ ...labelSt, textAlign: align }}>{c.lblRole}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                {Object.entries(RESTO_ROLES).map(([key, labels]) => {
                  const isActive = selectedRole === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setRole(key)}
                      style={chipStyle(isActive, '#0F2044', '#EEF0F7')}
                    >
                      {lang === 'ar' ? labels.ar : labels.en}
                    </button>
                  );
                })}
              </div>
            </>
          ) : isGaming ? (
            <>
              <label style={{ ...labelSt, textAlign: align }}>{c.lblRole}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                {Object.entries(GAMING_ROLES).map(([key, labels]) => {
                  const isActive = selectedRole === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setRole(key)}
                      style={chipStyle(isActive, '#7C3AED', '#F3EEFF')}
                    >
                      {lang === 'ar' ? labels.ar : labels.en}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <label style={{ ...labelSt, textAlign: align }}>{c.lblSpecs}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                {Object.entries(SALON_SPECS).map(([key, labels]) => {
                  const isActive = form.specialisations.includes(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleSpec(key)}
                      style={chipStyle(isActive, '#1B8A7A', '#E8F5F3')}
                    >
                      {lang === 'ar' ? labels.ar : labels.en}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Service assignment — all categories */}
          {activeServices.length > 0 && (
            <>
              <label style={{ ...labelSt, textAlign: align }}>{c.lblServices}</label>
              <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 10px', textAlign: align }}>{c.servicesHint}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                {activeServices.map((svc: any) => {
                  const selected = selectedServiceIds.includes(svc.id);
                  return (
                    <button
                      key={svc.id}
                      onClick={() => toggleService(svc.id)}
                      style={chipStyle(selected, '#1B8A7A', '#E8F5F3')}
                    >
                      {lang === 'ar' ? svc.name_ar : (svc.name_en ?? svc.name_ar)}
                      {selected && <span style={{ marginInlineStart: '4px', fontSize: '10px' }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start' }}>
            <button onClick={resetForm} style={btnStyle('#6B7280')}>{c.cancel}</button>
            <button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} style={btnStyle('#0F2044')}>
              {editingId ? c.saveEdit : c.save}
            </button>
          </div>
        </div>
      )}

      {/* Staff cards */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#6B7280' }}>{c.loading}</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {/* Owner card — non-editable, always first */}
            {user && (
              <div style={{ ...card, padding: '20px', marginBottom: 0, border: '2px solid #E8F5F3' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#1B8A7A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: '18px' }}>
                      {(user.full_name ?? '?').charAt(0)}
                    </span>
                  </div>
                  <div style={{ flex: 1, textAlign: align }}>
                    <div style={{ fontWeight: 700, fontSize: '16px', color: '#0F2044' }}>{user.full_name}</div>
                    <div style={{ fontSize: '12px', color: '#9CA3AF' }}>{user.phone}</div>
                  </div>
                </div>
                <div>
                  <span style={{ padding: '3px 10px', background: '#E8F5F3', color: '#1B8A7A', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                    {lang === 'ar' ? OWNER_LABEL.ar : OWNER_LABEL.en}
                  </span>
                </div>
              </div>
            )}
            {active.map((member) => {
              const specs: string[] = member.specialisations ?? [];
              const roleLabel = getRoleLabel(specs);
              const specLabels = getSpecLabels(specs);
              const serviceNames = getServiceNames(specs);
              return (
                <div key={member.id} style={{ ...card, padding: '20px', marginBottom: 0 }}>
                  {/* Avatar + name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#0F2044', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: '18px' }}>{member.name_ar.charAt(0)}</span>
                    </div>
                    <div style={{ flex: 1, textAlign: align }}>
                      <div style={{ fontWeight: 700, fontSize: '16px', color: '#0F2044' }}>{member.name_ar}</div>
                      {member.name_en && <div style={{ fontSize: '12px', color: '#9CA3AF' }}>{member.name_en}</div>}
                    </div>
                  </div>

                  {/* Role badge (restaurant / cafe / gaming) */}
                  {roleLabel && (
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{
                        padding: '3px 10px',
                        background: isGaming ? '#F3EEFF' : '#EEF0F7',
                        color: isGaming ? '#7C3AED' : '#0F2044',
                        borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                      }}>
                        {roleLabel}
                      </span>
                    </div>
                  )}

                  {/* Specialisation chips (salon) */}
                  {specLabels.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                      {specLabels.map((label) => (
                        <span key={label} style={{ padding: '3px 10px', background: '#E8F5F3', color: '#1B8A7A', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                          {label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Assigned services */}
                  {serviceNames.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', marginBottom: '4px', textAlign: align }}>{c.services}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {serviceNames.map((name) => (
                          <span key={name} style={{ padding: '3px 10px', background: '#F3F4F6', color: '#374151', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => startEdit(member)} style={{ ...btnSmall, background: '#F7F8FA', color: '#0F2044' }}>{c.edit}</button>
                    <button
                      onClick={() => updateMutation.mutate({ id: member.id, data: { is_active: false } })}
                      style={{ ...btnSmall, background: '#FEF2F2', color: '#D32F2F' }}
                    >
                      {c.deactivate}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {inactive.length > 0 && (
            <>
              <h3 style={{ color: '#9CA3AF', fontSize: '14px', fontWeight: 600, marginBottom: '12px', textAlign: align }}>{c.inactiveHdr}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                {inactive.map((member) => (
                  <div key={member.id} style={{ ...card, padding: '16px', opacity: 0.6, marginBottom: 0 }}>
                    <div style={{ fontWeight: 700, color: '#0F2044', marginBottom: '8px', textAlign: align }}>{member.name_ar}</div>
                    <button
                      onClick={() => updateMutation.mutate({ id: member.id, data: { is_active: true } })}
                      style={{ ...btnSmall, background: '#E8F5F3', color: '#1B8A7A' }}
                    >
                      {c.reactivate}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Shared micro-styles ──────────────────────────────────────
const card: React.CSSProperties = {
  backgroundColor: '#fff', borderRadius: '14px', padding: '24px',
  boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: '20px',
};
const cardTitle: React.CSSProperties = {
  fontWeight: 700, fontSize: '17px', color: '#0F2044', marginTop: 0, marginBottom: '16px',
};
const labelSt: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '6px',
};
const inputSt: React.CSSProperties = {
  width: '100%', border: '1.5px solid #E5E7EB', borderRadius: '8px',
  padding: '10px 12px', fontFamily: 'Cairo, sans-serif', fontSize: '14px',
  color: '#0F2044', boxSizing: 'border-box',
};
const btnStyle = (bg: string): React.CSSProperties => ({
  padding: '10px 20px', background: bg, border: 'none', borderRadius: '10px',
  fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: 700,
  color: '#fff', cursor: 'pointer',
});
const btnSmall: React.CSSProperties = {
  padding: '6px 14px', border: 'none', borderRadius: '8px',
  fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
};
const chipStyle = (active: boolean, activeColor: string, activeBg: string): React.CSSProperties => ({
  padding: '6px 14px',
  border: `1.5px solid ${active ? activeColor : '#E5E7EB'}`,
  borderRadius: '20px',
  background: active ? activeBg : '#fff',
  fontFamily: 'Cairo, sans-serif',
  fontSize: '13px',
  fontWeight: 600,
  color: active ? activeColor : '#6B7280',
  cursor: 'pointer',
});
