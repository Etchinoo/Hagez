// ============================================================
// SUPER RESERVATION PLATFORM — Booking Calendar Component
// US-053: Day/Week views. RTL. Color-coded statuses. Block slots.
// US-055: Booking detail modal — notes, tap-to-call, mark status.
// ============================================================

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsApi, slotsApi, bookingNotesApi } from '@/services/api';
import { useLang } from '@/lib/i18n';
import { format, addDays, startOfWeek } from 'date-fns';
import { ar } from 'date-fns/locale';

type View = 'day' | 'week';

const STATUS_CONFIG_AR: Record<string, { label: string; bg: string; text: string; border: string }> = {
  confirmed:             { label: 'مؤكد',         bg: '#E8F5F3', text: '#1B8A7A', border: '#1B8A7A' },
  pending_payment:       { label: 'انتظار الدفع', bg: '#FFF8E1', text: '#F59E0B', border: '#F59E0B' },
  completed:             { label: 'مكتمل',         bg: '#F0F0F0', text: '#6B7280', border: '#9CA3AF' },
  cancelled_by_consumer: { label: 'ملغي (عميل)',  bg: '#FEF2F2', text: '#D32F2F', border: '#FECACA' },
  cancelled_by_business: { label: 'ملغي (محل)',   bg: '#FEF2F2', text: '#D32F2F', border: '#FECACA' },
  no_show:               { label: 'غياب',          bg: '#FEF2F2', text: '#D32F2F', border: '#FECACA' },
  disputed:              { label: 'نزاع',          bg: '#FFF3CD', text: '#92400E', border: '#F59E0B' },
};

const STATUS_CONFIG_EN: Record<string, { label: string; bg: string; text: string; border: string }> = {
  confirmed:             { label: 'Confirmed',       bg: '#E8F5F3', text: '#1B8A7A', border: '#1B8A7A' },
  pending_payment:       { label: 'Pending payment', bg: '#FFF8E1', text: '#F59E0B', border: '#F59E0B' },
  completed:             { label: 'Completed',       bg: '#F0F0F0', text: '#6B7280', border: '#9CA3AF' },
  cancelled_by_consumer: { label: 'Cancelled (guest)',bg: '#FEF2F2', text: '#D32F2F', border: '#FECACA' },
  cancelled_by_business: { label: 'Cancelled (biz)', bg: '#FEF2F2', text: '#D32F2F', border: '#FECACA' },
  no_show:               { label: 'No show',         bg: '#FEF2F2', text: '#D32F2F', border: '#FECACA' },
  disputed:              { label: 'Disputed',        bg: '#FFF3CD', text: '#92400E', border: '#F59E0B' },
};

const COPY = {
  ar: {
    day:            'يوم',
    week:           'أسبوع',
    today:          'اليوم',
    loading:        'جاري التحميل...',
    noBookings:     'لا توجد حجوزات لهذا اليوم',
    bookingCount:   'حجز',
    guests:         'أشخاص',
    availableSlots: 'المواعيد المتاحة — منع الحجز',
    blockSlot:      'منع الحجز 🔒',
    modalTime:      'الوقت',
    modalGuests:    'عدد الأشخاص',
    modalOccasion:  'المناسبة',
    modalDeposit:   'الإيداع',
    egp:            'ج.م',
    modalRequests:  'طلبات خاصة',
    modalContact:   'التواصل',
    callBtn:        '📞 اتصال',
    modalNotes:     'ملاحظات داخلية',
    notesPlaceholder:'ملاحظاتك الخاصة — غير مرئية للعميل',
    notesLoading:   'جاري الحفظ...',
    notesSave:      'حفظ الملاحظات',
    markNoShow:     'تسجيل غياب',
    markComplete:   'تأكيد الحضور ✅',
    locale:         'ar-EG',
    dateFnsLocale:  'ar',
  },
  en: {
    day:            'Day',
    week:           'Week',
    today:          'Today',
    loading:        'Loading...',
    noBookings:     'No bookings for this day',
    bookingCount:   'bookings',
    guests:         'guests',
    availableSlots: 'Available slots — Block booking',
    blockSlot:      'Block 🔒',
    modalTime:      'Time',
    modalGuests:    'Party size',
    modalOccasion:  'Occasion',
    modalDeposit:   'Deposit',
    egp:            'EGP',
    modalRequests:  'Special requests',
    modalContact:   'Contact',
    callBtn:        '📞 Call',
    modalNotes:     'Internal notes',
    notesPlaceholder:'Your private notes — not visible to the guest',
    notesLoading:   'Saving...',
    notesSave:      'Save notes',
    markNoShow:     'Mark no-show',
    markComplete:   'Confirm attended ✅',
    locale:         'en-US',
    dateFnsLocale:  'en',
  },
};

