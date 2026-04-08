// ============================================================
// SUPER RESERVATION PLATFORM — Service Menu Page (US-058)
// ============================================================

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { servicesApi } from '@/services/api';
import { useLang } from '@/lib/i18n';
import DashboardShell from '@/components/DashboardShell';

const COPY = {
  ar: {
    title:       'قائمة الخدمات',
    subtitle:    'أضف الخدمات التي يقدمها نشاطك التجاري وحدّد أسعارها ومددها',
    emptyTitle:  'لا توجد خدمات بعد',
    emptyDesc:   'أضف الخدمات التي يقدمها نشاطك التجاري حتى يتمكن العملاء من اختيارها عند الحجز',
    addFirst:    '+ إضافة أول خدمة',
    addBtn:      '+ إضافة خدمة',
    formNew:     'خدمة جديدة',
    formEdit:    'تعديل الخدمة',
    priceWarn:   '⚠️ تغيير السعر يؤثر على الحجوزات الجديدة فقط — الحجوزات الحالية لن تتأثر.',
    lblNameAr:   'الاسم بالعربية *',
    lblNameEn:   'الاسم بالإنجليزية',
    lblPrice:    'السعر (ج.م)',
    lblDuration: 'المدة (دقيقة)',
    phNameAr:    'مثال: قص شعر',
    phNameEn:    'e.g. Haircut',
    cancel:      'إلغاء',
    save:        'إضافة الخدمة',
    saveEdit:    'حفظ التعديلات',
    thService:   'الخدمة',
    thDuration:  'المدة',
    thPrice:     'السعر',
    edit:        'تعديل',
    deactivate:  'تعطيل',
    inactiveHdr: 'خدمات معطّلة',
    reactivate:  'إعادة تفعيل',
    loading:     'جاري التحميل...',
    currency:    'ج.م',
    durationUnit:'دقيقة',
  },
  en: {
    title:       'Service List',
    subtitle:    'Add the services your business offers and set their prices and durations',
    emptyTitle:  'No services yet',
    emptyDesc:   'Add your services so customers can choose them when booking',
    addFirst:    '+ Add first service',
    addBtn:      '+ Add service',
    formNew:     'New service',
    formEdit:    'Edit service',
    priceWarn:   '⚠️ Price changes apply to new bookings only — existing bookings are not affected.',
    lblNameAr:   'Name (Arabic) *',
    lblNameEn:   'Name (English)',
    lblPrice:    'Price (EGP)',
    lblDuration: 'Duration (min)',
    phNameAr:    'e.g. Haircut',
    phNameEn:    'e.g. Haircut',
    cancel:      'Cancel',
    save:        'Add service',
    saveEdit:    'Save changes',
    thService:   'Service',
    thDuration:  'Duration',
    thPrice:     'Price',
    edit:        'Edit',
    deactivate:  'Deactivate',
    inactiveHdr: 'Inactive services',
    reactivate:  'Re-enable',
    loading:     'Loading...',
    currency:    'EGP',
    durationUnit:'min',
  },
};

export default function ServicesPageWrapper() {
  return (
    <DashboardShell pageTitle="page_services">
      <ServicesPage />
    </DashboardShell>
  );
}

