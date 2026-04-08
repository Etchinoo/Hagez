// ============================================================
// SUPER RESERVATION PLATFORM — Court Checkout (US-082–US-084)
// 5-step court booking journey:
//   1. Sport Type  → 2. Duration  → 3. Date/Time + Players
//   → 4. Equipment → 5. Summary + 8-min countdown
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { searchApi, bookingApi } from '../../services/api';

const NAVY = '#0F2044';
const TEAL = '#1B8A7A';
const GREEN = '#2E7D32';
const GRAY = '#9CA3AF';
const RED = '#D32F2F';
const TOTAL_STEPS = 5;

// ── Sport config ──────────────────────────────────────────────

const SPORT_OPTIONS = [
  { id: 'football',   label: 'كرة القدم',  emoji: '⚽' },
  { id: 'basketball', label: 'كرة السلة',  emoji: '🏀' },
  { id: 'tennis',     label: 'تنس',         emoji: '🎾' },
  { id: 'padel',      label: 'بادل',        emoji: '🏸' },
  { id: 'squash',     label: 'إسكواش',      emoji: '🟡' },
  { id: 'volleyball', label: 'كرة الطائرة', emoji: '🏐' },
];

const DURATION_OPTIONS = [
  { minutes: 60,  label: 'ساعة واحدة',       short: '١ ساعة'     },
  { minutes: 90,  label: 'ساعة ونصف',         short: '١.٥ ساعة'   },
  { minutes: 120, label: 'ساعتان',             short: '٢ ساعة'     },
];

const EQUIPMENT_LABELS: Record<string, string> = {
  balls:  'كرات',
  bibs:   'قمصان تدريب',
  cones:  'أقماع',
  vests:  'صدريات',
  water:  'مياه',
};

// ── State types ───────────────────────────────────────────────

interface CourtBookingState {
  sportType?: string;
  durationMinutes: number;
  selectedDate: string;
  selectedSlotId?: string;
  selectedSlot?: any;
  playerCount: number;
  equipmentRental: string[];
}

// ── Progress bar ──────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressSegment,
            i < step ? styles.progressDone : i === step - 1 ? styles.progressActive : {},
          ]}
        />
      ))}
    </View>
  );
}

// ── Countdown (US-019) ────────────────────────────────────────

