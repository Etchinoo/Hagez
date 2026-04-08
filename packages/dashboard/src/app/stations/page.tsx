// ============================================================
// SUPER RESERVATION PLATFORM — Stations Inventory Page (US-093)
// Gaming cafe: add, edit, deactivate station resources.
// Station types: PC, Console, VR, Group Room.
// ============================================================

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stationsApi } from '@/services/api';
import { useLang } from '@/lib/i18n';
import DashboardShell from '@/components/DashboardShell';

const STATION_TYPES_AR: Record<string, string> = {
  pc:         '🖥️ كمبيوتر PC',
  console:    '🎮 بلايستيشن',
  vr:         '🥽 واقع افتراضي VR',
  group_room: '👥 غرفة جماعية',
};

const STATION_TYPES_EN: Record<string, string> = {
  pc:         '🖥️ PC',
  console:    '🎮 Console',
  vr:         '🥽 VR',
  group_room: '👥 Group Room',
};

const COPY = {
  ar: {
    title:       'إدارة المحطات',
    subtitle:    'أضف محطاتك وحدّد أنواعها وطاقتها الاستيعابية',
    addBtn:      '+ إضافة محطة',
    addFirst:    '+ إضافة أول محطة',
    formNew:     'إضافة محطة جديدة',
    formEdit:    'تعديل المحطة',
    lblNameAr:   'الاسم (عربي) *',
    lblNameEn:   'الاسم (إنجليزي)',
    lblType:     'نوع المحطة',
    lblCapacity: 'الطاقة الاستيعابية',
    phNameAr:    'محطة PC ١',
    phNameEn:    'PC Station 1',
    saving:      'جاري الحفظ...',
    save:        'حفظ',
    cancel:      'إلغاء',
    loading:     'جاري التحميل...',
    emptyTitle:  'لا توجد محطات بعد',
    emptyDesc:   'أضف محطات الجيمنج الخاصة بك حتى يتمكن العملاء من حجزها',
    thNameAr:    'الاسم (عربي)',
    thType:      'النوع',
    thCapacity:  'الطاقة',
    thStatus:    'الحالة',
    thActions:   'إجراءات',
    active:      'نشط',
    inactive:    'موقوف',
    edit:        'تعديل',
    deactivate:  'إيقاف',
    activate:    'تفعيل',
  },
  en: {
    title:       'Station Management',
    subtitle:    'Add your gaming stations and set their types and capacity',
    addBtn:      '+ Add station',
    addFirst:    '+ Add first station',
    formNew:     'Add new station',
    formEdit:    'Edit station',
    lblNameAr:   'Name (Arabic) *',
    lblNameEn:   'Name (English)',
    lblType:     'Station type',
    lblCapacity: 'Capacity',
    phNameAr:    'PC Station 1',
    phNameEn:    'PC Station 1',
    saving:      'Saving...',
    save:        'Save',
    cancel:      'Cancel',
    loading:     'Loading...',
    emptyTitle:  'No stations yet',
    emptyDesc:   'Add your gaming stations so customers can book them',
    thNameAr:    'Name (Arabic)',
    thType:      'Type',
    thCapacity:  'Capacity',
    thStatus:    'Status',
    thActions:   'Actions',
    active:      'Active',
    inactive:    'Inactive',
    edit:        'Edit',
    deactivate:  'Deactivate',
    activate:    'Activate',
  },
};

export default function StationsPageWrapper() {
  return (
    <DashboardShell pageTitle="page_stations">
      <StationsPage />
    </DashboardShell>
  );
}

