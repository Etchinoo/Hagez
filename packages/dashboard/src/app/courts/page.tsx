// ============================================================
// SUPER RESERVATION PLATFORM — Courts Inventory Page (US-086)
// Court category: add, edit, deactivate court resources.
// ============================================================

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { courtsApi } from '@/services/api';
import { useLang } from '@/lib/i18n';
import DashboardShell from '@/components/DashboardShell';

const COPY = {
  ar: {
    title:        'إدارة الملاعب',
    subtitle:     'أضف ملاعبك وحدّد طاقتها الاستيعابية لتنظيم الحجوزات',
    addBtn:       '+ إضافة ملعب',
    addFirst:     '+ إضافة أول ملعب',
    formNew:      'إضافة ملعب جديد',
    formEdit:     'تعديل الملعب',
    lblNameAr:    'الاسم (عربي) *',
    lblNameEn:    'الاسم (إنجليزي)',
    lblCapacity:  'الطاقة الاستيعابية',
    phNameAr:     'ملعب ١',
    phNameEn:     'Court 1',
    saving:       'جاري الحفظ...',
    save:         'حفظ',
    cancel:       'إلغاء',
    loading:      'جاري التحميل...',
    emptyTitle:   'لا توجد ملاعب بعد',
    emptyDesc:    'أضف ملاعبك وحدّد طاقتها الاستيعابية حتى يتمكن العملاء من حجزها',
    thNameAr:     'الاسم (عربي)',
    thNameEn:     'الاسم (إنجليزي)',
    thCapacity:   'الطاقة',
    thStatus:     'الحالة',
    thActions:    'إجراءات',
    active:       'نشط',
    inactive:     'موقوف',
    edit:         'تعديل',
    deactivate:   'إيقاف',
    activate:     'تفعيل',
  },
  en: {
    title:        'Court Management',
    subtitle:     'Add your courts and set their capacity to organize bookings',
    addBtn:       '+ Add court',
    addFirst:     '+ Add first court',
    formNew:      'Add new court',
    formEdit:     'Edit court',
    lblNameAr:    'Name (Arabic) *',
    lblNameEn:    'Name (English)',
    lblCapacity:  'Capacity',
    phNameAr:     'Court 1',
    phNameEn:     'Court 1',
    saving:       'Saving...',
    save:         'Save',
    cancel:       'Cancel',
    loading:      'Loading...',
    emptyTitle:   'No courts yet',
    emptyDesc:    'Add your courts and set their capacity so customers can book them',
    thNameAr:     'Name (Arabic)',
    thNameEn:     'Name (English)',
    thCapacity:   'Capacity',
    thStatus:     'Status',
    thActions:    'Actions',
    active:       'Active',
    inactive:     'Inactive',
    edit:         'Edit',
    deactivate:   'Deactivate',
    activate:     'Activate',
  },
};

export default function CourtsPageWrapper() {
  return (
    <DashboardShell pageTitle="page_courts">
      <CourtsPage />
    </DashboardShell>
  );
}

