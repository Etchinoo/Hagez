// ============================================================
// SUPER RESERVATION PLATFORM — Booking Calendar Component
// Day/Week views. RTL layout. Tablet-first (1024px).
// Columns = time blocks, Rows = slots/resources.
// ============================================================

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsApi } from '@/services/api';
import { format, addDays, startOfWeek } from 'date-fns';
import { ar } from 'date-fns/locale';

type View = 'day' | 'week';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  confirmed:             { label: 'مؤكد', bg: '#E8F5F3', text: '#1B8A7A' },
  pending_payment:       { label: 'انتظار الدفع', bg: '#FFF8E1', text: '#F59E0B' },
  completed:             { label: 'مكتمل', bg: '#F0F0F0', text: '#6B7280' },
  cancelled_by_consumer: { label: 'ملغي', bg: '#FEE2E2', text: '#D32F2F' },
  no_show:               { label: 'غياب', bg: '#FEE2E2', text: '#D32F2F' },
};

export default function BookingCalendar() {
  const [view, setView] = useState<View>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const queryClient = useQueryClient();

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['business-bookings', dateStr, view],
    queryFn: () => bookingsApi.list(dateStr, view).then((r) => r.data),
    refetchInterval: 30_000, // Auto-refresh every 30 seconds
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'completed' | 'no_show' }) =>
      bookingsApi.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['business-bookings'] }),
  });

  const bookings: any[] = data?.bookings ?? [];

  const weekDays = view === 'week'
    ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selectedDate, { weekStartsOn: 5 }), i))
    : [selectedDate];

  const navigateDate = (direction: -1 | 1) => {
    const step = view === 'week' ? 7 : 1;
    setSelectedDate((d) => addDays(d, direction * step));
  };

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.navButtons}>
          <button style={styles.navBtn} onClick={() => navigateDate(-1)}>◀</button>
          <span style={styles.dateLabel}>
            {format(selectedDate, view === 'day' ? 'EEEE، d MMMM yyyy' : 'MMMM yyyy', { locale: ar })}
          </span>
          <button style={styles.navBtn} onClick={() => navigateDate(1)}>▶</button>
        </div>
        <div style={styles.viewToggle}>
          {(['day', 'week'] as const).map((v) => (
            <button
              key={v}
              style={{ ...styles.viewBtn, ...(view === v ? styles.viewBtnActive : {}) }}
              onClick={() => setView(v)}
            >
              {v === 'day' ? 'يوم' : 'أسبوع'}
            </button>
          ))}
        </div>
        <button style={styles.todayBtn} onClick={() => setSelectedDate(new Date())}>
          اليوم
        </button>
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div style={styles.loading}>جاري التحميل...</div>
      ) : (
        <div style={styles.grid}>
          {/* Week day headers */}
          {view === 'week' && (
            <div style={styles.weekHeaders}>
              {weekDays.map((day) => (
                <div key={day.toISOString()} style={styles.weekDayHeader}>
                  <span style={styles.weekDayName}>{format(day, 'EEEE', { locale: ar })}</span>
                  <span style={styles.weekDayNum}>{format(day, 'd')}</span>
                </div>
              ))}
            </div>
          )}

          {/* Bookings */}
          {bookings.length === 0 ? (
            <div style={styles.emptyState}>
              <span style={styles.emptyEmoji}>📅</span>
              <p style={styles.emptyText}>لا توجد حجوزات لهذا اليوم</p>
            </div>
          ) : (
            <div style={styles.bookingsList}>
              {bookings.map((booking: any) => {
                const statusConfig = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG['confirmed'];
                const startTime = new Date(booking.slot?.start_time);

                return (
                  <div key={booking.id} style={{ ...styles.bookingCard, backgroundColor: statusConfig.bg }}>
                    <div style={styles.bookingTime}>
                      {format(startTime, 'h:mm a', { locale: ar })}
                    </div>
                    <div style={styles.bookingInfo}>
                      <div style={styles.bookingGuest}>{booking.consumer?.full_name}</div>
                      <div style={styles.bookingDetails}>
                        {booking.party_size} أشخاص
                        {booking.occasion ? ` · ${booking.occasion}` : ''}
                        {booking.special_requests ? ` · ${booking.special_requests}` : ''}
                      </div>
                      <div style={styles.bookingRef}>{booking.booking_ref}</div>
                    </div>
                    <div style={styles.bookingActions}>
                      <span style={{ ...styles.statusBadge, color: statusConfig.text }}>
                        {statusConfig.label}
                      </span>
                      {booking.status === 'confirmed' && (
                        <div style={styles.actionButtons}>
                          <button
                            style={styles.completeBtn}
                            onClick={() => updateStatus.mutate({ id: booking.id, status: 'completed' })}
                          >
                            حضر ✅
                          </button>
                          <button
                            style={styles.noShowBtn}
                            onClick={() => updateStatus.mutate({ id: booking.id, status: 'no_show' })}
                          >
                            غياب
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  weekDayHeader: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px', background: '#F0F0F0', borderRadius: '8px' },
  weekDayName: { fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#6B7280' },
  weekDayNum: { fontFamily: 'Cairo, sans-serif', fontSize: '20px', fontWeight: 700, color: '#0F2044' },
  loading: { display: 'flex', justifyContent: 'center', padding: '48px', fontFamily: 'Cairo, sans-serif', fontSize: '16px', color: '#6B7280' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' },
  emptyEmoji: { fontSize: '48px', marginBottom: '16px' },
  emptyText: { fontFamily: 'Cairo, sans-serif', fontSize: '18px', color: '#6B7280' },
  bookingsList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  bookingCard: { display: 'flex', alignItems: 'flex-start', padding: '16px', borderRadius: '12px', gap: '16px', direction: 'rtl' },
  bookingTime: { fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '16px', color: '#0F2044', minWidth: '80px', textAlign: 'center' },
  bookingInfo: { flex: 1 },
  bookingGuest: { fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '16px', color: '#0F2044' },
  bookingDetails: { fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#6B7280', marginTop: '4px' },
  bookingRef: { fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#9CA3AF', marginTop: '4px' },
  bookingActions: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' },
  statusBadge: { fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 600 },
  actionButtons: { display: 'flex', gap: '8px' },
  completeBtn: { padding: '6px 12px', background: '#1B8A7A', border: 'none', borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 700, color: '#fff', cursor: 'pointer' },
  noShowBtn: { padding: '6px 12px', background: '#FEE2E2', border: 'none', borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 600, color: '#D32F2F', cursor: 'pointer' },
};
