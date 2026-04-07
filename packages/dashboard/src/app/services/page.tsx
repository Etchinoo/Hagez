// ============================================================
// SUPER RESERVATION PLATFORM — Service Menu Page (US-058)
// Add / edit / deactivate services (salon treatments, etc.).
// Price changes are forward-only (existing bookings grandfathered).
// ============================================================

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { servicesApi } from '@/services/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function ServicesPageWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <ServicesPage />
    </QueryClientProvider>
  );
}

function ServicesPage() {
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
  const active = services.filter((s) => s.is_active);
  const inactive = services.filter((s) => !s.is_active);

  return (
    <div style={{ padding: '24px', fontFamily: 'Cairo, sans-serif', direction: 'rtl', maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0F2044', margin: 0 }}>قائمة الخدمات</h2>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0' }}>إدارة خدمات ومعالجات صالونك</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} style={btnPrimary}>
          + إضافة خدمة
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={cardSt}>
          <h3 style={cardTitleSt}>{editingId ? 'تعديل الخدمة' : 'خدمة جديدة'}</h3>
          {editingId && (
            <div style={{ background: '#FFF8E1', border: '1px solid #F59E0B', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#92400E' }}>
              ⚠️ تغيير السعر يؤثر على الحجوزات الجديدة فقط — الحجوزات الحالية لن تتأثر.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelSt}>الاسم بالعربية *</label>
              <input style={inputSt} value={form.name_ar} onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} placeholder="مثال: قص وتصفيف" />
            </div>
            <div>
              <label style={labelSt}>الاسم بالإنجليزية</label>
              <input style={inputSt} value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} placeholder="Haircut & Style" dir="ltr" />
            </div>
            <div>
              <label style={labelSt}>السعر (ج.م)</label>
              <input type="number" min={0} step={10} style={inputSt} value={form.price_egp} onChange={(e) => setForm((f) => ({ ...f, price_egp: Number(e.target.value) }))} />
            </div>
            <div>
              <label style={labelSt}>المدة (دقيقة)</label>
              <input type="number" min={15} max={480} step={15} style={inputSt} value={form.duration_min} onChange={(e) => setForm((f) => ({ ...f, duration_min: Number(e.target.value) }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={resetForm} style={btnSecondary}>إلغاء</button>
            <button onClick={() => editingId ? updateMutation.mutate({ id: editingId, data: form }) : createMutation.mutate()} style={btnPrimary}>
              {editingId ? 'حفظ التعديلات' : 'إضافة الخدمة'}
            </button>
          </div>
        </div>
      )}

      {/* Services list */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#6B7280' }}>جاري التحميل...</div>
      ) : active.length === 0 && !showForm ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>✂️</div>
          <div style={{ fontSize: '16px' }}>لم تضف أي خدمات بعد</div>
        </div>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F7F8FA' }}>
                {['الخدمة', 'المدة', 'السعر', ''].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
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
                  <td style={{ padding: '14px 16px', color: '#6B7280', fontSize: '14px' }}>{svc.duration_min} دقيقة</td>
                  <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '15px', color: '#0F2044' }}>{Number(svc.price_egp).toFixed(0)} ج.م</td>
                  <td style={{ padding: '14px 16px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => startEdit(svc)} style={{ padding: '6px 12px', background: '#F7F8FA', border: '1px solid #E5E7EB', borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#0F2044', cursor: 'pointer' }}>تعديل</button>
                      <button onClick={() => updateMutation.mutate({ id: svc.id, data: { is_active: false } })} style={{ padding: '6px 12px', background: '#FEF2F2', border: 'none', borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#D32F2F', cursor: 'pointer' }}>تعطيل</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {inactive.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#9CA3AF', marginBottom: '12px' }}>خدمات معطّلة</h3>
              {inactive.map((svc) => (
                <div key={svc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F7F8FA', borderRadius: '8px', marginBottom: '8px', opacity: 0.6 }}>
                  <span style={{ fontWeight: 600, color: '#0F2044' }}>{svc.name_ar}</span>
                  <button onClick={() => updateMutation.mutate({ id: svc.id, data: { is_active: true } })} style={{ padding: '5px 12px', background: '#E8F5F3', border: 'none', borderRadius: '6px', fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#1B8A7A', cursor: 'pointer' }}>إعادة تفعيل</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const cardSt: React.CSSProperties = { background: '#fff', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: '24px' };
const cardTitleSt: React.CSSProperties = { fontWeight: 700, fontSize: '17px', color: '#0F2044', marginTop: 0, marginBottom: '16px' };
const labelSt: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '6px' };
const inputSt: React.CSSProperties = { width: '100%', border: '1.5px solid #E5E7EB', borderRadius: '8px', padding: '10px 12px', fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#0F2044', boxSizing: 'border-box' };
const btnPrimary: React.CSSProperties = { padding: '10px 20px', background: '#1B8A7A', border: 'none', borderRadius: '10px', fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: 700, color: '#fff', cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '10px 20px', background: '#F7F8FA', border: '1px solid #E5E7EB', borderRadius: '10px', fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: 600, color: '#6B7280', cursor: 'pointer' };