function ServicesPage() {
  const { dir, align, lang } = useLang();
  const c = COPY[lang];
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name_ar: '', name_en: '', price_egp: 0, duration_min: 30 });

  const { data, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => servicesApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => servicesApi.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['services'] }); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => servicesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['services'] }); resetForm(); },
  });

  const resetForm = () => {
    setForm({ name_ar: '', name_en: '', price_egp: 0, duration_min: 30 });
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (svc: any) => {
    setForm({ name_ar: svc.name_ar, name_en: svc.name_en ?? '', price_egp: Number(svc.price_egp), duration_min: svc.duration_min });
    setEditingId(svc.id);
    setShowForm(true);
  };

  const services: any[] = data?.services ?? [];
  const active   = services.filter((s) => s.is_active);
  const inactive = services.filter((s) => !s.is_active);
  const isEmpty  = !isLoading && active.length === 0 && !showForm;

  return (
    <div style={{ padding: '24px', fontFamily: 'Cairo, Inter, sans-serif', direction: dir, maxWidth: '900px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0F2044', margin: 0, textAlign: align }}>{c.title}</h2>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0', textAlign: align }}>{c.subtitle}</p>
        </div>
        {!isEmpty && (
          <button onClick={() => { resetForm(); setShowForm(true); }} style={btnPrimary}>
            {c.addBtn}
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div style={cardSt}>
          <h3 style={{ ...cardTitleSt, textAlign: align }}>{editingId ? c.formEdit : c.formNew}</h3>
          {editingId && (
            <div style={{ background: '#FFF8E1', border: '1px solid #F59E0B', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#92400E' }}>
              {c.priceWarn}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelSt}>{c.lblNameAr}</label>
              <input style={inputSt} value={form.name_ar} onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} placeholder={c.phNameAr} dir="rtl" />
            </div>
            <div>
              <label style={labelSt}>{c.lblNameEn}</label>
              <input style={inputSt} value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} placeholder={c.phNameEn} dir="ltr" />
            </div>
            <div>
              <label style={labelSt}>{c.lblPrice}</label>
              <input type="number" min={0} step={10} style={inputSt} value={form.price_egp} onChange={(e) => setForm((f) => ({ ...f, price_egp: Number(e.target.value) }))} />
            </div>
            <div>
              <label style={labelSt}>{c.lblDuration}</label>
              <input type="number" min={15} max={480} step={15} style={inputSt} value={form.duration_min} onChange={(e) => setForm((f) => ({ ...f, duration_min: Number(e.target.value) }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={resetForm} style={btnSecondary}>{c.cancel}</button>
            <button onClick={() => editingId ? updateMutation.mutate({ id: editingId, data: form }) : createMutation.mutate()}
              disabled={createMutation.isPending || updateMutation.isPending} style={btnPrimary}>
              {editingId ? c.saveEdit : c.save}
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '80px', color: '#6B7280' }}>{c.loading}</div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ width: '96px', height: '96px', borderRadius: '24px', background: 'linear-gradient(135deg, #E8F5F3 0%, #F0F7FF 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '44px', marginBottom: '24px' }}>
            📋
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0F2044', margin: '0 0 10px' }}>{c.emptyTitle}</h3>
          <p style={{ fontSize: '15px', color: '#6B7280', margin: '0 0 32px', maxWidth: '380px', lineHeight: '1.7' }}>{c.emptyDesc}</p>
          <button onClick={() => { resetForm(); setShowForm(true); }} style={{ ...btnPrimary, padding: '14px 32px', fontSize: '16px' }}>
            {c.addFirst}
          </button>
        </div>
      )}

      {/* Services table */}
      {!isLoading && active.length > 0 && (
        <>
          <div style={{ background: '#fff', borderRadius: '14px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F7F8FA' }}>
                  {[c.thService, c.thDuration, c.thPrice, ''].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: align, fontSize: '13px', fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.map((svc) => (
                  <tr key={svc.id} style={{ borderBottom: '1px solid #F0F0F0' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: '#0F2044' }}>{svc.name_ar}</div>
                      {svc.name_en && <div style={{ fontSize: '12px', color: '#9CA3AF' }}>{svc.name_en}</div>}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#6B7280', fontSize: '14px' }}>{svc.duration_min} {c.durationUnit}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '15px', color: '#0F2044' }}>{Number(svc.price_egp).toFixed(0)} {c.currency}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start' }}>
                        <button onClick={() => startEdit(svc)} style={{ padding: '6px 12px', background: '#F7F8FA', border: '1px solid #E5E7EB', borderRadius: '8px', fontFamily: 'Cairo, Inter, sans-serif', fontSize: '13px', color: '#0F2044', cursor: 'pointer' }}>{c.edit}</button>
                        <button onClick={() => updateMutation.mutate({ id: svc.id, data: { is_active: false } })} style={{ padding: '6px 12px', background: '#FEF2F2', border: 'none', borderRadius: '8px', fontFamily: 'Cairo, Inter, sans-serif', fontSize: '13px', color: '#D32F2F', cursor: 'pointer' }}>{c.deactivate}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {inactive.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#9CA3AF', marginBottom: '12px' }}>{c.inactiveHdr}</h3>
              {inactive.map((svc) => (
                <div key={svc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F7F8FA', borderRadius: '8px', marginBottom: '8px', opacity: 0.6 }}>
                  <span style={{ fontWeight: 600, color: '#0F2044' }}>{svc.name_ar}</span>
                  <button onClick={() => updateMutation.mutate({ id: svc.id, data: { is_active: true } })} style={{ padding: '5px 12px', background: '#E8F5F3', border: 'none', borderRadius: '6px', fontFamily: 'Cairo, Inter, sans-serif', fontSize: '12px', color: '#1B8A7A', cursor: 'pointer' }}>{c.reactivate}</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const cardSt: React.CSSProperties      = { background: '#fff', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: '24px' };
const cardTitleSt: React.CSSProperties = { fontWeight: 700, fontSize: '17px', color: '#0F2044', marginTop: 0, marginBottom: '16px' };
const labelSt: React.CSSProperties    = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '6px' };
const inputSt: React.CSSProperties    = { width: '100%', border: '1.5px solid #E5E7EB', borderRadius: '8px', padding: '10px 12px', fontFamily: 'Cairo, Inter, sans-serif', fontSize: '14px', color: '#0F2044', boxSizing: 'border-box' };
const btnPrimary: React.CSSProperties   = { padding: '10px 20px', background: '#1B8A7A', border: 'none', borderRadius: '10px', fontFamily: 'Cairo, Inter, sans-serif', fontSize: '14px', fontWeight: 700, color: '#fff', cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '10px 20px', background: '#F7F8FA', border: '1px solid #E5E7EB', borderRadius: '10px', fontFamily: 'Cairo, Inter, sans-serif', fontSize: '14px', fontWeight: 600, color: '#6B7280', cursor: 'pointer' };
