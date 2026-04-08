// ============================================================
// SUPER RESERVATION PLATFORM — Gaming Checkout (US-090–US-092)
// 5-step gaming cafe booking journey:
//   1. Station Type  → 2. Duration  → 3. Date & Time
//   → 4. Genre Preference (optional) → 5. Summary + countdown
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { searchApi, bookingApi } from '../../services/api';

const NAVY   = '#0F2044';
const PURPLE = '#6B21A8';
const GRAY   = '#9CA3AF';
const RED    = '#D32F2F';
const TOTAL_STEPS = 5;

// ── Station config ─────────────────────────────────────────

const STATION_OPTIONS = [
  { id: 'pc',         label: 'كمبيوتر PC',          emoji: '🖥️' },
  { id: 'console',    label: 'بلايستيشن',             emoji: '🎮' },
  { id: 'vr',         label: 'واقع افتراضي VR',       emoji: '🥽' },
  { id: 'group_room', label: 'غرفة جماعية',            emoji: '👥' },
];

const DURATION_OPTIONS = [
  { minutes: 60,  label: 'ساعة واحدة',  short: '١ ساعة'   },
  { minutes: 120, label: 'ساعتان',       short: '٢ ساعة'   },
  { minutes: 180, label: 'ثلاث ساعات',  short: '٣ ساعات'  },
];

const GENRE_OPTIONS = [
  { id: 'fps',    label: 'إطلاق نار FPS', emoji: '🔫' },
  { id: 'rpg',    label: 'أدوار RPG',      emoji: '⚔️' },
  { id: 'sports', label: 'رياضة',          emoji: '⚽' },
  { id: 'racing', label: 'سباق',           emoji: '🏎️' },
  { id: 'casual', label: 'كاجوال',         emoji: '🎲' },
  { id: 'horror', label: 'رعب',            emoji: '👻' },
  { id: 'moba',   label: 'موبا MOBA',      emoji: '🗺️' },
];

// ── State ─────────────────────────────────────────────────

interface GamingBookingState {
  stationType?: string;
  durationMinutes: number;
  selectedDate: string;
  selectedSlotId?: string;
  selectedSlot?: any;
  genrePreference?: string;
}

// ── Progress bar ──────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View key={i} style={[styles.progressSegment, i < step ? styles.progressDone : i === step - 1 ? styles.progressActive : {}]} />
      ))}
    </View>
  );
}

// ── Countdown ──────────────────────────────────────────────

