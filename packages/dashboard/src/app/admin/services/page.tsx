// ============================================================
// SUPER RESERVATION PLATFORM — Admin: Service Catalog
// Admin-managed service templates per business category.
// Defines which services a business can offer.
// Pricing is controlled entirely by each business owner.
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '@/services/api';

type Category = 'restaurant' | 'salon' | 'court' | 'gaming_cafe' | 'car_wash' | 'medical';

interface CatalogItem {
  id: string;
  category: Category;
  name_ar: string;
  name_en: string | null;
  typical_duration_min: number;
  is_active: boolean;
}

interface FormState {
  category: string;
  name_ar: string;
  name_en: string;
  typical_duration_min: string;
}

const CATEGORIES: { value: Category | 'all'; label: string }[] = [
  { value: 'all',         label: 'All'           },
  { value: 'restaurant',  label: 'Restaurant'    },
  { value: 'salon',       label: 'Beauty Salon'  },
  { value: 'court',       label: 'Sports Court'  },
  { value: 'gaming_cafe', label: 'Gaming Cafe'   },
  { value: 'car_wash',    label: 'Car Wash'      },
  { value: 'medical',     label: 'Medical Clinic'},
];

const CATEGORY_LABEL: Record<string, string> = {
  restaurant: 'Restaurant', salon: 'Beauty Salon', court: 'Sports Court',
  gaming_cafe: 'Gaming Cafe', car_wash: 'Car Wash', medical: 'Medical Clinic',
};

const EMPTY_FORM: FormState = {
  category: 'restaurant',
  name_ar: '',
  name_en: '',
  typical_duration_min: '30',
};

// Dynamic placeholder examples per category
const PLACEHOLDER_AR: Record<string, string> = {
  restaurant:  'مثال: وجبة رئيسية للشخصين',
  salon:       'مثال: قص شعر سيدات',
  court:       'مثال: حجز ملعب باديل',
  gaming_cafe: 'مثال: جلسة PC ساعتين',
  car_wash:    'مثال: غسيل خارجي كامل',
  medical:     'مثال: استشارة عامة',
};
const PLACEHOLDER_EN: Record<string, string> = {
  restaurant:  "e.g. Set menu for 2",
  salon:       "e.g. Women's Haircut",
  court:       "e.g. Padel court booking",
  gaming_cafe: "e.g. 2-hour PC session",
  car_wash:    "e.g. Full exterior wash",
  medical:     "e.g. General consultation",
};

