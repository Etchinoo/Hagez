// ============================================================
// SUPER RESERVATION PLATFORM — Gaming Checkout (US-017 + US-019)
// 4-step gaming journey + 8-min slot hold countdown.
// Steps: Date+Time → Session Setup → Genre Preference → Summary
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { searchApi, bookingApi } from '../../services/api';

const NAVY = '#0F2044';
const TEAL = '#1B8A7A';
const GAMING_PURPLE = '#6B21A8';
const GRAY = '#9CA3AF';
const RED = '#D32F2F';

const TOTAL_STEPS = 4;

// ── Types ─────────────────────────────────────────────────────

interface BookingState {
  selectedDate: string;
  selectedSlotId?: string;
  selectedSlot?: any;
  stationType?: string;     // PC | Console | VR | Group Room
  resourceId?: string;
  sessionDurationMin?: number;
  partySize: number;
  isGroupRoom: boolean;
  genrePreference?: string;
  specialRequests: string;
  overrideConsumerOverlap: boolean;
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
            i < step && styles.progressSegmentDone,
          ]}
        />
      ))}
    </View>
  );
}

// ── Countdown (US-019) ────────────────────────────────────────

function SlotCountdown({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const calcSecs = () => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const [remaining, setRemaining] = useState(calcSecs);

  useEffect(() => {
    const interval = setInterval(() => {
      const secs = calcSecs();
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

// ── Date strip ────────────────────────────────────────────────

function DateStrip({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return { d, i };
  });

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
      {days.map(({ d, i }) => {
        const iso = d.toISOString().slice(0, 10);
        const selected = iso === value;
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

// ── Chip group ────────────────────────────────────────────────

function ChipGroup({
  options,
  selected,
  onSelect,
  accent,
}: {
  options: string[];
  selected?: string;
  onSelect: (v: string) => void;
  accent: string;
}) {
  return (
    <View style={styles.chipGrid}>
      {options.map((opt) => {
        const active = selected === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, active && { borderColor: accent, backgroundColor: accent + '15' }]}
            onPress={() => onSelect(active ? '' : opt)}
          >
            <Text style={[styles.chipText, active && { color: accent }]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Summary row ───────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────

export default function CheckoutScreen() {
  const { business_id, slot_id: preselectedSlotId } = useLocalSearchParams<{
    business_id: string;
    slot_id?: string;
  }>();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [booking, setBooking] = useState<BookingState>({
    selectedDate: new Date().toISOString().slice(0, 10),
    selectedSlotId: preselectedSlotId,
    partySize: 1,
    isGroupRoom: false,
    specialRequests: '',
    overrideConsumerOverlap: false,
  });

  const [heldBooking, setHeldBooking] = useState<{
    booking_id: string;
    booking_ref: string;
    slot_hold_expires_at: string;
    total_amount_egp: number;
    deposit_amount_egp: number;
    platform_fee_egp: number;
  } | null>(null);

  const { data: business } = useQuery({
    queryKey: ['business', business_id],
    queryFn: () => searchApi.getBusiness(business_id).then((r) => r.data),
    enabled: !!business_id,
  });

  const gamingConfig = business?.gaming_config;
  const stationTypeOptions: string[] = gamingConfig?.station_types ?? ['PC', 'Console', 'VR', 'Group Room'];
  const genreOptions: string[] = gamingConfig?.genre_options ?? ['FPS', 'Racing', 'Sports', 'RPG', 'Fighting'];
  const durationOptions: number[] = gamingConfig?.slot_duration_options ?? [60, 120, 180];
  const groupRoomCapacity: number = gamingConfig?.group_room_capacity ?? 8;
  const minPlayersGroupRoom: number = gamingConfig?.min_players_group_room ?? 2;

  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['slots', business_id, booking.selectedDate, booking.partySize, booking.resourceId],
    queryFn: () =>
      searchApi.getBusinessSlots(business_id, booking.selectedDate, booking.partySize, booking.resourceId).then((r) => r.data),
    enabled: step >= 1,
    refetchInterval: 2 * 60 * 1000,
  });

  const slots = slotsData?.slots ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      bookingApi.createBooking({
        slot_id: booking.selectedSlotId!,
        business_id,
        party_size: booking.partySize,
        resource_id: booking.resourceId,
        station_type: booking.stationType,
        genre_preference: booking.genrePreference,
        session_duration_min: booking.sessionDurationMin,
        is_group_room: booking.isGroupRoom,
        special_requests: booking.specialRequests || undefined,
        override_consumer_overlap: booking.overrideConsumerOverlap,
      }).then((r) => r.data),
    onSuccess: (data) => {
      setHeldBooking(data);
      router.replace({
        pathname: '/booking/payment',
        params: {
          booking_id: data.booking_id,
          booking_ref: data.booking_ref,
          slot_hold_expires_at: data.slot_hold_expires_at,
          total_amount_egp: String(data.total_amount_egp),
        },
      });
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
      Alert.alert('خطأ', err.response?.data?.error?.message_ar ?? 'حدث خطأ. حاول مرة أخرى.');
    },
  });

  function handleSlotExpired() {
    Alert.alert(
      'انتهى الوقت ⏰',
      'انتهت مدة الحجز المؤقت. يُرجى اختيار وقت آخر.',
      [{ text: 'اختر وقتًا آخر', onPress: () => { setHeldBooking(null); setStep(1); } }]
    );
  }

  function goNext() { setStep((s) => Math.min(s + 1, TOTAL_STEPS)); }
  function goBack() {
    if (step === 1) { router.back(); return; }
    setStep((s) => s - 1);
  }

  function canProceed(): boolean {
    switch (step) {
      case 1: return !!booking.selectedSlotId;
      case 2: return !!booking.stationType && !!booking.sessionDurationMin;
      case 3: return true; // genre is optional
      case 4: return true;
      default: return false;
    }
  }

  const STATION_EMOJI: Record<string, string> = {
    PC: '🖥️',
    Console: '🎮',
    VR: '🥽',
    'Group Room': '🏠',
  };

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

      {/* Countdown */}
      {heldBooking && (
        <SlotCountdown expiresAt={heldBooking.slot_hold_expires_at} onExpire={handleSlotExpired} />
      )}

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* ── Step 1: Date + Time ───────────────────────────── */}
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>اختر التاريخ والوقت</Text>
            <DateStrip
              value={booking.selectedDate}
              onChange={(d) => setBooking((prev) => ({ ...prev, selectedDate: d, selectedSlotId: undefined, selectedSlot: undefined }))}
            />

            <View style={{ height: 20 }} />

            {slotsLoading ? (
              <View style={styles.slotsGrid}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <View key={i} style={styles.slotSkeleton} />
                ))}
              </View>
            ) : slots.length === 0 ? (
              <View style={styles.emptySlots}>
                <Text style={styles.emptySlotsText}>لا توجد مواعيد في هذا اليوم</Text>
                <Text style={styles.emptySlotsSubtext}>جرّب يومًا آخر</Text>
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
                        isSelected && styles.slotBtnSelected,
                        isFull && styles.slotBtnFull,
                      ]}
                      onPress={() => !isFull && setBooking((prev) => ({ ...prev, selectedSlotId: slot.id, selectedSlot: slot }))}
                      disabled={isFull}
                    >
                      <Text style={[styles.slotBtnTime, isSelected && styles.slotBtnTextSelected, isFull && styles.slotBtnTextFull]}>
                        {time}
                      </Text>
                      <Text style={[styles.slotBtnDeposit, isSelected && styles.slotBtnDepositSelected, isFull && styles.slotBtnTextFull]}>
                        {isFull ? 'ممتلئ' : `${slot.deposit_amount} ج.م`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ── Step 2: Session Setup ─────────────────────────── */}
        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>إعداد الجلسة</Text>

            {/* Station type */}
            <Text style={styles.sectionLabel}>نوع الجهاز</Text>
            <ChipGroup
              options={stationTypeOptions}
              selected={booking.stationType}
              onSelect={(v) => {
                const isGroup = v === 'Group Room';
                setBooking((prev) => ({
                  ...prev,
                  stationType: v || undefined,
                  isGroupRoom: isGroup,
                  partySize: isGroup ? minPlayersGroupRoom : 1,
                  resourceId: undefined,
                }));
              }}
              accent={GAMING_PURPLE}
            />
            {booking.stationType && (
              <View style={styles.stationTypeHint}>
                <Text style={styles.stationTypeEmoji}>{STATION_EMOJI[booking.stationType] ?? '🎮'}</Text>
                <Text style={styles.stationTypeSelected}>{booking.stationType}</Text>
              </View>
            )}

            {/* Duration */}
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>مدة الجلسة</Text>
            <ChipGroup
              options={durationOptions.map((d) => `${d} دقيقة`)}
              selected={booking.sessionDurationMin ? `${booking.sessionDurationMin} دقيقة` : undefined}
              onSelect={(v) => {
                const mins = parseInt(v);
                setBooking((prev) => ({ ...prev, sessionDurationMin: isNaN(mins) ? undefined : mins }));
              }}
              accent={GAMING_PURPLE}
            />

            {/* Player count for group room */}
            {booking.isGroupRoom && (
              <View style={{ marginTop: 24 }}>
                <Text style={styles.sectionLabel}>عدد اللاعبين</Text>
                <View style={styles.partySizeRow}>
                  <TouchableOpacity
                    style={[styles.stepper, booking.partySize <= minPlayersGroupRoom && styles.stepperDisabled]}
                    onPress={() => setBooking((prev) => ({ ...prev, partySize: Math.max(minPlayersGroupRoom, prev.partySize - 1) }))}
                    disabled={booking.partySize <= minPlayersGroupRoom}
                  >
                    <Ionicons name="remove" size={22} color={booking.partySize <= minPlayersGroupRoom ? GRAY : NAVY} />
                  </TouchableOpacity>
                  <View style={styles.partySizeDisplay}>
                    <Text style={styles.partySizeNumber}>{booking.partySize}</Text>
                    <Text style={styles.partySizeLabel}>لاعب</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.stepper, booking.partySize >= groupRoomCapacity && styles.stepperDisabled]}
                    onPress={() => setBooking((prev) => ({ ...prev, partySize: Math.min(groupRoomCapacity, prev.partySize + 1) }))}
                    disabled={booking.partySize >= groupRoomCapacity}
                  >
                    <Ionicons name="add" size={22} color={booking.partySize >= groupRoomCapacity ? GRAY : NAVY} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.partySizeHint}>من {minPlayersGroupRoom} إلى {groupRoomCapacity} لاعبين</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Step 3: Genre Preference ──────────────────────── */}
        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>تفضيل اللعبة</Text>
            <Text style={styles.stepSubtitle}>اختياري — يساعدنا في تجهيز الجهاز ليك</Text>
            <ChipGroup
              options={genreOptions}
              selected={booking.genrePreference}
              onSelect={(v) => setBooking((prev) => ({ ...prev, genrePreference: v || undefined }))}
              accent={GAMING_PURPLE}
            />
          </View>
        )}

        {/* ── Step 4: Summary ───────────────────────────────── */}
        {step === 4 && (
          <View>
            <Text style={styles.stepTitle}>ملخص الحجز</Text>

            <View style={styles.summaryCard}>
              <SummaryRow label="المكان" value={business?.name_ar ?? ''} />
              <SummaryRow label="المنطقة" value={business?.district ?? ''} />
              {booking.selectedSlot && (
                <SummaryRow
                  label="الموعد"
                  value={new Date(booking.selectedSlot.start_time).toLocaleString('ar-EG', {
                    weekday: 'long', day: 'numeric', month: 'long',
                    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo',
                  })}
                />
              )}
              {booking.stationType && (
                <SummaryRow label="نوع الجهاز" value={`${STATION_EMOJI[booking.stationType] ?? '🎮'} ${booking.stationType}`} />
              )}
              {booking.sessionDurationMin && (
                <SummaryRow label="مدة الجلسة" value={`${booking.sessionDurationMin} دقيقة`} />
              )}
              {booking.isGroupRoom && (
                <SummaryRow label="عدد اللاعبين" value={`${booking.partySize} لاعبين`} />
              )}
              {booking.genrePreference && (
                <SummaryRow label="تفضيل اللعبة" value={booking.genrePreference} />
              )}

              <View style={styles.divider} />

              {booking.selectedSlot && (
                <>
                  <SummaryRow label="العربون" value={`${booking.selectedSlot.deposit_amount} ج.م`} />
                  <SummaryRow label="رسوم الخدمة" value="20 ج.م" />
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>الإجمالي</Text>
                    <Text style={styles.totalValue}>
                      {(Number(booking.selectedSlot.deposit_amount) + 20).toFixed(0)} ج.م
                    </Text>
                  </View>
                </>
              )}
            </View>

            <TextInput
              style={[styles.requestsInput, { marginTop: 20 }]}
              value={booking.specialRequests}
              onChangeText={(t) => setBooking((prev) => ({ ...prev, specialRequests: t.slice(0, 200) }))}
              placeholder="طلبات خاصة (اختياري)..."
              placeholderTextColor={GRAY}
              multiline
              textAlign="right"
              writingDirection="rtl"
              maxLength={200}
            />
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={[styles.ctaBtn, !canProceed() && styles.ctaBtnDisabled]}
          onPress={() => {
            if (step === 4) {
              createMutation.mutate();
            } else {
              goNext();
            }
          }}
          disabled={!canProceed() || createMutation.isPending}
        >
          <Text style={styles.ctaBtnText}>
            {createMutation.isPending
              ? 'جاري الحجز...'
              : step === 4
              ? 'تأكيد والمتابعة للدفع →'
              : 'التالي'}
          </Text>
        </TouchableOpacity>
      </View>
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
  progressSegmentDone: { backgroundColor: GAMING_PURPLE },

  // Countdown
  countdown: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#F3E8FF' },
  countdownUrgent: { backgroundColor: '#FFEBEE' },
  countdownText: { fontFamily: 'Cairo-SemiBold', fontSize: 13, color: GAMING_PURPLE },
  countdownTextUrgent: { color: RED },

  // Body
  body: { padding: 24, paddingTop: 28 },
  stepTitle: { fontFamily: 'Cairo-Bold', fontSize: 22, color: NAVY, textAlign: 'right', marginBottom: 6 },
  stepSubtitle: { fontFamily: 'Cairo-Regular', fontSize: 14, color: GRAY, textAlign: 'right', marginBottom: 20 },
  sectionLabel: { fontFamily: 'Cairo-Bold', fontSize: 16, color: NAVY, textAlign: 'right', marginBottom: 12 },

  // Date strip
  dateChip: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, marginLeft: 8, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', minWidth: 64 },
  dateChipSelected: { backgroundColor: NAVY, borderColor: NAVY },
  dateChipText: { fontFamily: 'Cairo-Medium', fontSize: 12, color: GRAY },
  dateChipDay: { fontFamily: 'Cairo-Bold', fontSize: 18, color: NAVY },
  dateChipTextSelected: { color: '#fff' },

  // Slots grid
  slotsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  slotBtn: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: '#fff', minWidth: 90 },
  slotBtnSelected: { borderColor: GAMING_PURPLE, backgroundColor: GAMING_PURPLE },
  slotBtnFull: { backgroundColor: '#F9F9F9', opacity: 0.6 },
  slotBtnTime: { fontFamily: 'Cairo-Bold', fontSize: 15, color: NAVY },
  slotBtnTextSelected: { color: '#fff' },
  slotBtnTextFull: { color: GRAY, textDecorationLine: 'line-through' },
  slotBtnDeposit: { fontFamily: 'Cairo-Regular', fontSize: 12, color: GRAY, marginTop: 2 },
  slotBtnDepositSelected: { color: 'rgba(255,255,255,0.85)' },
  slotSkeleton: { width: 90, height: 58, borderRadius: 12, backgroundColor: '#E5E7EB' },
  emptySlots: { alignItems: 'center', paddingVertical: 40 },
  emptySlotsText: { fontFamily: 'Cairo-Bold', fontSize: 16, color: NAVY },
  emptySlotsSubtext: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY, marginTop: 6 },

  // Chip group
  chipGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  chip: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff' },
  chipText: { fontFamily: 'Cairo-SemiBold', fontSize: 14, color: NAVY },

  // Station type hint
  stationTypeHint: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: GAMING_PURPLE + '10', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  stationTypeEmoji: { fontSize: 24 },
  stationTypeSelected: { fontFamily: 'Cairo-Bold', fontSize: 15, color: GAMING_PURPLE },

  // Party size
  partySizeRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 32, marginVertical: 20 },
  stepper: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  stepperDisabled: { borderColor: '#F0F0F0' },
  partySizeDisplay: { alignItems: 'center' },
  partySizeNumber: { fontFamily: 'Cairo-Bold', fontSize: 48, color: NAVY },
  partySizeLabel: { fontFamily: 'Cairo-Regular', fontSize: 14, color: GRAY },
  partySizeHint: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY, textAlign: 'center' },

  // Summary
  summaryCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  summaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  summaryLabel: { fontFamily: 'Cairo-Regular', fontSize: 14, color: GRAY },
  summaryValue: { fontFamily: 'Cairo-SemiBold', fontSize: 14, color: NAVY, textAlign: 'right', flex: 1, marginLeft: 16 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 },
  totalRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingTop: 12 },
  totalLabel: { fontFamily: 'Cairo-Bold', fontSize: 16, color: NAVY },
  totalValue: { fontFamily: 'Cairo-Bold', fontSize: 18, color: GAMING_PURPLE },

  // Special requests
  requestsInput: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, padding: 16, fontFamily: 'Cairo-Regular', fontSize: 15, color: NAVY, minHeight: 90, textAlignVertical: 'top' },

  // CTA
  ctaBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 20, paddingBottom: 36, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  ctaBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', backgroundColor: GAMING_PURPLE },
  ctaBtnDisabled: { backgroundColor: GRAY },
  ctaBtnText: { fontFamily: 'Cairo-Bold', fontSize: 18, color: '#fff' },
});