// ── Booking Detail Modal (US-055) ────────────────────────────

function BookingDetailModal({
  booking,
  onClose,
  onStatusUpdate,
  c,
  STATUS_CONFIG,
  dir,
}: {
  booking: any;
  onClose: () => void;
  onStatusUpdate: (id: string, status: 'completed' | 'no_show') => void;
  c: typeof COPY.ar;
  STATUS_CONFIG: typeof STATUS_CONFIG_AR;
  dir: 'rtl' | 'ltr';
}) {
  const [notes, setNotes] = useState<string>(booking.internal_notes ?? '');
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const saveNotes = async () => {
    setSaving(true);
    try {
      await bookingNotesApi.save(booking.id, notes);
      qc.invalidateQueries({ queryKey: ['business-bookings'] });
    } finally {
      setSaving(false);
    }
  };

  const startTime = booking.slot?.start_time ? new Date(booking.slot.start_time) : null;
  const endTime = booking.slot?.end_time ? new Date(booking.slot.end_time) : null;
  const sc = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG['confirmed'];
  const phone = booking.consumer?.phone ?? '';
  const maskedPhone = phone.length > 6
    ? phone.slice(0, 4) + '****' + phone.slice(-3)
    : phone;
  const dateLocale = dir === 'rtl' ? ar : undefined;

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={{ ...modalStyles.panel, direction: dir }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={modalStyles.header}>
          <button style={modalStyles.closeBtn} onClick={onClose}>✕</button>
          <div>
            <div style={modalStyles.headerRef}>{booking.booking_ref}</div>
            <div style={modalStyles.headerGuest}>{booking.consumer?.full_name}</div>
          </div>
          <span style={{ ...modalStyles.statusBadge, background: sc.bg, color: sc.text, border: `1.5px solid ${sc.border}` }}>
            {sc.label}
          </span>
        </div>

        <div style={modalStyles.body}>
          {/* Booking info grid */}
          <div style={modalStyles.infoGrid}>
            {startTime && (
              <div style={modalStyles.infoItem}>
                <div style={modalStyles.infoLabel}>{c.modalTime}</div>
                <div style={modalStyles.infoValue}>
                  {format(startTime, 'h:mm a', { locale: dateLocale })}
                  {endTime ? ` — ${format(endTime, 'h:mm a', { locale: dateLocale })}` : ''}
                </div>
              </div>
            )}
            <div style={modalStyles.infoItem}>
              <div style={modalStyles.infoLabel}>{c.modalGuests}</div>
              <div style={modalStyles.infoValue}>{booking.party_size}</div>
            </div>
            {booking.occasion && (
              <div style={modalStyles.infoItem}>
                <div style={modalStyles.infoLabel}>{c.modalOccasion}</div>
                <div style={modalStyles.infoValue}>{booking.occasion}</div>
              </div>
            )}
            <div style={modalStyles.infoItem}>
              <div style={modalStyles.infoLabel}>{c.modalDeposit}</div>
              <div style={modalStyles.infoValue}>{Number(booking.deposit_amount ?? 0).toFixed(0)} {c.egp}</div>
            </div>
          </div>

          {/* Special requests */}
          {booking.special_requests && (
            <div style={modalStyles.section}>
              <div style={modalStyles.sectionTitle}>{c.modalRequests}</div>
              <div style={modalStyles.sectionText}>{booking.special_requests}</div>
            </div>
          )}

          {/* Contact (masked phone + tap-to-call) */}
          <div style={modalStyles.section}>
            <div style={modalStyles.sectionTitle}>{c.modalContact}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: dir === 'rtl' ? 'flex-end' : 'flex-start' }}>
              <a href={`tel:${phone}`} style={modalStyles.callBtn}>
                {c.callBtn}
              </a>
              <span style={modalStyles.sectionText}>{maskedPhone}</span>
            </div>
          </div>

          {/* Internal notes */}
          <div style={modalStyles.section}>
            <div style={modalStyles.sectionTitle}>{c.modalNotes}</div>
            <textarea
              style={{ ...modalStyles.notesInput, direction: dir }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={c.notesPlaceholder}
              rows={3}
              maxLength={1000}
            />
            <button style={modalStyles.saveNotesBtn} onClick={saveNotes} disabled={saving}>
              {saving ? c.notesLoading : c.notesSave}
            </button>
          </div>

          {/* Actions */}
          {booking.status === 'confirmed' && (
            <div style={modalStyles.actions}>
              <button
                style={modalStyles.noShowActionBtn}
                onClick={() => { onStatusUpdate(booking.id, 'no_show'); onClose(); }}
              >
                {c.markNoShow}
              </button>
              <button
                style={modalStyles.completeActionBtn}
                onClick={() => { onStatusUpdate(booking.id, 'completed'); onClose(); }}
              >
                {c.markComplete}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Calendar Component ──────────────────────────────────

export default function BookingCalendar() {
  const { dir, lang } = useLang();
  const c = COPY[lang];
  const STATUS_CONFIG = lang === 'ar' ? STATUS_CONFIG_AR : STATUS_CONFIG_EN;
  const dateLocale = lang === 'ar' ? ar : undefined;

  const [view, setView] = useState<View>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const queryClient = useQueryClient();

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['business-bookings', dateStr, view],
    queryFn: () => bookingsApi.list(dateStr, view).then((r) => r.data),
    refetchInterval: 30_000,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'completed' | 'no_show' }) =>
      bookingsApi.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['business-bookings'] }),
  });

  const blockSlot = useMutation({
    mutationFn: (slotId: string) => slotsApi.block(slotId, 'منع من لوحة التحكم'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['business-bookings'] }),
  });

  const bookings: any[] = data?.bookings ?? [];
  const slots: any[] = data?.slots ?? [];

  const weekDays = view === 'week'
    ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selectedDate, { weekStartsOn: 5 }), i))
    : [selectedDate];

  const navigateDate = (direction: -1 | 1) => {
    const step = view === 'week' ? 7 : 1;
    setSelectedDate((d) => addDays(d, direction * step));
  };

  return (
    <div style={{ ...styles.container, direction: dir }}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.navButtons}>
          <button style={styles.navBtn} onClick={() => navigateDate(dir === 'rtl' ? 1 : -1)}>◀</button>
          <span style={styles.dateLabel}>
            {format(selectedDate, view === 'day' ? 'EEEE، d MMMM yyyy' : 'MMMM yyyy', { locale: dateLocale })}
          </span>
          <button style={styles.navBtn} onClick={() => navigateDate(dir === 'rtl' ? -1 : 1)}>▶</button>
        </div>
        <div style={styles.viewToggle}>
          {(['day', 'week'] as const).map((v) => (
            <button
              key={v}
              style={{ ...styles.viewBtn, ...(view === v ? styles.viewBtnActive : {}) }}
              onClick={() => setView(v)}
            >
              {v === 'day' ? c.day : c.week}
            </button>
          ))}
        </div>
        <button style={styles.todayBtn} onClick={() => setSelectedDate(new Date())}>{c.today}</button>
      </div>

      {/* Calendar Content */}
      {isLoading ? (
        <div style={styles.loading}>{c.loading}</div>
      ) : (
        <div style={styles.grid}>
          {view === 'week' && (
            <div style={styles.weekHeaders}>
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  style={{
                    ...styles.weekDayHeader,
                    ...(format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                      ? styles.weekDayHeaderToday : {}),
                  }}
                  onClick={() => { setSelectedDate(day); setView('day'); }}
                >
                  <span style={styles.weekDayName}>{format(day, 'EEEE', { locale: dateLocale })}</span>
                  <span style={styles.weekDayNum}>{format(day, 'd')}</span>
                  <span style={styles.weekDayCount}>
                    {bookings.filter((b) => {
                      const s = b.slot?.start_time;
                      return s && format(new Date(s), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
                    }).length} {c.bookingCount}
                  </span>
                </div>
              ))}
            </div>
          )}

          {bookings.length === 0 ? (
            <div style={styles.emptyState}>
              <span style={styles.emptyEmoji}>📅</span>
              <p style={styles.emptyText}>{c.noBookings}</p>
            </div>
          ) : (
            <div style={styles.bookingsList}>
              {bookings.map((booking: any) => {
                const sc = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG['confirmed'];
                const startTime = booking.slot?.start_time ? new Date(booking.slot.start_time) : null;

                return (
                  <div
                    key={booking.id}
                    style={{ ...styles.bookingCard, backgroundColor: sc.bg, borderInlineStart: `4px solid ${sc.border}` }}
                    onClick={() => setSelectedBooking(booking)}
                  >
                    <div style={styles.bookingTime}>
                      {startTime ? format(startTime, 'h:mm a', { locale: dateLocale }) : '—'}
                    </div>
                    <div style={styles.bookingInfo}>
                      <div style={styles.bookingGuest}>{booking.consumer?.full_name}</div>
                      <div style={styles.bookingDetails}>
                        {booking.party_size} {c.guests}
                        {booking.occasion ? ` · ${booking.occasion}` : ''}
                      </div>
                      {booking.special_requests && (
                        <div style={styles.specialReq}>💬 {booking.special_requests}</div>
                      )}
                      <div style={styles.bookingRef}>{booking.booking_ref}</div>
                    </div>
                    <div style={styles.bookingActions}>
                      <span style={{ ...styles.statusBadge, color: sc.text }}>{sc.label}</span>
                      {booking.status === 'confirmed' && (
                        <div style={styles.actionButtons} onClick={(e) => e.stopPropagation()}>
                          <button
                            style={styles.completeBtn}
                            onClick={() => updateStatus.mutate({ id: booking.id, status: 'completed' })}
                          >
                            {c.markComplete}
                          </button>
                          <button
                            style={styles.noShowBtn}
                            onClick={() => updateStatus.mutate({ id: booking.id, status: 'no_show' })}
                          >
                            {c.markNoShow}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Available slots that can be blocked */}
          {view === 'day' && slots.filter((s: any) => s.status === 'available').length > 0 && (
            <div style={styles.slotsSection}>
              <div style={styles.slotsSectionTitle}>{c.availableSlots}</div>
              <div style={styles.slotsList}>
                {slots
                  .filter((s: any) => s.status === 'available')
                  .map((slot: any) => (
                    <div key={slot.id} style={styles.slotRow}>
                      <span style={styles.slotTime}>
                        {format(new Date(slot.start_time), 'h:mm a', { locale: dateLocale })}
                      </span>
                      <button
                        style={styles.blockBtn}
                        onClick={() => blockSlot.mutate(slot.id)}
                        disabled={blockSlot.isPending}
                      >
                        {c.blockSlot}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onStatusUpdate={(id, status) => {
            updateStatus.mutate({ id, status });
            setSelectedBooking(null);
          }}
          c={c}
          STATUS_CONFIG={STATUS_CONFIG}
          dir={dir}
        />
      )}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: { flex: 1, display: 'flex', flexDirection: 'column', height: '100%' },
  toolbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 24px', backgroundColor: '#fff', borderBottom: '1px solid #E5E7EB',
    flexWrap: 'wrap', gap: '12px',
  },
  navButtons: { display: 'flex', alignItems: 'center', gap: '12px' },
  navBtn: { background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '14px' },
  dateLabel: { fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '18px', color: '#0F2044' },
  viewToggle: { display: 'flex', border: '1.5px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' },
  viewBtn: { padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: 600, color: '#6B7280' },
  viewBtnActive: { background: '#0F2044', color: '#fff' },
  todayBtn: { padding: '8px 16px', background: '#1B8A7A', border: 'none', borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: 700, color: '#fff', cursor: 'pointer' },
  grid: { flex: 1, overflow: 'auto', padding: '16px' },
  weekHeaders: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '16px' },
  weekDayHeader: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px',
    background: '#F7F8FA', borderRadius: '10px', cursor: 'pointer', gap: '2px',
    border: '1.5px solid #E5E7EB',
  },
  weekDayHeaderToday: { background: '#E8F5F3', border: '1.5px solid #1B8A7A' },
  weekDayName: { fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#6B7280' },
  weekDayNum: { fontFamily: 'Cairo, sans-serif', fontSize: '20px', fontWeight: 700, color: '#0F2044' },
  weekDayCount: { fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#9CA3AF' },
  loading: { display: 'flex', justifyContent: 'center', padding: '48px', fontFamily: 'Cairo, sans-serif', fontSize: '16px', color: '#6B7280' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' },
  emptyEmoji: { fontSize: '48px', marginBottom: '16px' },
  emptyText: { fontFamily: 'Cairo, sans-serif', fontSize: '18px', color: '#6B7280' },
  bookingsList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  bookingCard: {
    display: 'flex', alignItems: 'flex-start', padding: '16px', borderRadius: '12px',
    gap: '16px', cursor: 'pointer',
    transition: 'transform 0.1s, box-shadow 0.1s',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  bookingTime: { fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '15px', color: '#0F2044', minWidth: '72px', textAlign: 'center' },
  bookingInfo: { flex: 1 },
  bookingGuest: { fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '16px', color: '#0F2044' },
  bookingDetails: { fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#6B7280', marginTop: '2px' },
  specialReq: { fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#9CA3AF', marginTop: '4px' },
  bookingRef: { fontFamily: 'monospace', fontSize: '11px', color: '#9CA3AF', marginTop: '4px' },
  bookingActions: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' },
  statusBadge: { fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 600 },
  actionButtons: { display: 'flex', gap: '8px' },
  completeBtn: { padding: '6px 12px', background: '#1B8A7A', border: 'none', borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 700, color: '#fff', cursor: 'pointer' },
  noShowBtn: { padding: '6px 12px', background: '#FEE2E2', border: 'none', borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 600, color: '#D32F2F', cursor: 'pointer' },
  slotsSection: { marginTop: '24px', borderTop: '1px solid #E5E7EB', paddingTop: '16px' },
  slotsSectionTitle: { fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 700, color: '#6B7280', marginBottom: '12px' },
  slotsList: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  slotRow: { display: 'flex', alignItems: 'center', gap: '10px', background: '#F7F8FA', padding: '8px 14px', borderRadius: '10px', border: '1px solid #E5E7EB' },
  slotTime: { fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: 600, color: '#0F2044' },
  blockBtn: { padding: '4px 10px', background: 'none', border: '1px solid #D32F2F', borderRadius: '6px', fontFamily: 'Cairo, sans-serif', fontSize: '12px', color: '#D32F2F', cursor: 'pointer' },
};

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  panel: {
    background: '#fff', borderRadius: '20px', width: '480px', maxWidth: '95vw',
    maxHeight: '90vh', overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 24px',
    borderBottom: '1px solid #E5E7EB',
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer',
    color: '#9CA3AF', padding: '4px', marginInlineStart: 'auto',
  },
  headerRef: { fontFamily: 'monospace', fontSize: '12px', color: '#9CA3AF' },
  headerGuest: { fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '20px', color: '#0F2044' },
  statusBadge: { padding: '4px 12px', borderRadius: '20px', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' },
  body: { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  infoItem: { background: '#F7F8FA', borderRadius: '10px', padding: '12px 14px' },
  infoLabel: { fontFamily: 'Cairo, sans-serif', fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' },
  infoValue: { fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '15px', color: '#0F2044' },
  section: { display: 'flex', flexDirection: 'column', gap: '8px' },
  sectionTitle: { fontFamily: 'Cairo, sans-serif', fontSize: '12px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' },
  sectionText: { fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#0F2044' },
  callBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: '#E8F5F3', color: '#1B8A7A', padding: '8px 14px', borderRadius: '10px',
    textDecoration: 'none', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 700,
  },
  notesInput: {
    width: '100%', border: '1.5px solid #E5E7EB', borderRadius: '10px',
    padding: '10px 12px', fontFamily: 'Cairo, sans-serif', fontSize: '14px',
    color: '#0F2044', resize: 'vertical', boxSizing: 'border-box',
  },
  saveNotesBtn: {
    alignSelf: 'flex-end', padding: '8px 20px', background: '#0F2044', border: 'none',
    borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 700,
    color: '#fff', cursor: 'pointer',
  },
  actions: { display: 'flex', gap: '12px', borderTop: '1px solid #E5E7EB', paddingTop: '16px' },
  completeActionBtn: {
    flex: 1, padding: '14px', background: '#1B8A7A', border: 'none', borderRadius: '12px',
    fontFamily: 'Cairo, sans-serif', fontSize: '15px', fontWeight: 700, color: '#fff', cursor: 'pointer',
  },
  noShowActionBtn: {
    flex: 1, padding: '14px', background: '#FEF2F2', border: '1.5px solid #FECACA',
    borderRadius: '12px', fontFamily: 'Cairo, sans-serif', fontSize: '15px', fontWeight: 700,
    color: '#D32F2F', cursor: 'pointer',
  },
};