export default function ServiceCatalogPage() {
  const [filter, setFilter]         = useState<Category | 'all'>('all');
  const [items, setItems]           = useState<CatalogItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [feedback, setFeedback]     = useState('');
  const [modal, setModal]           = useState<{ mode: 'create' | 'edit'; item?: CatalogItem } | null>(null);
  const [form, setForm]             = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<CatalogItem | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = filter === 'all' ? '/admin/services' : `/admin/services?category=${filter}`;
      const res = await dashboardApi.get<{ items: CatalogItem[] }>(endpoint);
      setItems(res.data.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, category: filter === 'all' ? 'restaurant' : filter });
    setModal({ mode: 'create' });
  };

  const openEdit = (item: CatalogItem) => {
    setForm({
      category:             item.category,
      name_ar:              item.name_ar,
      name_en:              item.name_en ?? '',
      typical_duration_min: String(item.typical_duration_min),
    });
    setModal({ mode: 'edit', item });
  };

  const handleSave = async () => {
    if (!form.name_ar.trim() || !form.typical_duration_min) return;
    setSubmitting(true);
    try {
      const payload = {
        category:             form.category,
        name_ar:              form.name_ar.trim(),
        name_en:              form.name_en.trim() || null,
        typical_duration_min: parseInt(form.typical_duration_min),
      };
      if (modal?.mode === 'create') {
        await dashboardApi.post('/admin/services', payload);
        setFeedback(`✅ "${payload.name_ar}" added to catalog`);
      } else if (modal?.item) {
        await dashboardApi.patch(`/admin/services/${modal.item.id}`, payload);
        setFeedback(`✅ "${payload.name_ar}" updated`);
      }
      setModal(null);
      fetchItems();
    } catch {
      setFeedback('❌ Failed to save. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (item: CatalogItem) => {
    try {
      await dashboardApi.patch(`/admin/services/${item.id}`, { is_active: !item.is_active });
      setFeedback(`✅ ${item.name_ar} ${!item.is_active ? 'activated' : 'deactivated'}`);
      fetchItems();
    } catch {
      setFeedback('❌ Toggle failed.');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await dashboardApi.delete(`/admin/services/${deleteConfirm.id}`);
      setFeedback(`✅ "${deleteConfirm.name_ar}" deleted`);
      setDeleteConfirm(null);
      fetchItems();
    } catch {
      setFeedback('❌ Delete failed.');
    }
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Service Catalog</h1>
          <p style={s.subtitle}>Define available services per category. Business owners assign their own pricing.</p>
        </div>
        <button style={s.addBtn} onClick={openCreate}>+ Add Service</button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{ ...s.feedback, background: feedback.startsWith('✅') ? '#ECFDF5' : '#FEE2E2', color: feedback.startsWith('✅') ? '#065F46' : '#B91C1C' }}>
          {feedback}
          <button style={s.fbClose} onClick={() => setFeedback('')}>×</button>
        </div>
      )}

      {/* Category filter pills */}
      <div style={s.filters}>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            style={{ ...s.pill, ...(filter === c.value ? s.pillActive : {}) }}
            onClick={() => setFilter(c.value as any)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={s.loader}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={s.empty}>No services in catalog{filter !== 'all' ? ` for ${CATEGORY_LABEL[filter]}` : ''}.</div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Service (Arabic)</th>
                <th style={s.th}>English</th>
                <th style={s.th}>Category</th>
                <th style={s.th}>Default Duration</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={!item.is_active ? s.rowInactive : undefined}>
                  <td style={s.td}>
                    <span style={{ fontWeight: 600, color: '#0F2044' }}>{item.name_ar}</span>
                  </td>
                  <td style={s.td}>{item.name_en ?? <span style={{ color: '#9CA3AF' }}>—</span>}</td>
                  <td style={s.td}>{CATEGORY_LABEL[item.category] ?? item.category}</td>
                  <td style={s.td}>{item.typical_duration_min} min</td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, background: item.is_active ? '#ECFDF5' : '#F3F4F6', color: item.is_active ? '#065F46' : '#6B7280' }}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={s.editBtn} onClick={() => openEdit(item)}>Edit</button>
                      <button style={{ ...s.toggleBtn, color: item.is_active ? '#92400E' : '#065F46' }} onClick={() => handleToggle(item)}>
                        {item.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button style={s.deleteBtn} onClick={() => setDeleteConfirm(item)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h2 style={s.modalTitle}>
              {modal.mode === 'create' ? 'Add Catalog Service' : 'Edit Catalog Service'}
            </h2>

            <div style={s.formGrid}>
              <label style={s.label}>Category *</label>
              <select style={s.input} value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.filter((c) => c.value !== 'all').map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>

              <label style={s.label}>Name (Arabic) *</label>
              <input style={s.input} value={form.name_ar} dir="rtl"
                placeholder={PLACEHOLDER_AR[form.category] ?? 'e.g. اسم الخدمة'}
                onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} />

              <label style={s.label}>Name (English)</label>
              <input style={s.input} value={form.name_en}
                placeholder={PLACEHOLDER_EN[form.category] ?? 'e.g. Service name'}
                onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} />

              <label style={s.label}>Default Duration (minutes) *</label>
              <input style={s.input} type="number" min="5" step="5" value={form.typical_duration_min}
                onChange={(e) => setForm((f) => ({ ...f, typical_duration_min: e.target.value }))} />
            </div>

            <div style={s.modalActions}>
              <button style={s.cancelBtn} onClick={() => setModal(null)}>Cancel</button>
              <button
                style={{ ...s.saveBtn, opacity: submitting || !form.name_ar.trim() ? 0.6 : 1 }}
                disabled={submitting || !form.name_ar.trim()}
                onClick={handleSave}
              >
                {submitting ? 'Saving…' : modal.mode === 'create' ? 'Add Service' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: 400 }}>
            <h2 style={s.modalTitle}>Delete Service</h2>
            <p style={{ fontSize: 14, color: '#374151', margin: '8px 0 20px' }}>
              Are you sure you want to permanently delete <strong>{deleteConfirm.name_ar}</strong>?
            </p>
            <div style={s.modalActions}>
              <button style={s.cancelBtn} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button style={s.confirmDeleteBtn} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:       { padding: '32px', fontFamily: 'Inter, sans-serif', maxWidth: 1200, margin: '0 auto' },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', gap: 16 },
  title:      { fontSize: '24px', fontWeight: 700, color: '#0F2044', margin: 0 },
  subtitle:   { fontSize: 13, color: '#6B7280', margin: '4px 0 0' },
  addBtn:     { padding: '9px 20px', background: '#0F2044', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', flexShrink: 0 },
  feedback:   { padding: '12px 16px', borderRadius: 8, fontSize: 14, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  fbClose:    { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'inherit' },
  filters:    { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' as const },
  pill:       { padding: '7px 16px', borderRadius: 20, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6B7280' },
  pillActive: { background: '#0F2044', color: '#fff', borderColor: '#0F2044' },
  loader:     { color: '#6B7280', fontSize: 14 },
  empty:      { color: '#9CA3AF', fontSize: 14, padding: '40px', textAlign: 'center' },
  tableWrap:  { overflowX: 'auto', background: '#fff', borderRadius: 12, border: '1.5px solid #E5E7EB' },
  table:      { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th:         { padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: '#6B7280', borderBottom: '1.5px solid #E5E7EB', background: '#F9FAFB', textTransform: 'uppercase', letterSpacing: '0.05em' },
  td:         { padding: '12px 16px', borderBottom: '1px solid #F3F4F6', verticalAlign: 'middle' },
  rowInactive:{ opacity: 0.6 },
  badge:      { display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 },
  editBtn:    { padding: '5px 12px', background: '#EFF6FF', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#1D4ED8', cursor: 'pointer' },
  toggleBtn:  { padding: '5px 12px', background: '#FEF3C7', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  deleteBtn:  { padding: '5px 12px', background: '#FEE2E2', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#B91C1C', cursor: 'pointer' },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal:      { background: '#fff', borderRadius: 16, padding: '32px', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#0F2044', margin: '0 0 20px' },
  formGrid:   { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 },
  label:      { fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 2 },
  input:      { width: '100%', padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#0F2044', boxSizing: 'border-box' },
  modalActions:     { display: 'flex', gap: 12, justifyContent: 'flex-end' },
  cancelBtn:        { padding: '9px 20px', background: '#F3F4F6', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer' },
  saveBtn:          { padding: '9px 24px', background: '#0F2044', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer' },
  confirmDeleteBtn: { padding: '9px 20px', background: '#DC2626', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer' },
};