function StationsPage() {
  const { dir, align, lang } = useLang();
  const c = COPY[lang];
  const stationTypes = lang === 'ar' ? STATION_TYPES_AR : STATION_TYPES_EN;
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name_ar: '', name_en: '', station_type: 'pc', capacity: 1 });

  const { data, isLoading } = useQuery({
    queryKey: ['stations'],
    queryFn: () => stationsApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => stationsApi.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stations'] }); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => stationsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stations'] }); resetForm(); },
  });

  const resetForm = () => {
    setForm({ name_ar: '', name_en: '', station_type: 'pc', capacity: 1 });
    setShowForm(false);
    setEditingId(null);
  };

  const stations: any[] = data?.stations ?? [];
  const isEmpty = !isLoading && stations.length === 0 && !showForm;

  function startEdit(station: any) {
    setForm({ name_ar: station.name_ar, name_en: station.name_en ?? '', station_type: station.specialisations?.[0] ?? 'pc', capacity: station.capacity ?? 1 });
    setEditingId(station.id);
    setShowForm(true);
  }

  function handleToggleActive(station: any) {
    updateMutation.mutate({ id: station.id, data: { is_active: !station.is_active } });
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
            <label style={{ ...s.label, textAlign: align }}>{c.lblType}</label>
            <select style={{ ...s.input, cursor: 'pointer' }} value={form.station_type}
              onChange={(e) => setForm((f) => ({ ...f, station_type: e.target.value }))}>
              {Object.entries(STATION_TYPES_AR).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </div>
          <div style={s.formRow}>
            <label style={{ ...s.label, textAlign: align }}>{c.lblCapacity}</label>
            <input style={{ ...s.input, width: 80 }} type="number" min={1} max={10} value={form.capacity}
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

      {isLoading && <div style={s.loading}>{c.loading}</div>}

      {/* Empty state */}
      {isEmpty && (
        <div style={s.emptyState}>
          <div style={{ ...s.emptyIcon, background: 'linear-gradient(135deg, #F3E8FF 0%, #FAF5FF 100%)' }}>🕹️</div>
          <h3 style={s.emptyTitle}>{c.emptyTitle}</h3>
          <p style={s.emptyDesc}>{c.emptyDesc}</p>
          <button style={s.addBtn} onClick={() => { resetForm(); setShowForm(true); }}>
            {c.addFirst}
          </button>
        </div>
      )}

      {/* Stations table */}
      {!isLoading && stations.length > 0 && (
        <div style={s.tableWrapper}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, textAlign: align }}>{c.thNameAr}</th>
                <th style={{ ...s.th, textAlign: align }}>{c.thType}</th>
                <th style={{ ...s.th, textAlign: align }}>{c.thCapacity}</th>
                <th style={{ ...s.th, textAlign: align }}>{c.thStatus}</th>
                <th style={{ ...s.th, textAlign: align }}>{c.thActions}</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((st) => (
                <tr key={st.id} style={!st.is_active ? s.inactiveRow : {}}>
                  <td style={{ ...s.td, textAlign: align }}>{st.name_ar}</td>
                  <td style={{ ...s.td, textAlign: align }}>{stationTypes[st.specialisations?.[0]] ?? st.specialisations?.[0] ?? '—'}</td>
                  <td style={{ ...s.td, textAlign: align }}>{st.capacity}</td>
                  <td style={{ ...s.td, textAlign: align }}>
                    <span style={st.is_active ? s.activeBadge : s.inactiveBadge}>
                      {st.is_active ? c.active : c.inactive}
                    </span>
                  </td>
                  <td style={{ ...s.td, textAlign: align }}>
                    <div style={s.actions}>
                      <button style={s.editBtn} onClick={() => startEdit(st)}>{c.edit}</button>
                      <button style={st.is_active ? s.deactivateBtn : s.activateBtn}
                        onClick={() => handleToggleActive(st)} disabled={updateMutation.isPending}>
                        {st.is_active ? c.deactivate : c.activate}
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

const ACCENT = '#6B21A8';

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
  activeBadge:   { backgroundColor: '#F3E8FF', color: '#6B21A8', borderRadius: 6, padding: '3px 10px', fontSize: 13, fontWeight: 600 },
  inactiveBadge: { backgroundColor: '#F3F4F6', color: '#6B7280', borderRadius: 6, padding: '3px 10px', fontSize: 13, fontWeight: 600 },
  actions:       { display: 'flex', gap: 8 },
  editBtn:       { backgroundColor: '#EFF6FF', color: '#1D4ED8', border: 'none', borderRadius: 8, padding: '6px 14px', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  deactivateBtn: { backgroundColor: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: 8, padding: '6px 14px', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  activateBtn:   { backgroundColor: '#F5F3FF', color: '#6B21A8', border: 'none', borderRadius: 8, padding: '6px 14px', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
};