function SlotCountdown({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const calc = () => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const [remaining, setRemaining] = useState(calc);

  useEffect(() => {
    const t = setInterval(() => {
      const s = calc();
      setRemaining(s);
      if (s === 0) { clearInterval(t); onExpire(); }
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const mins = Math.floor(remaining / 60).toString().padStart(2, '0');
  const secs = (remaining % 60).toString().padStart(2, '0');
  const urgent = remaining < 60;

  return (
    <View style={[styles.countdown, urgent && styles.countdownUrgent]}>
      <Ionicons name="time-outline" size={14} color={urgent ? RED : PURPLE} />
      <Text style={[styles.countdownText, urgent && styles.countdownUrgentText]}>
        الوقت المتبقي: {mins}:{secs}
      </Text>
    </View>
  );
}

// ── Date strip ────────────────────────────────────────────

function DateStrip({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
      {days.map((d, i) => {
        const iso = d.toISOString().slice(0, 10);
        const sel = iso === value;
        return (
          <TouchableOpacity key={iso} style={[styles.dateChip, sel && styles.dateChipSelected]} onPress={() => onChange(iso)}>
            <Text style={[styles.dateChipLabel, sel && styles.dateChipTextSelected]}>{i === 0 ? 'اليوم' : d.toLocaleDateString('ar-EG', { weekday: 'short' })}</Text>
            <Text style={[styles.dateChipDay, sel && styles.dateChipTextSelected]}>{d.getDate()}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ── Main screen ───────────────────────────────────────────

export default function GamingCheckoutScreen() {
  const { business_id } = useLocalSearchParams<{ business_id: string }>();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [booking, setBooking] = useState<GamingBookingState>({
    durationMinutes: 60,
    selectedDate: new Date().toISOString().slice(0, 10),
  });

  const [heldBooking, setHeldBooking] = useState<{
    booking_id: string;
    booking_ref: string;
    slot_hold_expires_at: string;
    total_amount_egp: number;
    deposit_amount_egp: number;
    platform_fee_egp: number;
    paymob_order_id: string;
  } | null>(null);

  const { data: business } = useQuery({
    queryKey: ['business', business_id],
    queryFn: () => searchApi.getBusiness(business_id).then((r) => r.data),
    enabled: !!business_id,
  });

  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['slots', business_id, booking.selectedDate, 1, booking.durationMinutes],
    queryFn: () => searchApi.getBusinessSlots(business_id, booking.selectedDate, 1).then((r) => r.data),
    enabled: step >= 3,
    refetchInterval: 2 * 60 * 1000,
  });

  const allSlots: any[] = slotsData?.slots ?? [];
  const slots = allSlots.filter((s: any) => s.duration_minutes === booking.durationMinutes);

  const createMutation = useMutation({
    mutationFn: () =>
      bookingApi.createBooking({
        slot_id: booking.selectedSlotId!,
        business_id,
        party_size: 1,
        station_type: booking.stationType,
        genre_preference: booking.genrePreference,
      }).then((r) => r.data),
    onSuccess: (data) => { setHeldBooking(data); setStep(5); },
    onError: (err: any) => {
      Alert.alert('خطأ', err?.response?.data?.error?.message_ar ?? 'حدث خطأ. حاول مجدداً.');
    },
  });

  const availableStations = business?.gaming_config?.station_types ?? STATION_OPTIONS.map((s) => s.id);
  const filteredStations = STATION_OPTIONS.filter((s) => availableStations.includes(s.id));

  const availableDurations = business?.gaming_config?.slot_duration_options
    ? DURATION_OPTIONS.filter((d) => business.gaming_config.slot_duration_options.includes(d.minutes))
    : DURATION_OPTIONS;

  const availableGenres = business?.gaming_config?.genre_options ?? GENRE_OPTIONS.map((g) => g.id);
  const filteredGenres = GENRE_OPTIONS.filter((g) => availableGenres.includes(g.id));

  function goBack() {
    if (step === 1) router.back();
    else setStep((s) => s - 1);
  }

  const stepTitle: Record<number, string> = {
    1: 'نوع المحطة',
    2: 'مدة الجلسة',
    3: 'اختار الموعد',
    4: 'نوع الألعاب',
    5: 'تأكيد الحجز',
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={22} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{stepTitle[step]}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ProgressBar step={step} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── Step 1: Station Type ── */}
        {step === 1 && (
          <View>
            <Text style={styles.stepLabel}>أي نوع محطة؟</Text>
            <View style={styles.stationGrid}>
              {filteredStations.map((st) => {
                const sel = booking.stationType === st.id;
                return (
                  <TouchableOpacity
                    key={st.id}
                    style={[styles.stationCard, sel && styles.stationCardSelected]}
                    onPress={() => setBooking((p) => ({ ...p, stationType: st.id }))}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.stationEmoji}>{st.emoji}</Text>
                    <Text style={[styles.stationLabel, sel && styles.stationLabelSelected]}>{st.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Step 2: Duration ── */}
        {step === 2 && (
          <View>
            <Text style={styles.stepLabel}>كم مدة الجلسة؟</Text>
            <View style={styles.durationList}>
              {availableDurations.map((dur) => {
                const sel = booking.durationMinutes === dur.minutes;
                const deposit = business?.next_available_slots?.[0]?.deposit_amount ?? 80;
                const estimate = Math.round((deposit * dur.minutes) / 60);
                return (
                  <TouchableOpacity
                    key={dur.minutes}
                    style={[styles.durationCard, sel && styles.durationCardSelected]}
                    onPress={() => setBooking((p) => ({ ...p, durationMinutes: dur.minutes }))}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.durationLabel, sel && styles.durationLabelSelected]}>{dur.label}</Text>
                    <Text style={[styles.durationDeposit, sel && styles.durationDepositSelected]}>مقدّم {estimate} ج.م</Text>
                    {sel && <Ionicons name="checkmark-circle" size={20} color="#fff" style={styles.durationCheck} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Step 3: Date & Time ── */}
        {step === 3 && (
          <View>
            <Text style={styles.stepLabel}>اختار اليوم</Text>
            <DateStrip value={booking.selectedDate} onChange={(d) => setBooking((p) => ({ ...p, selectedDate: d, selectedSlotId: undefined }))} />

            <Text style={[styles.stepLabel, { marginTop: 20 }]}>الوقت المناسب</Text>
            {slotsLoading ? (
              <Text style={styles.loadingText}>جاري التحميل...</Text>
            ) : slots.length === 0 ? (
              <Text style={styles.emptyText}>لا توجد محطات متاحة. جرّب يوم آخر.</Text>
            ) : (
              <View style={styles.slotsGrid}>
                {slots.map((slot: any) => {
                  const sel = booking.selectedSlotId === slot.id;
                  const time = new Date(slot.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' });
                  return (
                    <TouchableOpacity
                      key={slot.id}
                      style={[styles.slotChip, sel && styles.slotChipSelected]}
                      onPress={() => setBooking((p) => ({ ...p, selectedSlotId: slot.id, selectedSlot: slot }))}
                    >
                      <Text style={[styles.slotTime, sel && styles.slotTimeSelected]}>{time}</Text>
                      <Text style={[styles.slotDeposit, sel && styles.slotDepositSelected]}>{slot.deposit_amount} ج.م</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ── Step 4: Genre Preference (optional) ── */}
        {step === 4 && (
          <View>
            <Text style={styles.stepLabel}>تفضّل نوع ألعاب؟</Text>
            <Text style={styles.optionalNote}>اختياري — يساعدنا في تخصيص محطتك</Text>
            <View style={styles.genreGrid}>
              {filteredGenres.map((genre) => {
                const sel = booking.genrePreference === genre.id;
                return (
                  <TouchableOpacity
                    key={genre.id}
                    style={[styles.genreCard, sel && styles.genreCardSelected]}
                    onPress={() => setBooking((p) => ({ ...p, genrePreference: sel ? undefined : genre.id }))}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.genreEmoji}>{genre.emoji}</Text>
                    <Text style={[styles.genreLabel, sel && styles.genreLabelSelected]}>{genre.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Step 5: Summary ── */}
        {step === 5 && heldBooking && (
          <View>
            <SlotCountdown
              expiresAt={heldBooking.slot_hold_expires_at}
              onExpire={() => Alert.alert('انتهى وقت الحجز', 'نفدت المهلة. سيتم إعادتك للرئيسية.', [{ text: 'حسناً', onPress: () => router.push('/') }])}
            />

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{business?.name_ar}</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>نوع المحطة</Text>
                <Text style={styles.summaryVal}>
                  {STATION_OPTIONS.find((s) => s.id === booking.stationType)?.emoji}{' '}
                  {STATION_OPTIONS.find((s) => s.id === booking.stationType)?.label ?? booking.stationType}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>الموعد</Text>
                <Text style={styles.summaryVal}>
                  {booking.selectedSlot
                    ? new Date(booking.selectedSlot.start_time).toLocaleString('ar-EG', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' })
                    : '—'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>المدة</Text>
                <Text style={styles.summaryVal}>{DURATION_OPTIONS.find((d) => d.minutes === booking.durationMinutes)?.label}</Text>
              </View>
              {booking.genrePreference && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryKey}>نوع الألعاب</Text>
                  <Text style={styles.summaryVal}>{GENRE_OPTIONS.find((g) => g.id === booking.genrePreference)?.label}</Text>
                </View>
              )}
              <View style={[styles.summaryRow, styles.summaryDivider]}>
                <Text style={styles.summaryKey}>رقم الحجز</Text>
                <Text style={styles.summaryVal}>{heldBooking.booking_ref}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>المقدّم المطلوب</Text>
                <Text style={[styles.summaryVal, { color: PURPLE, fontFamily: 'Cairo-Bold', fontSize: 18 }]}>
                  {heldBooking.deposit_amount_egp} ج.م
                </Text>
              </View>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        {step < 4 && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: PURPLE }, (step === 1 && !booking.stationType) || (step === 3 && !booking.selectedSlotId) ? styles.btnDisabled : {}]}
            disabled={(step === 1 && !booking.stationType) || (step === 3 && !booking.selectedSlotId)}
            onPress={() => setStep((s) => s + 1)}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>التالي</Text>
          </TouchableOpacity>
        )}

        {step === 4 && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: PURPLE }, createMutation.isPending && styles.btnDisabled]}
            disabled={createMutation.isPending}
            onPress={() => createMutation.mutate()}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>{createMutation.isPending ? 'جاري الحجز...' : 'احجز المحطة'}</Text>
          </TouchableOpacity>
        )}

        {step === 5 && heldBooking && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: PURPLE }]}
            onPress={() => router.push({ pathname: '/booking/payment', params: { booking_id: heldBooking.booking_id, paymob_order_id: heldBooking.paymob_order_id, total_amount_egp: heldBooking.total_amount_egp, deposit_amount_egp: heldBooking.deposit_amount_egp } })}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>ادفع {heldBooking.deposit_amount_egp} ج.م</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 18, color: NAVY },
  progressContainer: { flexDirection: 'row-reverse', gap: 4, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#fff' },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' },
  progressDone: { backgroundColor: PURPLE },
  progressActive: { backgroundColor: PURPLE + 'AA' },
  content: { padding: 24, paddingBottom: 120 },
  stepLabel: { fontFamily: 'Cairo-Bold', fontSize: 17, color: NAVY, textAlign: 'right', marginBottom: 16 },
  optionalNote: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY, textAlign: 'right', marginTop: -10, marginBottom: 16 },

  // Station grid
  stationGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 },
  stationCard: { width: '47%', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB' },
  stationCardSelected: { borderColor: PURPLE, backgroundColor: PURPLE + '11' },
  stationEmoji: { fontSize: 36, marginBottom: 8 },
  stationLabel: { fontFamily: 'Cairo-SemiBold', fontSize: 14, color: NAVY },
  stationLabelSelected: { color: PURPLE },

  // Duration
  durationList: { gap: 12 },
  durationCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', paddingVertical: 18, paddingHorizontal: 20, gap: 12 },
  durationCardSelected: { borderColor: PURPLE, backgroundColor: PURPLE },
  durationLabel: { fontFamily: 'Cairo-Bold', fontSize: 16, color: NAVY, flex: 1, textAlign: 'right' },
  durationLabelSelected: { color: '#fff' },
  durationDeposit: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY },
  durationDepositSelected: { color: 'rgba(255,255,255,0.85)' },
  durationCheck: { marginRight: 4 },

  // Date
  dateChip: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, marginLeft: 8, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  dateChipSelected: { borderColor: PURPLE, backgroundColor: PURPLE },
  dateChipLabel: { fontFamily: 'Cairo-Regular', fontSize: 11, color: GRAY },
  dateChipDay: { fontFamily: 'Cairo-Bold', fontSize: 16, color: NAVY, marginTop: 2 },
  dateChipTextSelected: { color: '#fff' },

  // Slots
  slotsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  slotChip: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  slotChipSelected: { borderColor: PURPLE, backgroundColor: PURPLE },
  slotTime: { fontFamily: 'Cairo-Bold', fontSize: 15, color: NAVY },
  slotTimeSelected: { color: '#fff' },
  slotDeposit: { fontFamily: 'Cairo-Regular', fontSize: 12, color: GRAY, marginTop: 2 },
  slotDepositSelected: { color: 'rgba(255,255,255,0.85)' },

  // Genre
  genreGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  genreCard: { width: '47%', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB' },
  genreCardSelected: { borderColor: PURPLE, backgroundColor: PURPLE + '11' },
  genreEmoji: { fontSize: 28, marginBottom: 6 },
  genreLabel: { fontFamily: 'Cairo-SemiBold', fontSize: 13, color: NAVY, textAlign: 'center' },
  genreLabelSelected: { color: PURPLE },

  loadingText: { fontFamily: 'Cairo-Regular', fontSize: 14, color: GRAY, textAlign: 'center', paddingVertical: 20 },
  emptyText: { fontFamily: 'Cairo-Regular', fontSize: 14, color: GRAY, textAlign: 'center', paddingVertical: 20 },

  // Countdown
  countdown: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: PURPLE + '11', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  countdownUrgent: { backgroundColor: '#FEE2E2' },
  countdownText: { fontFamily: 'Cairo-SemiBold', fontSize: 14, color: PURPLE },
  countdownUrgentText: { color: RED },

  // Summary
  summaryCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  summaryTitle: { fontFamily: 'Cairo-Bold', fontSize: 20, color: NAVY, textAlign: 'right', marginBottom: 16 },
  summaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  summaryDivider: { borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 8, paddingTop: 16 },
  summaryKey: { fontFamily: 'Cairo-Regular', fontSize: 14, color: GRAY },
  summaryVal: { fontFamily: 'Cairo-SemiBold', fontSize: 14, color: NAVY, textAlign: 'right', flex: 1, marginRight: 12 },

  // Footer
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 20, paddingBottom: 34, borderTopWidth: 1, borderTopColor: '#F0F0F0', elevation: 6 },
  primaryBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { fontFamily: 'Cairo-Bold', fontSize: 18, color: '#fff' },
  btnDisabled: { opacity: 0.45 },
});
