// ============================================================
// SUPER RESERVATION PLATFORM — Staff Management Page (US-057)
// Salon-only: add, edit, deactivate stylists.
// Lists with specialisations, links to per-staff calendar.
// ============================================================

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffApi } from '@/services/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

const SPECIALISATIONS_AR: Record<string, string> = {
  haircut:    'قص شعر',
  colour:     'صبغ شعر',
  treatment:  'علاج شعر',
  blowdry:    'سشوار',
  beard:      'لحية',
  facial:     'عناية بالوجه',
  nails:      'مناكير',
  makeup:     'مكياج',
};

export default function StaffPageWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <StaffPage />
    </QueryClientProvider>
  );
}

function StaffPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name_ar: '', name_en: '', specialisations: [] as string[] });

  const { data, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => staffApi.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); resetForm(); },
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

  const toggleSpec = (spec: string) => {
    setForm((f) => ({
      ...f,
      specialisations: f.specialisations.includes(spec)
        ? f.specialisations.filter((s) => s !== spec)
        : [...f.specialisations, spec],
    }));
  };

  const handleSave = () => {
    if (!form.name_ar.trim()) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate();
    }
  };

  const staff: any[] = data?.staff ?? [];
  const active = staff.filter((s) => s.is_active);
  const inactive = staff.filter((s) => !s.is_active);

  return (
    <div style={{ padding: '24px', fontFamily: 'Cairo, sans-serif', direction: 'rtl', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0F2044', margin: 0 }}>إدارة الموظفين</h2>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0' }}>إضافة وتعديل وتعطيل الموظفين في صالونك</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} style={btnStyle('#1B8A7A')}>
          + إضافة موظف
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div style={card}>
          <h3 style={cardTitle}>{editingId ? 'تعديل الموظف' : 'موظف جديد'}</h3>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={labelSt}>الاسم بالعربية *</label>
              <input
                style={inputSt}
                value={form.name_ar}
                onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                placeholder="مثال: أحمد محمد"
              />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={labelSt}>الاسم بالإنجليزية</label>
              <input
                style={inputSt}
                value={form.name_en}
                onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                placeholder="Ahmed Mohamed"
                dir="ltr"
              />
            </div>
          </div>

          <label style={labelSt}>التخصصات</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            {Object.entries(SPECIALISATIONS_AR).map(([key, label]) => (
              <button
                key={key}
                onClick={() => toggleSpec(key)}
                style={{
                  padding: '6px 14px', border: `1.5px solid ${form.specialisations.includes(key) ? '#1B8A7A' : '#E5E7EB'}`,
                  borderRadius: '20px', background: form.specialisations.includes(key) ? '#E8F5F3' : '#fff',
                  fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 600,
                  color: form.specialisations.includes(key) ? '#1B8A7A' : '#6B7280', cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start' }}>
            <button onClick={resetForm} style={btnStyle('#6B7280')}>إلغاء</button>
            <button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} style={btnStyle('#0F2044')}>
              {editingId ? 'حفظ التعديلات' : 'إضافة الموظف'}
            </button>
          </div>
        </div>
      )}

      {/* Active Staff */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#6B7280' }}>جاري التحميل...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {active.map((member) => (
              <div key={member.id} style={{ ...card, padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#0F2044', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: '18px' }}>{member.name_ar.charAt(0)}</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '16px', color: '#0F2044' }}>{member.name_ar}</div>
                    {member.name_en && <div style={{ fontSize: '12px', color: '#9CA3AF' }}>{member.name_en}</div>}
                  </div>
                </div>
                {(member.specialisations ?? []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '14px' }}>
                    {member.specialisations.map((spec: string) => (
                      <span key={spec} style={{ padding: '3px 10px', background: '#E8F5F3', color: '#1B8A7A', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                        {SPECIALISATIONS_AR[spec] ?? spec}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => startEdit(member)} style={{ ...btnSmall, background: '#F7F8FA', color: '#0F2044' }}>تعديل</button>
                  <button
                    onClick={() => updateMutation.mutate({ id: member.id, data: { is_active: false } })}
                    style={{ ...btnSmall, background: '#FEF2F2', color: '#D32F2F' }}
                  >
                    تعطيل
                  </button>
                </div>
              </div>
            ))}
          </div>

          {inactive.length > 0 && (
            <>
              <h3 style={{ color: '#9CA3AF', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>موظفون معطّلون</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                {inactive.map((member) => (
                  <div key={member.id} style={{ ...card, padding: '16px', opacity: 0.6 }}>
                    <div style={{ fontWeight: 700, color: '#0F2044', marginBottom: '8px' }}>{member.name_ar}</div>
                    <button
                      onClick={() => updateMutation.mutate({ id: member.id, data: { is_active: true } })}
                      style={{ ...btnSmall, background: '#E8F5F3', color: '#1B8A7A' }}
                    >
                      إعادة تفعيل
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

// Shared micro-styles
const card: React.CSSProperties = { backgroundColor: '#fff', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: '20px' };
const cardTitle: React.CSSProperties = { fontWeight: 700, fontSize: '17px', color: '#0F2044', marginTop: 0, marginBottom: '16px' };
const labelSt: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '6px' };
const inputSt: React.CSSProperties = { width: '100%', border: '1.5px solid #E5E7EB', borderRadius: '8px', padding: '10px 12px', fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#0F2044', boxSizing: 'border-box' };
const btnStyle = (bg: string): React.CSSProperties => ({
  padding: '10px 20px', background: bg, border: 'none', borderRadius: '10px',
  fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: 700, color: '#fff', cursor: 'pointer',
});
const btnSmall: React.CSSProperties = { padding: '6px 14px', border: 'none', borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