function CourtsPage() {
  const { dir, align, lang } = useLang();
  const c = COPY[lang];
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name_ar: '', name_en: '', capacity: 1 });

  const { data, isLoading } = useQuery({
    queryKey: ['courts'],
    queryFn: () => courtsApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => courtsApi.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['courts'] }); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => courtsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['courts'] }); resetForm(); },
  });

  const resetForm = () => {
    setForm({ name_ar: '', name_en: '', capacity: 1 });
    setShowForm(false);
    setEditingId(null);
  };

  const courts: any[] = data?.courts ?? [];
  const isEmpty = !isLoading && courts.length === 0 && !showForm;

  function startEdit(court: any) {
    setForm({ name_ar: court.name_ar, name_en: court.name_en ?? '', capacity: court.capacity ?? 1 });
    setEditingId(court.id);
    setShowForm(true);
  }

  function handleToggleActive(court: any) {
    updateMutation.mutate({ id: court.id, data: { is_active: !court.is_active } });
  }

  function handleSave() {
    if (!form.name_ar.trim()) return;
    if (editingId) updateMutation.mutate({ id: editingId, data: form });
    else createMutation.mutate();
  }

  return (
    <div style={{ ...s.page, direction: dir }}>
      <div style={s.header}>
        <div>
          <h1 style={{ ...s.title, textAlign: align }}>{c.title}</h1>
          <p style={{ ...s.subtitle, textAlign: align }}>{c.subtitle}</p>
        </div>
        {!isEmpty && (
          <button style={s.addBtn} onClick={() => { resetForm(); setShowForm(true); }}>
            {c.addBtn}
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div style={s.formCard}>
          <h2 style={{ ...s.formTitle, textAlign: align }}>{editingId ? c.formEdit : c.formNew}</h2>
          <div style={s.formRow}>
            <label style={{ ...s.label, textAlign: align }}>{c.lblNameAr}</label>
            <input style={s.input} dir="rtl" placeholder={c.phNameAr} value={form.name_ar}
              onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} />
          </div>
          <div style={s.formRow}>
            <label style={{ ...s.label, textAlign: align }}>{c.lblNameEn}</label>
            <input style={s.input} dir="ltr" placeholder={c.phNameEn} value={form.name_en}
              onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} />
          </div>
          <div style={s.formRow}>
            <label style={{ ...s.label, textAlign: align }}>{c.lblCapacity}</label>
            <input style={{ ...s.input, width: 80 }} type="number" min={1} max={4} value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))} />
          </div>
          <div style={s.formActions}>
            <button style={s.saveBtn} onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? c.saving : c.save}
            </button>
            <button style={s.cancelBtn} onClick={resetForm}>{c.cancel}</button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && <div style={s.loading}>{c.loading}</div>}

      {/* Empty state */}
      {isEmpty && (
        <div style={s.emptyState}>
          <div style={{ ...s.emptyIcon, background: 'linear-gradient(135deg, #DCFCE7 0%, #F0FDF4 100%)' }}>⚽</div>
          <h3 style={s.emptyTitle}>{c.emptyTitle}</h3>
          <p style={s.emptyDesc}>{c.emptyDesc}</p>
          <button style={s.addBtn} onClick={() => { resetForm(); setShowForm(true); }}>
            {c.addFirst}
          </button>
        </div>
      )}

      {/* Courts table */}
      {!isLoading && courts.length > 0 && (
        <div style={s.tableWrapper}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, textAlign: align }}>{c.thNameAr}</th>
                <th style={{ ...s.th, textAlign: align }}>{c.thNameEn}</th>
                <th style={{ ...s.th, textAlign: align }}>{c.thCapacity}</th>
                <th style={{ ...s.th, textAlign: align }}>{c.thStatus}</th>
                <th style={{ ...s.th, textAlign: align }}>{c.thActions}</th>
              </tr>
            </thead>
            <tbody>
              {courts.map((court) => (
                <tr key={court.id} style={!court.is_active ? s.inactiveRow : {}}>
                  <td style={{ ...s.td, textAlign: align }}>{court.name_ar}</td>
                  <td style={{ ...s.td, textAlign: align }}>{court.name_en || '—'}</td>
                  <td style={{ ...s.td, textAlign: align }}>{court.capacity}</td>
                  <td style={{ ...s.td, textAlign: align }}>
                    <span style={court.is_active ? s.activeBadge : s.inactiveBadge}>
                      {court.is_active ? c.active : c.inactive}
                    </span>
                  </td>
                  <td style={{ ...s.td, textAlign: align }}>
                    <div style={s.actions}>
                      <button style={s.editBtn} onClick={() => startEdit(court)}>{c.edit}</button>
                      <button style={court.is_active ? s.deactivateBtn : s.activateBtn}
                        onClick={() => handleToggleActive(court)} disabled={updateMutation.isPending}>
                        {court.is_active ? c.deactivate : c.activate}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const ACCENT = '#2E7D32';

const s: Record<string, React.CSSProperties> = {
  page:      { padding: '24px', maxWidth: 900, fontFamily: 'Cairo, sans-serif', margin: '0 auto' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title:     { fontFamily: 'Cairo, sans-serif', fontSize: 22, fontWeight: 700, color: '#0F2044', margin: 0 },
  subtitle:  { fontFamily: 'Cairo, sans-serif', fontSize: 14, color: '#6B7280', margin: '4px 0 0' },
  addBtn:    { backgroundColor: ACCENT, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontFamily: 'Cairo, sans-serif', fontSize: 15, fontWeight: 600, cursor: 'pointer' },

  formCard:    { backgroundColor: '#fff', borderRadius: 16, padding: 24, marginBottom: 24, border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  formTitle:   { fontFamily: 'Cairo, sans-serif', fontSize: 18, fontWeight: 700, color: '#0F2044', marginTop: 0, marginBottom: 20 },
  formRow:     { marginBottom: 16 },
  label:       { display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: 14, color: '#374151', marginBottom: 6 },
  input:       { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontFamily: 'Cairo, sans-serif', fontSize: 15, color: '#0F2044', outline: 'none', boxSizing: 'border-box' },
  formActions: { display: 'flex', gap: 12, justifyContent: 'flex-start', marginTop: 20 },
  saveBtn:     { backgroundColor: ACCENT, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontFamily: 'Cairo, sans-serif', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  cancelBtn:   { backgroundColor: '#fff', color: '#6B7280', border: '1.5px solid #E5E7EB', borderRadius: 10, padding: '10px 20px', fontFamily: 'Cairo, sans-serif', fontSize: 15, cursor: 'pointer' },

  loading: { textAlign: 'center', padding: 40, color: '#6B7280', fontFamily: 'Cairo, sans-serif' },

  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' },
  emptyIcon:  { width: 96, height: 96, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, marginBottom: 24 },
  emptyTitle: { fontSize: 20, fontWeight: 700, color: '#0F2044', margin: '0 0 10px', fontFamily: 'Cairo, sans-serif' },
  emptyDesc:  { fontSize: 15, color: '#6B7280', margin: '0 0 32px', maxWidth: 380, lineHeight: '1.7', fontFamily: 'Cairo, sans-serif' },

  tableWrapper:  { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid #E5E7EB' },
  table:         { width: '100%', borderCollapse: 'collapse' },
  th:            { padding: '14px 20px', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 600, color: '#6B7280', backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  td:            { padding: '14px 20px', fontFamily: 'Cairo, sans-serif', fontSize: 14, color: '#0F2044', borderBottom: '1px solid #F3F4F6' },
  inactiveRow:   { opacity: 0.5 },
  activeBadge:   { backgroundColor: '#DCFCE7', color: '#166534', borderRadius: 6, padding: '3px 10px', fontSize: 13, fontWeight: 600 },
  inactiveBadge: { backgroundColor: '#F3F4F6', color: '#6B7280', borderRadius: 6, padding: '3px 10px', fontSize: 13, fontWeight: 600 },
  actions:       { display: 'flex', gap: 8 },
  editBtn:       { backgroundColor: '#EFF6FF', color: '#1D4ED8', border: 'none', borderRadius: 8, padding: '6px 14px', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  deactivateBtn: { backgroundColor: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: 8, padding: '6px 14px', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  activateBtn:   { backgroundColor: '#F0FDF4', color: '#16A34A', border: 'none', borderRadius: 8, padding: '6px 14px', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
};
