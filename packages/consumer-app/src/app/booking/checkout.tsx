// ============================================================
// SUPER RESERVATION PLATFORM — Booking Checkout (US-017 + US-019)
// 6-step restaurant journey + 8-min slot hold countdown.
// Steps: Occasion → Party size → Date/Time → Section →
//        Special requests → Summary → Confirm
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Modal, FlatList, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { searchApi, bookingApi } from '../../services/api';

const NAVY = '#0F2044';
const TEAL = '#1B8A7A';
const ORANGE = '#D4622A';
const GRAY = '#9CA3AF';
const RED = '#D32F2F';

// ── Types ─────────────────────────────────────────────────────

interface BookingState {
  occasion?: string;
  partySize: number;
  selectedDate: string;
  selectedSlotId?: string;
  selectedSlot?: any;
  sectionPreference?: string;
  specialRequests: string;
  overrideConsumerOverlap: boolean;
}

// ── Constants ─────────────────────────────────────────────────

const OCCASIONS = [
  { id: 'casual',      label: 'عادي', emoji: '😊' },
  { id: 'birthday',    label: 'عيد ميلاد', emoji: '🎂' },
  { id: 'anniversary', label: 'ذكرى سنوية', emoji: '💍' },
  { id: 'business',    label: 'اجتماع عمل', emoji: '💼' },
];

const SECTIONS = [
  { id: 'any',     label: 'أي مكان' },
  { id: 'indoor',  label: 'داخلي' },
  { id: 'outdoor', label: 'خارجي' },
  { id: 'private', label: 'خاص / VIP' },
];

const TOTAL_STEPS = 6;

// ── Step progress bar ─────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressSegment,
            i < step ? styles.progressSegmentDone : i === step - 1 ? styles.progressSegmentActive : {},
          ]}
        />
      ))}
    </View>
  );
}

// ── Countdown timer (US-019) ──────────────────────────────────

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
      <Ionicons name="time-outline" size={14} color={urgent ? RED : TEAL} />
      <Text style={[styles.countdownText, urgent && styles.countdownTextUrgent]}>
        الوقت المتبقي: {mins}:{secs}
      </Text>
    </View>
  );
}

// ── Date picker ───────────────────────────────────────────────