function SlotCountdown({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const calcRemaining = () => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const [remaining, setRemaining] = useState(calcRemaining);

  useEffect(() => {
    const interval = setInterval(() => {
      const secs = calcRemaining();
      setRemaining(secs);
      if (secs === 0) { clearInterval(interval); onExpire(); }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const mins = Math.floor(remaining / 60).toString().padStart(2, '0');
  const secs = (remaining % 60).toString().padStart(2, '0');
  const urgent = remaining < 60;

  return (
    <View style={[styles.countdown, urgent && styles.countdownUrgent]}>
      <Ionicons name="time-outline" size={14} color={urgent ? RED : GREEN} />
      <Text style={[styles.countdownText, urgent && styles.countdownUrgentText]}>
        الوقت المتبقي: {mins}:{secs}
      </Text>
    </View>
  );
}

// ── Date strip ────────────────────────────────────────────────

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
        const selected = iso === value;
        return (
          <TouchableOpacity
            key={iso}
            style={[styles.dateChip, selected && styles.dateChipSelected]}
            onPress={() => onChange(iso)}
          >
            <Text style={[styles.dateChipLabel, selected && styles.dateChipTextSelected]}>
              {i === 0 ? 'اليوم' : d.toLocaleDateString('ar-EG', { weekday: 'short' })}
            </Text>
            <Text style={[styles.dateChipDay, selected && styles.dateChipTextSelected]}>
              {d.getDate()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ── Main screen ───────────────────────────────────────────────

export default function CourtCheckoutScreen() {
  const { business_id } = useLocalSearchParams<{ business_id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [booking, setBooking] = useState<CourtBookingState>({
    durationMinutes: 60,
    selectedDate: new Date().toISOString().slice(0, 10),
    playerCount: 2,
    equipmentRental: [],
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

  // Business data (incl. court_config)
  const { data: business } = useQuery({
    queryKey: ['business', business_id],
    queryFn: () => searchApi.getBusiness(business_id).then((r) => r.data),
    enabled: !!business_id,
  });

  // Slot availability — filtered by duration (step 3)
  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['slots', business_id, booking.selectedDate, booking.playerCount, booking.durationMinutes],
    queryFn: () =>
      searchApi.getBusinessSlots(business_id, booking.selectedDate, booking.playerCount).then((r) => r.data),
    enabled: step >= 3,
    refetchInterval: 2 * 60 * 1000,
  });

  // Filter slots to those matching the chosen duration
  const allSlots: any[] = slotsData?.slots ?? [];
  const slots = allSlots.filter((s: any) => s.duration_minutes === booking.durationMinutes);

  // Create booking mutation
  const createMutation = useMutation({
    mutationFn: () =>
      bookingApi.createBooking({
        slot_id: booking.selectedSlotId!,
        business_id,
        party_size: booking.playerCount,
        sport_type: booking.sportType,
        equipment_rental: booking.equipmentRental,
      }).then((r) => r.data),
    onSuccess: (data) => {
      setHeldBooking(data);
      setStep(5);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message_ar ?? 'حدث خطأ. حاول مجدداً.';
      Alert.alert('خطأ', msg);
    },
  });

  const availableSports = business?.court_config?.sport_types ?? SPORT_OPTIONS.map((s) => s.id);
  const filteredSports = SPORT_OPTIONS.filter((s) => availableSports.includes(s.id));

  const availableDurations = business?.court_config?.slot_duration_options
    ? DURATION_OPTIONS.filter((d) => business.court_config.slot_duration_options.includes(d.minutes))
    : DURATION_OPTIONS;

  const availableEquipment: string[] = business?.court_config?.equipment_available ?? [];

  function toggleEquipment(item: string) {
    setBooking((prev) => ({
      ...prev,
      equipmentRental: prev.equipmentRental.includes(item)
        ? prev.equipmentRental.filter((e) => e !== item)
        : [...prev.equipmentRental, item],
    }));
  }

  function goBack() {
    if (step === 1) router.back();
    else setStep((s) => s - 1);
  }

  function handlePay() {
    router.push({
      pathname: '/booking/payment',
      params: {
        booking_id: heldBooking!.booking_id,
        paymob_order_id: heldBooking!.paymob_order_id,
        total_amount_egp: heldBooking!.total_amount_egp,
        deposit_amount_egp: heldBooking!.deposit_amount_egp,
      },
    });
  }

  const stepTitle: Record<number, string> = {
    1: 'اختار الرياضة',
    2: 'مدة الحجز',
    3: 'الموعد والعدد',
    4: 'المعدات',
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

        {/* ── Step 1: Sport Type ── */}
        {step === 1 && (
          <View>
            <Text style={styles.stepLabel}>أي رياضة؟</Text>
            <View style={styles.sportGrid}>
              {filteredSports.map((sport) => {
                const selected = booking.sportType === sport.id;
                return (
                  <TouchableOpacity
                    key={sport.id}
                    style={[styles.sportCard, selected && styles.sportCardSelected]}
                    onPress={() => setBooking((p) => ({ ...p, sportType: sport.id }))}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.sportEmoji}>{sport.emoji}</Text>
                    <Text style={[styles.sportLabel, selected && styles.sportLabelSelected]}>
                      {sport.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Step 2: Duration ── */}
        {step === 2 && (
          <View>
            <Text style={styles.stepLabel}>كم مدة الحجز؟</Text>
            <View style={styles.durationList}>
              {availableDurations.map((dur) => {
                const selected = booking.durationMinutes === dur.minutes;
                const depositPerHour = business?.next_available_slots?.[0]?.deposit_amount ?? 150;
                const estimatedDeposit = Math.round((depositPerHour * dur.minutes) / 60);
                return (
                  <TouchableOpacity
                    key={dur.minutes}
                    style={[styles.durationCard, selected && styles.durationCardSelected]}
                    onPress={() => setBooking((p) => ({ ...p, durationMinutes: dur.minutes }))}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.durationLabel, selected && styles.durationLabelSelected]}>
                      {dur.label}
                    </Text>
                    <Text style={[styles.durationDeposit, selected && styles.durationDepositSelected]}>
                      مقدّم {estimatedDeposit} ج.م
                    </Text>
                    {selected && <Ionicons name="checkmark-circle" size={20} color="#fff" style={styles.durationCheck} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Step 3: Date / Time / Players ── */}
        {step === 3 && (
          <View>
            <Text style={styles.stepLabel}>اختار اليوم</Text>
            <DateStrip value={booking.selectedDate} onChange={(d) => setBooking((p) => ({ ...p, selectedDate: d, selectedSlotId: undefined }))} />

            <Text style={[styles.stepLabel, { marginTop: 20 }]}>الوقت المناسب</Text>
            {slotsLoading ? (
              <Text style={styles.loadingText}>جاري التحميل...</Text>
            ) : slots.length === 0 ? (
              <Text style={styles.emptyText}>لا توجد مواعيد متاحة بهذه المدة. جرّب يوم آخر.</Text>
            ) : (
              <View style={styles.slotsGrid}>
                {slots.map((slot: any) => {
                  const selected = booking.selectedSlotId === slot.id;
                  const time = new Date(slot.start_time).toLocaleTimeString('ar-EG', {
                    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo',
                  });
                  return (
                    <TouchableOpacity
                      key={slot.id}
                      style={[styles.slotChip, selected && styles.slotChipSelected]}
                      onPress={() => setBooking((p) => ({ ...p, selectedSlotId: slot.id, selectedSlot: slot }))}
                    >
                      <Text style={[styles.slotTime, selected && styles.slotTimeSelected]}>{time}</Text>
                      <Text style={[styles.slotDeposit, selected && styles.slotDepositSelected]}>
                        {slot.deposit_amount} ج.م
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={[styles.stepLabel, { marginTop: 24 }]}>عدد اللاعبين</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setBooking((p) => ({ ...p, playerCount: Math.max(1, p.playerCount - 1) }))}
              >
                <Ionicons name="remove" size={20} color={NAVY} />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{booking.playerCount}</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setBooking((p) => ({ ...p, playerCount: Math.min(22, p.playerCount + 1) }))}
              >
                <Ionicons name="add" size={20} color={NAVY} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Step 4: Equipment ── */}
        {step === 4 && (
          <View>
            <Text style={styles.stepLabel}>المعدات المتاحة مجاناً</Text>
            {availableEquipment.length === 0 ? (
              <Text style={styles.emptyText}>لا توجد معدات متاحة في هذا الملعب.</Text>
            ) : (
              availableEquipment.map((item) => {
                const checked = booking.equipmentRental.includes(item);
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.equipRow, checked && styles.equipRowChecked]}
                    onPress={() => toggleEquipment(item)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                    <Text style={styles.equipLabel}>{EQUIPMENT_LABELS[item] ?? item}</Text>
                    <View style={styles.freeTag}>
                      <Text style={styles.freeTagText}>مجاناً</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
            <Text style={styles.equipNote}>يمكنك تخطي هذه الخطوة إذا لم تحتج معدات</Text>
          </View>
        )}

        {/* ── Step 5: Summary ── */}
        {step === 5 && heldBooking && (
          <View>
            {/* Countdown */}
            <SlotCountdown
              expiresAt={heldBooking.slot_hold_expires_at}
              onExpire={() => {
                Alert.alert('انتهى وقت الحجز', 'نفدت المهلة. سيتم إعادتك للبحث.', [
                  { text: 'حسناً', onPress: () => router.push('/') },
                ]);
              }}
            />

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{business?.name_ar}</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>الرياضة</Text>
                <Text style={styles.summaryVal}>
                  {SPORT_OPTIONS.find((s) => s.id === booking.sportType)?.label ?? booking.sportType}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>الموعد</Text>
                <Text style={styles.summaryVal}>
                  {booking.selectedSlot
                    ? new Date(booking.selectedSlot.start_time).toLocaleString('ar-EG', {
                        weekday: 'short', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo',
                      })
                    : '—'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>المدة</Text>
                <Text style={styles.summaryVal}>
                  {DURATION_OPTIONS.find((d) => d.minutes === booking.durationMinutes)?.label}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>اللاعبون</Text>
                <Text style={styles.summaryVal}>{booking.playerCount} لاعب</Text>
              </View>
              {booking.equipmentRental.length > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryKey}>المعدات</Text>
                  <Text style={styles.summaryVal}>
                    {booking.equipmentRental.map((e) => EQUIPMENT_LABELS[e] ?? e).join('، ')}
                  </Text>
                </View>
              )}
              <View style={[styles.summaryRow, styles.summaryDivider]}>
                <Text style={styles.summaryKey}>رقم الحجز</Text>
                <Text style={styles.summaryVal}>{heldBooking.booking_ref}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>المقدّم المطلوب</Text>
                <Text style={[styles.summaryVal, { color: GREEN, fontFamily: 'Cairo-Bold', fontSize: 18 }]}>
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
            style={[
              styles.primaryBtn,
              { backgroundColor: GREEN },
              (step === 1 && !booking.sportType) ||
              (step === 3 && !booking.selectedSlotId)
                ? styles.btnDisabled : {},
            ]}
            disabled={
              (step === 1 && !booking.sportType) ||
              (step === 3 && !booking.selectedSlotId)
            }
            onPress={() => setStep((s) => s + 1)}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>التالي</Text>
          </TouchableOpacity>
        )}

        {step === 4 && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: GREEN }, createMutation.isPending && styles.btnDisabled]}
            disabled={createMutation.isPending}
            onPress={() => createMutation.mutate()}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>
              {createMutation.isPending ? 'جاري الحجز...' : 'احجز الملعب'}
            </Text>
          </TouchableOpacity>
        )}

        {step === 5 && heldBooking && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: GREEN }]}
            onPress={handlePay}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>ادفع {heldBooking.deposit_amount_egp} ج.م</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },

  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 18, color: NAVY },

  progressContainer: { flexDirection: 'row-reverse', gap: 4, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#fff' },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' },
  progressDone: { backgroundColor: GREEN },
  progressActive: { backgroundColor: GREEN + 'AA' },

  content: { padding: 24, paddingBottom: 120 },

  stepLabel: { fontFamily: 'Cairo-Bold', fontSize: 17, color: NAVY, textAlign: 'right', marginBottom: 16 },

  // Sport grid
  sportGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 },
  sportCard: {
    width: '47%',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  sportCardSelected: { borderColor: GREEN, backgroundColor: GREEN + '11' },
  sportEmoji: { fontSize: 36, marginBottom: 8 },
  sportLabel: { fontFamily: 'Cairo-SemiBold', fontSize: 14, color: NAVY },
  sportLabelSelected: { color: GREEN },

  // Duration
  durationList: { gap: 12 },
  durationCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 12,
  },
  durationCardSelected: { borderColor: GREEN, backgroundColor: GREEN },
  durationLabel: { fontFamily: 'Cairo-Bold', fontSize: 16, color: NAVY, flex: 1, textAlign: 'right' },
  durationLabelSelected: { color: '#fff' },
  durationDeposit: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY },
  durationDepositSelected: { color: 'rgba(255,255,255,0.85)' },
  durationCheck: { marginRight: 4 },

  // Date strip
  dateChip: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, marginLeft: 8, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  dateChipSelected: { borderColor: GREEN, backgroundColor: GREEN },
  dateChipLabel: { fontFamily: 'Cairo-Regular', fontSize: 11, color: GRAY },
  dateChipDay: { fontFamily: 'Cairo-Bold', fontSize: 16, color: NAVY, marginTop: 2 },
  dateChipTextSelected: { color: '#fff' },

  // Slots
  slotsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  slotChip: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  slotChipSelected: { borderColor: GREEN, backgroundColor: GREEN },
  slotTime: { fontFamily: 'Cairo-Bold', fontSize: 15, color: NAVY },
  slotTimeSelected: { color: '#fff' },
  slotDeposit: { fontFamily: 'Cairo-Regular', fontSize: 12, color: GRAY, marginTop: 2 },
  slotDepositSelected: { color: 'rgba(255,255,255,0.85)' },

  // Stepper
  stepper: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 8 },
  stepperBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  stepperValue: { fontFamily: 'Cairo-Bold', fontSize: 28, color: NAVY, minWidth: 40, textAlign: 'center' },

  // Equipment
  equipRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10 },
  equipRowChecked: { borderColor: GREEN },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: GREEN, borderColor: GREEN },
  equipLabel: { fontFamily: 'Cairo-SemiBold', fontSize: 15, color: NAVY, flex: 1, textAlign: 'right' },
  freeTag: { backgroundColor: '#DCFCE7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  freeTagText: { fontFamily: 'Cairo-SemiBold', fontSize: 11, color: '#166534' },
  equipNote: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY, textAlign: 'center', marginTop: 12 },

  loadingText: { fontFamily: 'Cairo-Regular', fontSize: 14, color: GRAY, textAlign: 'center', paddingVertical: 20 },
  emptyText: { fontFamily: 'Cairo-Regular', fontSize: 14, color: GRAY, textAlign: 'center', paddingVertical: 20 },

  // Countdown
  countdown: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: GREEN + '11', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  countdownUrgent: { backgroundColor: '#FEE2E2' },
  countdownText: { fontFamily: 'Cairo-SemiBold', fontSize: 14, color: GREEN },
  countdownUrgentText: { color: RED },

  // Summary
  summaryCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  summaryTitle: { fontFamily: 'Cairo-Bold', fontSize: 20, color: NAVY, textAlign: 'right', marginBottom: 16 },
  summaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  summaryDivider: { borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 8, paddingTop: 16 },
  summaryKey: { fontFamily: 'Cairo-Regular', fontSize: 14, color: GRAY },
  summaryVal: { fontFamily: 'Cairo-SemiBold', fontSize: 14, color: NAVY, textAlign: 'right', flex: 1, marginRight: 12 },

  // Footer
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 20, paddingBottom: 34, borderTopWidth: 1, borderTopColor: '#F0F0F0', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 6 },
  primaryBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { fontFamily: 'Cairo-Bold', fontSize: 18, color: '#fff' },
  btnDisabled: { opacity: 0.45 },
});