function DateStrip({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
      {days.map((d) => {
        const iso = d.toISOString().slice(0, 10);
        const selected = iso === value;
        const label = i === 0
          ? 'اليوم'
          : d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' });
        const i = days.indexOf(d);
        return (
          <TouchableOpacity
            key={iso}
            style={[styles.dateChip, selected && styles.dateChipSelected]}
            onPress={() => onChange(iso)}
          >
            <Text style={[styles.dateChipText, selected && styles.dateChipTextSelected]}>
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

export default function CheckoutScreen() {
  const { business_id, slot_id: preselectedSlotId } = useLocalSearchParams<{
    business_id: string;
    slot_id?: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [booking, setBooking] = useState<BookingState>({
    partySize: 2,
    selectedDate: new Date().toISOString().slice(0, 10),
    selectedSlotId: preselectedSlotId,
    specialRequests: '',
    overrideConsumerOverlap: false,
  });

  // Held booking state (after POST /bookings)
  const [heldBooking, setHeldBooking] = useState<{
    booking_id: string;
    booking_ref: string;
    slot_hold_expires_at: string;
    total_amount_egp: number;
    deposit_amount_egp: number;
    platform_fee_egp: number;
    paymob_order_id: string;
  } | null>(null);

  // Business data
  const { data: business } = useQuery({
    queryKey: ['business', business_id],
    queryFn: () => searchApi.getBusiness(business_id).then((r) => r.data),
    enabled: !!business_id,
  });

  // Slot availability for selected date
  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['slots', business_id, booking.selectedDate, booking.partySize],
    queryFn: () =>
      searchApi.getBusinessSlots(business_id, booking.selectedDate, booking.partySize).then((r) => r.data),
    enabled: step >= 3,
    // Auto-refresh every 2 minutes (US-016)
    refetchInterval: 2 * 60 * 1000,
  });

  const slots = slotsData?.slots ?? [];

  // Create booking mutation
  const createMutation = useMutation({
    mutationFn: () =>
      bookingApi.createBooking({
        slot_id: booking.selectedSlotId!,
        business_id,
        party_size: booking.partySize,
        occasion: booking.occasion,
        special_requests: booking.specialRequests || undefined,
        section_preference: booking.sectionPreference,
        override_consumer_overlap: booking.overrideConsumerOverlap,
      }).then((r) => r.data),
    onSuccess: (data) => {
      setHeldBooking(data);
      setStep(6);
    },
    onError: (err: any) => {
      const code = err.response?.data?.error?.code;
      if (code === 'CONSUMER_OVERLAP') {
        Alert.alert(
          'تنبيه',
          err.response.data.error.message_ar,
          [
            { text: 'إلغاء', style: 'cancel' },
            {
              text: 'تأكيد المتابعة',
              onPress: () => {
                setBooking((prev) => ({ ...prev, overrideConsumerOverlap: true }));
                createMutation.mutate();
              },
            },
          ]
        );
        return;
      }
      const msg = err.response?.data?.error?.message_ar ?? 'حدث خطأ. حاول مرة أخرى.';
      Alert.alert('خطأ', msg);
    },
  });

  function handleSlotExpired() {
    Alert.alert(
      'انتهى الوقت ⏰',
      'انتهت مدة الحجز المؤقت. يُرجى اختيار وقت آخر.',
      [{ text: 'اختر وقتًا آخر', onPress: () => { setHeldBooking(null); setStep(3); } }]
    );
  }

  function goNext() { setStep((s) => Math.min(s + 1, TOTAL_STEPS)); }
  function goBack() {
    if (step === 1) { router.back(); return; }
    setStep((s) => s - 1);
  }

  function canProceed(): boolean {
    switch (step) {
      case 1: return true; // occasion is optional
      case 2: return booking.partySize >= 1;
      case 3: return !!booking.selectedSlotId;
      case 4: return true; // section is optional
      case 5: return true; // special requests optional
      default: return false;
    }
  }

  const accentColor = business?.category === 'salon' ? '#C2185B' : ORANGE;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={22} color={NAVY} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {business?.name_ar ?? '...'}
          </Text>
          <ProgressBar step={step} />
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Countdown (shown only when slot is held, steps 1–5) */}
      {heldBooking && step < 6 && (
        <SlotCountdown expiresAt={heldBooking.slot_hold_expires_at} onExpire={handleSlotExpired} />
      )}

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* ── Step 1: Occasion ──────────────────────────────── */}
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>ما هي المناسبة؟</Text>
            <Text style={styles.stepSubtitle}>اختياري — يساعد المطعم في التحضير لك</Text>
            <View style={styles.occasionGrid}>
              {OCCASIONS.map((occ) => (
                <TouchableOpacity
                  key={occ.id}
                  style={[styles.occasionCard, booking.occasion === occ.id && { borderColor: accentColor, backgroundColor: accentColor + '10' }]}
                  onPress={() => setBooking((prev) => ({ ...prev, occasion: prev.occasion === occ.id ? undefined : occ.id }))}
                >
                  <Text style={styles.occasionEmoji}>{occ.emoji}</Text>
                  <Text style={[styles.occasionLabel, booking.occasion === occ.id && { color: accentColor }]}>{occ.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Step 2: Party size ────────────────────────────── */}
        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>كم عدد الأشخاص؟</Text>
            <View style={styles.partySizeRow}>
              <TouchableOpacity
                style={[styles.stepper, booking.partySize <= 1 && styles.stepperDisabled]}
                onPress={() => setBooking((prev) => ({ ...prev, partySize: Math.max(1, prev.partySize - 1) }))}
                disabled={booking.partySize <= 1}
              >
                <Ionicons name="remove" size={24} color={booking.partySize <= 1 ? GRAY : NAVY} />
              </TouchableOpacity>
              <View style={styles.partySizeDisplay}>
                <Text style={styles.partySizeNumber}>{booking.partySize}</Text>
                <Text style={styles.partySizeLabel}>أشخاص</Text>
              </View>
              <TouchableOpacity
                style={[styles.stepper, booking.partySize >= 20 && styles.stepperDisabled]}
                onPress={() => setBooking((prev) => ({ ...prev, partySize: Math.min(20, prev.partySize + 1) }))}
                disabled={booking.partySize >= 20}
              >
                <Ionicons name="add" size={24} color={booking.partySize >= 20 ? GRAY : NAVY} />
              </TouchableOpacity>
            </View>
            <Text style={styles.partySizeHint}>الحد الأقصى 20 شخص لكل حجز</Text>
          </View>
        )}

        {/* ── Step 3: Date + Time ───────────────────────────── */}
        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>اختر التاريخ والوقت</Text>
            <DateStrip value={booking.selectedDate} onChange={(d) => setBooking((prev) => ({ ...prev, selectedDate: d, selectedSlotId: undefined, selectedSlot: undefined }))} />

            <View style={{ height: 20 }} />

            {slotsLoading ? (
              <View style={styles.slotsLoading}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <View key={i} style={styles.slotSkeleton} />
                ))}
              </View>
            ) : slots.length === 0 ? (
              <View style={styles.noSlots}>
                <Text style={styles.noSlotsText}>لا توجد مواعيد في هذا اليوم</Text>
                <Text style={styles.noSlotsSubtext}>جرّب يومًا آخر</Text>
              </View>
            ) : (
              <View style={styles.slotsGrid}>
                {slots.map((slot: any) => {
                  const time = new Date(slot.start_time).toLocaleTimeString('ar-EG', {
                    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo',
                  });
                  const isSelected = booking.selectedSlotId === slot.id;
                  const isFull = slot.available_capacity < booking.partySize;
                  return (
                    <TouchableOpacity
                      key={slot.id}
                      style={[
                        styles.slotBtn,
                        isSelected && { borderColor: accentColor, backgroundColor: accentColor },
                        isFull && styles.slotBtnFull,
                      ]}
                      onPress={() => !isFull && setBooking((prev) => ({ ...prev, selectedSlotId: slot.id, selectedSlot: slot }))}
                      disabled={isFull}
                    >
                      <Text style={[styles.slotBtnTime, isSelected && { color: '#fff' }, isFull && { textDecorationLine: 'line-through', color: GRAY }]}>
                        {time}
                      </Text>
                      <Text style={[styles.slotBtnDeposit, isSelected && { color: 'rgba(255,255,255,0.85)' }, isFull && { color: GRAY }]}>
                        {isFull ? 'ممتلئ' : `${slot.deposit_amount} ج.م`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ── Step 4: Section preference ────────────────────── */}
        {step === 4 && (
          <View>
            <Text style={styles.stepTitle}>تفضيل الجلسة</Text>
            <Text style={styles.stepSubtitle}>اختياري — سيحاول المطعم تلبية طلبك</Text>
            {SECTIONS.map((sec) => (
              <TouchableOpacity
                key={sec.id}
                style={[styles.sectionRow, booking.sectionPreference === sec.id && { borderColor: accentColor, backgroundColor: accentColor + '10' }]}
                onPress={() => setBooking((prev) => ({ ...prev, sectionPreference: prev.sectionPreference === sec.id ? undefined : sec.id }))}
              >
                <Text style={[styles.sectionLabel, booking.sectionPreference === sec.id && { color: accentColor }]}>
                  {sec.label}
                </Text>
                {booking.sectionPreference === sec.id && (
                  <Ionicons name="checkmark-circle" size={20} color={accentColor} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Step 5: Special requests ──────────────────────── */}
        {step === 5 && (
          <View>
            <Text style={styles.stepTitle}>طلبات خاصة</Text>
            <Text style={styles.stepSubtitle}>اختياري — أخبرنا عن أي احتياجات خاصة (حساسيات، كرسي أطفال...)</Text>
            <TextInput
              style={styles.requestsInput}
              value={booking.specialRequests}
              onChangeText={(t) => setBooking((prev) => ({ ...prev, specialRequests: t.slice(0, 200) }))}
              placeholder="اكتب طلباتك هنا..."
              placeholderTextColor={GRAY}
              multiline
              textAlign="right"
              writingDirection="rtl"
              maxLength={200}
            />
            <Text style={styles.charCount}>{booking.specialRequests.length}/200</Text>
          </View>
        )}

        {/* ── Step 6: Summary ───────────────────────────────── */}
        {step === 6 && heldBooking && (
          <View>
            {/* Countdown in summary */}
            <SlotCountdown expiresAt={heldBooking.slot_hold_expires_at} onExpire={handleSlotExpired} />

            <View style={{ height: 16 }} />
            <Text style={styles.stepTitle}>ملخص الحجز</Text>

            <View style={styles.summaryCard}>
              <SummaryRow label="المكان" value={business?.name_ar ?? ''} />
              <SummaryRow label="المنطقة" value={business?.district ?? ''} />
              <SummaryRow
                label="الموعد"
                value={booking.selectedSlot
                  ? new Date(booking.selectedSlot.start_time).toLocaleString('ar-EG', {
                      weekday: 'long', day: 'numeric', month: 'long',
                      hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo',
                    })
                  : ''}
              />
              <SummaryRow label="عدد الأشخاص" value={`${booking.partySize} أشخاص`} />
              {booking.occasion && (
                <SummaryRow label="المناسبة" value={OCCASIONS.find((o) => o.id === booking.occasion)?.label ?? ''} />
              )}
              {booking.sectionPreference && (
                <SummaryRow label="الجلسة" value={SECTIONS.find((s) => s.id === booking.sectionPreference)?.label ?? ''} />
              )}
              {booking.specialRequests && (
                <SummaryRow label="طلبات خاصة" value={booking.specialRequests} />
              )}

              <View style={styles.divider} />

              <SummaryRow label="العربون" value={`${heldBooking.deposit_amount_egp} ج.م`} />
              <SummaryRow label="رسوم الخدمة" value={`${heldBooking.platform_fee_egp} ج.م`} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>الإجمالي</Text>
                <Text style={styles.totalValue}>{heldBooking.total_amount_egp} ج.م</Text>
              </View>
            </View>

            <View style={styles.bookingRefBox}>
              <Text style={styles.bookingRefLabel}>رقم الحجز</Text>
              <Text style={styles.bookingRefValue}>{heldBooking.booking_ref}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.ctaBar}>
        {step < 6 ? (
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: accentColor }, !canProceed() && styles.ctaBtnDisabled]}
            onPress={() => {
              if (step === 5) {
                // Final step before summary — create the booking hold
                createMutation.mutate();
              } else {
                goNext();
              }
            }}
            disabled={!canProceed() || createMutation.isPending}
          >
            <Text style={styles.ctaBtnText}>
              {createMutation.isPending ? 'جاري الحجز...' : step === 5 ? 'تأكيد التفاصيل' : 'التالي'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: accentColor }]}
            onPress={() =>
              router.replace({
                pathname: '/booking/payment',
                params: {
                  booking_id: heldBooking!.booking_id,
                  booking_ref: heldBooking!.booking_ref,
                  slot_hold_expires_at: heldBooking!.slot_hold_expires_at,
                  total_amount_egp: String(heldBooking!.total_amount_egp),
                },
              })
            }
          >
            <Text style={styles.ctaBtnText}>المتابعة للدفع →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },

  // Header
  header: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 8 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 17, color: NAVY },

  // Progress
  progressContainer: { flexDirection: 'row', gap: 4, marginTop: 8 },
  progressSegment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#E5E7EB' },
  progressSegmentDone: { backgroundColor: TEAL },
  progressSegmentActive: { backgroundColor: TEAL },

  // Countdown
  countdown: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#E8F5F3' },
  countdownUrgent: { backgroundColor: '#FFEBEE' },
  countdownText: { fontFamily: 'Cairo-SemiBold', fontSize: 13, color: TEAL },
  countdownTextUrgent: { color: RED },

  // Body
  body: { padding: 24, paddingTop: 28 },
  stepTitle: { fontFamily: 'Cairo-Bold', fontSize: 22, color: NAVY, textAlign: 'right', marginBottom: 6 },
  stepSubtitle: { fontFamily: 'Cairo-Regular', fontSize: 14, color: GRAY, textAlign: 'right', marginBottom: 20 },

  // Occasion
  occasionGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 },
  occasionCard: { width: '47%', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 16, padding: 16, alignItems: 'center', backgroundColor: '#fff' },
  occasionEmoji: { fontSize: 32, marginBottom: 8 },
  occasionLabel: { fontFamily: 'Cairo-SemiBold', fontSize: 14, color: NAVY },

  // Party size
  partySizeRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 32, marginVertical: 32 },
  stepper: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  stepperDisabled: { borderColor: '#F0F0F0' },
  partySizeDisplay: { alignItems: 'center' },
  partySizeNumber: { fontFamily: 'Cairo-Bold', fontSize: 52, color: NAVY },
  partySizeLabel: { fontFamily: 'Cairo-Regular', fontSize: 14, color: GRAY },
  partySizeHint: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY, textAlign: 'center', marginTop: 8 },

  // Date strip
  dateChip: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, marginLeft: 8, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', minWidth: 64 },
  dateChipSelected: { backgroundColor: NAVY, borderColor: NAVY },
  dateChipText: { fontFamily: 'Cairo-Medium', fontSize: 12, color: GRAY },
  dateChipDay: { fontFamily: 'Cairo-Bold', fontSize: 18, color: NAVY },
  dateChipTextSelected: { color: '#fff' },

  // Slots grid
  slotsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  slotBtn: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: '#fff', minWidth: 90 },
  slotBtnFull: { backgroundColor: '#F9F9F9' },
  slotBtnTime: { fontFamily: 'Cairo-Bold', fontSize: 15, color: NAVY },
  slotBtnDeposit: { fontFamily: 'Cairo-Regular', fontSize: 12, color: GRAY, marginTop: 2 },
  slotsLoading: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  slotSkeleton: { width: 90, height: 58, borderRadius: 12, backgroundColor: '#E5E7EB' },
  noSlots: { alignItems: 'center', paddingVertical: 40 },
  noSlotsText: { fontFamily: 'Cairo-Bold', fontSize: 16, color: NAVY },
  noSlotsSubtext: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY, marginTop: 6 },

  // Section
  sectionRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, padding: 16, marginBottom: 10 },
  sectionLabel: { fontFamily: 'Cairo-SemiBold', fontSize: 16, color: NAVY },

  // Requests
  requestsInput: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, padding: 16, fontFamily: 'Cairo-Regular', fontSize: 15, color: NAVY, minHeight: 120, textAlignVertical: 'top' },
  charCount: { fontFamily: 'Cairo-Regular', fontSize: 12, color: GRAY, textAlign: 'left', marginTop: 6 },

  // Summary
  summaryCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  summaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  summaryLabel: { fontFamily: 'Cairo-Regular', fontSize: 14, color: GRAY },
  summaryValue: { fontFamily: 'Cairo-SemiBold', fontSize: 14, color: NAVY, textAlign: 'right', flex: 1, marginLeft: 16 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 },
  totalRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingTop: 12 },
  totalLabel: { fontFamily: 'Cairo-Bold', fontSize: 16, color: NAVY },
  totalValue: { fontFamily: 'Cairo-Bold', fontSize: 18, color: TEAL },

  bookingRefBox: { marginTop: 16, backgroundColor: NAVY, borderRadius: 14, padding: 16, alignItems: 'center' },
  bookingRefLabel: { fontFamily: 'Cairo-Regular', fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
  bookingRefValue: { fontFamily: 'Inter-Medium', fontSize: 20, color: '#fff', letterSpacing: 2 },

  // CTA
  ctaBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 20, paddingBottom: 36, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  ctaBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaBtnDisabled: { backgroundColor: GRAY },
  ctaBtnText: { fontFamily: 'Cairo-Bold', fontSize: 18, color: '#fff' },
});
