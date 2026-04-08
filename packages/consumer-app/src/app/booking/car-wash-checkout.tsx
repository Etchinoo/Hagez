// ============================================================
// SUPER RESERVATION PLATFORM — Car Wash Checkout (EP-13)
// US-096: Vehicle type + service package selection
// US-097: Date/time + drop-off vs wait selection
// US-098: Booking summary with deposit + 8-min countdown
// 4-step journey:
//   Step 1 — Vehicle type
//   Step 2 — Service package
//   Step 3 — Date, time & drop-off/wait preference
//   Step 4 — Summary + countdown + Pay Now
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { searchApi, bookingApi, vehicleTypesApi } from '../../services/api';
import { useAuthStore } from '../../store/auth';

const NAVY   = '#0F2044';
const TEAL   = '#1B8A7A';
const CYAN   = '#0891B2';
const GRAY   = '#9CA3AF';
const RED    = '#DC2626';

// EP-21: Vehicle type display config keyed by size_class
// UUIDs come from API; emojis/hints are display-only and won't change.
const VEHICLE_DISPLAY: Record<string, { emoji: string; hint: string }> = {
  sedan:  { emoji: '🚗', hint: 'سيارة عادية 4 أبواب' },
  suv:    { emoji: '🚙', hint: 'دفع رباعي / كروز — يتطلب بوكس واسع' },
  pickup: { emoji: '🚛', hint: 'بيك آب — يتطلب بوكس واسع' },
  van:    { emoji: '🚐', hint: 'ميكروباص — يتطلب بوكس واسع' },
};

const LARGE_VEHICLE_CLASSES = new Set(['suv', 'pickup', 'van']);

const DATE_STRIP_DAYS = 14;

// Format date to display (e.g., "السبت ٥ أبريل")
function formatDateAr(date: Date): string {
  return date.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' });
}

function buildDateStrip(): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: DATE_STRIP_DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i + 1);
    return d;
  });
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Countdown ─────────────────────────────────────────────────

function useCountdown(active: boolean, seconds: number) {
  const [remaining, setRemaining] = useState(seconds);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) return;
    setRemaining(seconds);
    ref.current = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [active, seconds]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  return { remaining, display: `${mm}:${ss}` };
}

// ── Main Component ─────────────────────────────────────────────

export default function CarWashCheckout() {
  const { business_id } = useLocalSearchParams<{ business_id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const [step, setStep] = useState(1);
  // EP-21: track UUID from vehicle_types table + size_class for large-vehicle badge
  const [vehicleTypeId, setVehicleTypeId] = useState<string | null>(null);
  const [vehicleSizeClass, setVehicleSizeClass] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(buildDateStrip()[0]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [dropOff, setDropOff] = useState<boolean>(true);

  const { remaining: holdRemaining, display: holdDisplay } = useCountdown(step === 4, 480);

  // Load business profile
  const { data: biz, isLoading: bizLoading } = useQuery({
    queryKey: ['business', business_id],
    queryFn: () => searchApi.getBusiness(business_id!).then((r) => r.data),
    enabled: !!business_id,
  });

  // EP-21: Load canonical vehicle types from API
  const { data: vehicleTypesData } = useQuery({
    queryKey: ['vehicle-types'],
    queryFn: () => vehicleTypesApi.list().then((r) => r.data.vehicle_types as Array<{
      id: string; name_ar: string; name_en: string; size_class: string;
    }>),
    staleTime: 24 * 60 * 60 * 1000, // reference data — cache for 24h
  });

  // Load slots for selected date
  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['slots', business_id, toISODate(selectedDate)],
    queryFn: () =>
      searchApi.getBusinessSlots(business_id!, toISODate(selectedDate), 1).then((r) => r.data),
    enabled: !!business_id && step >= 3,
  });

  const bookMutation = useMutation({
    mutationFn: (payload: any) => bookingApi.createBooking(payload),
    onSuccess: (res) => {
      router.push({
        pathname: '/booking/payment',
        params: {
          booking_id: res.data.booking.id,
          amount: res.data.booking.deposit_amount,
          business_name: biz?.name_ar,
        },
      });
    },
    onError: () => Alert.alert('خطأ', 'تعذّر إنشاء الحجز. حاول مرة أخرى.'),
  });

  const dates = buildDateStrip();
  const config = biz?.car_wash_config;

  // EP-21: vehicle types from API, optionally filtered by business config's legacy string array
  const availableVehicles = (vehicleTypesData ?? []).filter((v) =>
    !config?.vehicle_types?.length || config.vehicle_types.includes(v.size_class)
  );

  // Packages from config; per-vehicle price shown if price_by_vehicle defined
  const packages: any[] = Array.isArray(config?.service_packages) ? config.service_packages : [];

  function getEffectivePrice(pkg: any): number {
    if (vehicleSizeClass && config?.price_by_vehicle?.[vehicleSizeClass] != null) {
      return config.price_by_vehicle[vehicleSizeClass];
    }
    return pkg.price_egp;
  }

  function getEffectiveDuration(pkg: any): number {
    if (vehicleSizeClass && config?.duration_by_vehicle?.[vehicleSizeClass] != null) {
      return config.duration_by_vehicle[vehicleSizeClass];
    }
    return pkg.duration_min;
  }

  // Slots filtered to remove already-booked
  const slots = (slotsData?.slots ?? []).filter((s: any) => s.available_capacity > 0);

  function handlePay() {
    if (!selectedSlot || !vehicleTypeId || !selectedPackage) return;
    bookMutation.mutate({
      slot_id:          selectedSlot.id,
      vehicle_type_id:  vehicleTypeId,          // EP-21: FK to vehicle_types table
      service_package:  selectedPackage.id,
      drop_off:         dropOff,
    });
  }

  if (bizLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={CYAN} size="large" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => (step > 1 ? setStep(step - 1) : router.back())} style={s.backBtn}>
          <Ionicons name="chevron-forward" size={22} color={NAVY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>حجز غسيل سيارة</Text>
        <View style={s.stepBadge}>
          <Text style={s.stepBadgeText}>{step} / 4</Text>
        </View>
      </View>

      {/* Step indicator */}
      <View style={s.stepRow}>
        {[1, 2, 3, 4].map((n) => (
          <View key={n} style={[s.stepDot, n <= step && { backgroundColor: CYAN }]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* ── Step 1: Vehicle Type ─────────────────────────────── */}
        {step === 1 && (
          <View>
            <Text style={s.stepTitle}>نوع السيارة</Text>
            <Text style={s.stepSub}>اختر نوع سيارتك</Text>

            {availableVehicles.length === 0 ? (
              <ActivityIndicator color={CYAN} style={{ marginVertical: 24 }} />
            ) : (
              <View style={s.vehicleGrid}>
                {availableVehicles.map((v) => {
                  const display = VEHICLE_DISPLAY[v.size_class] ?? { emoji: '🚗', hint: '' };
                  const isLarge = LARGE_VEHICLE_CLASSES.has(v.size_class);
                  const isSelected = vehicleTypeId === v.id;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[s.vehicleCard, isSelected && { borderColor: CYAN, backgroundColor: CYAN + '11' }]}
                      onPress={() => { setVehicleTypeId(v.id); setVehicleSizeClass(v.size_class); }}
                      activeOpacity={0.8}
                    >
                      <Text style={s.vehicleEmoji}>{display.emoji}</Text>
                      <Text style={[s.vehicleLabel, isSelected && { color: CYAN }]}>{v.name_ar}</Text>
                      <Text style={s.vehicleHint}>{display.hint}</Text>
                      {isLarge && (
                        <View style={s.largeBadge}>
                          <Text style={s.largeBadgeText}>بوكس واسع</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={[s.nextBtn, { backgroundColor: CYAN }, !vehicleTypeId && s.nextBtnDisabled]}
              onPress={() => setStep(2)}
              disabled={!vehicleTypeId}
            >
              <Text style={s.nextBtnText}>التالي</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 2: Service Package ──────────────────────────── */}
        {step === 2 && (
          <View>
            <Text style={s.stepTitle}>اختر الخدمة</Text>
            <Text style={s.stepSub}>
              مستوى الغسيل لـ {availableVehicles.find((v) => v.id === vehicleTypeId)?.name_ar}
            </Text>

            {packages.length === 0 ? (
              <Text style={s.emptyText}>لا توجد خدمات مُعدَّة حتى الآن</Text>
            ) : (
              packages.map((pkg) => {
                const price    = getEffectivePrice(pkg);
                const duration = getEffectiveDuration(pkg);
                const hasPerVehicle = price !== pkg.price_egp;
                return (
                  <TouchableOpacity
                    key={pkg.id}
                    style={[s.packageCard, selectedPackage?.id === pkg.id && { borderColor: CYAN, backgroundColor: CYAN + '11' }]}
                    onPress={() => setSelectedPackage({ ...pkg, _price: price, _duration: duration })}
                    activeOpacity={0.8}
                  >
                    <View style={s.packageLeft}>
                      <Text style={[s.packageName, selectedPackage?.id === pkg.id && { color: CYAN }]}>{pkg.name_ar}</Text>
                      {pkg.name_en && <Text style={s.packageNameEn}>{pkg.name_en}</Text>}
                      <Text style={s.packageDuration}>⏱ ~{duration} دقيقة</Text>
                      {hasPerVehicle && <Text style={s.perVehicleTag}>سعر حسب نوع السيارة</Text>}
                    </View>
                    <View style={s.packageRight}>
                      <Text style={[s.packagePrice, selectedPackage?.id === pkg.id && { color: CYAN }]}>{price}</Text>
                      <Text style={s.packageCurrency}>ج.م</Text>
                    </View>
                    {selectedPackage?.id === pkg.id && (
                      <Ionicons name="checkmark-circle" size={20} color={CYAN} style={s.packageCheck} />
                    )}
                  </TouchableOpacity>
                );
              })
            )}

            <TouchableOpacity
              style={[s.nextBtn, { backgroundColor: CYAN }, !selectedPackage && s.nextBtnDisabled]}
              onPress={() => setStep(3)}
              disabled={!selectedPackage}
            >
              <Text style={s.nextBtnText}>التالي</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 3: Date, Time + Drop-off/Wait ──────────────── */}
        {step === 3 && (
          <View>
            <Text style={s.stepTitle}>الموعد والتسليم</Text>

            {/* Date strip */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dateStrip}>
              {dates.map((d) => {
                const isSelected = toISODate(d) === toISODate(selectedDate);
                return (
                  <TouchableOpacity
                    key={d.toISOString()}
                    style={[s.dateChip, isSelected && { backgroundColor: CYAN, borderColor: CYAN }]}
                    onPress={() => { setSelectedDate(d); setSelectedSlot(null); }}
                  >
                    <Text style={[s.dateChipText, isSelected && { color: '#fff' }]}>{formatDateAr(d)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Time slots */}
            <Text style={s.subsection}>المواعيد المتاحة</Text>
            {slotsLoading ? (
              <ActivityIndicator color={CYAN} style={{ marginVertical: 16 }} />
            ) : slots.length === 0 ? (
              <Text style={s.emptyText}>لا توجد مواعيد متاحة في هذا اليوم</Text>
            ) : (
              <View style={s.slotsGrid}>
                {slots.map((slot: any) => {
                  const isSelected = selectedSlot?.id === slot.id;
                  const time = new Date(slot.start_time).toLocaleTimeString('ar-EG', {
                    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo',
                  });
                  return (
                    <TouchableOpacity
                      key={slot.id}
                      style={[s.slotChip, isSelected && { backgroundColor: CYAN, borderColor: CYAN }]}
                      onPress={() => setSelectedSlot(slot)}
                    >
                      <Text style={[s.slotChipTime, isSelected && { color: '#fff' }]}>{time}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Drop-off vs Wait */}
            <Text style={[s.subsection, { marginTop: 20 }]}>أين ستكون؟</Text>
            <View style={s.preferenceRow}>
              <TouchableOpacity
                style={[s.preferenceBtn, dropOff && { borderColor: CYAN, backgroundColor: CYAN + '11' }]}
                onPress={() => setDropOff(true)}
              >
                <Text style={s.preferenceEmoji}>🚗</Text>
                <Text style={[s.preferenceLabel, dropOff && { color: CYAN }]}>إيداع السيارة</Text>
                <Text style={s.preferenceHint}>اتركها وارجع لاحقاً</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.preferenceBtn, !dropOff && { borderColor: CYAN, backgroundColor: CYAN + '11' }]}
                onPress={() => setDropOff(false)}
              >
                <Text style={s.preferenceEmoji}>⏳</Text>
                <Text style={[s.preferenceLabel, !dropOff && { color: CYAN }]}>انتظار أثناء الغسيل</Text>
                <Text style={s.preferenceHint}>ستبقى في مكان الانتظار</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[s.nextBtn, { backgroundColor: CYAN }, !selectedSlot && s.nextBtnDisabled]}
              onPress={() => setStep(4)}
              disabled={!selectedSlot}
            >
              <Text style={s.nextBtnText}>التالي</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 4: Summary + Pay ───────────────────────────── */}
        {step === 4 && selectedSlot && selectedPackage && vehicleTypeId && (
          <View>
            <Text style={s.stepTitle}>ملخص الحجز</Text>

            {/* Countdown */}
            <View style={[s.countdownBox, holdRemaining < 120 && { borderColor: RED }]}>
              <Ionicons name="time-outline" size={18} color={holdRemaining < 120 ? RED : CYAN} />
              <Text style={[s.countdownText, holdRemaining < 120 && { color: RED }]}>
                الموعد محجوز لمدة {holdDisplay}
              </Text>
            </View>

            {/* Summary card */}
            <View style={s.summaryCard}>
              <SummaryRow label="النشاط" value={biz?.name_ar ?? ''} />
              <SummaryRow
                label="نوع السيارة"
                value={availableVehicles.find((v) => v.id === vehicleTypeId)?.name_ar ?? ''}
              />
              <SummaryRow label="الخدمة" value={selectedPackage.name_ar} />
              <SummaryRow
                label="الموعد"
                value={new Date(selectedSlot.start_time).toLocaleString('ar-EG', {
                  weekday: 'short', day: 'numeric', month: 'short',
                  hour: '2-digit', minute: '2-digit',
                  timeZone: 'Africa/Cairo',
                })}
              />
              <SummaryRow label="التسليم" value={dropOff ? 'إيداع السيارة' : 'انتظار أثناء الغسيل'} />
              <SummaryRow
                label="مدة الغسيل المتوقعة"
                value={`~${selectedPackage._duration ?? selectedPackage.duration_min} دقيقة`}
              />
              <View style={s.divider} />
              <SummaryRow
                label="المقدم المطلوب"
                value={`${selectedSlot.deposit_amount} ج.م`}
                highlight
                accentColor={CYAN}
              />
            </View>

            <TouchableOpacity
              style={[s.payBtn, bookMutation.isPending && { opacity: 0.6 }]}
              onPress={handlePay}
              disabled={bookMutation.isPending || holdRemaining === 0}
              activeOpacity={0.85}
            >
              {bookMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.payBtnText}>ادفع المقدم الآن</Text>
              )}
            </TouchableOpacity>

            <Text style={s.payNote}>
              سيتم الإفراج عن المبلغ بعد إتمام الغسيل. الإلغاء مجاني قبل الموعد بساعة.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  highlight = false,
  accentColor = CYAN,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  accentColor?: string;
}) {
  return (
    <View style={s.summaryRow}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={[s.summaryValue, highlight && { color: accentColor, fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:    { padding: 20, paddingBottom: 48 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn:         { padding: 8 },
  headerTitle:     { fontFamily: 'Cairo-Bold', fontSize: 17, color: NAVY, flex: 1, textAlign: 'center' },
  stepBadge:       { backgroundColor: CYAN + '22', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  stepBadgeText:   { fontFamily: 'Cairo-SemiBold', fontSize: 13, color: CYAN },

  stepRow:   { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 12, backgroundColor: '#fff' },
  stepDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' },

  stepTitle: { fontFamily: 'Cairo-Bold', fontSize: 20, color: NAVY, marginBottom: 4, textAlign: 'right' },
  stepSub:   { fontFamily: 'Cairo-Regular', fontSize: 14, color: GRAY, marginBottom: 20, textAlign: 'right' },

  // Step 1: vehicle grid
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  vehicleCard: {
    width: '47%', padding: 16, borderRadius: 14, backgroundColor: '#fff',
    borderWidth: 2, borderColor: '#E5E7EB', alignItems: 'center',
  },
  vehicleEmoji: { fontSize: 40, marginBottom: 8 },
  vehicleLabel: { fontFamily: 'Cairo-Bold', fontSize: 15, color: NAVY, marginBottom: 4 },
  vehicleHint:  { fontFamily: 'Cairo-Regular', fontSize: 12, color: GRAY, textAlign: 'center' },
  largeBadge:     { marginTop: 6, backgroundColor: '#E0F2FE', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  largeBadgeText: { fontFamily: 'Cairo-Regular', fontSize: 10, color: '#0369A1' },
  perVehicleTag:  { fontFamily: 'Cairo-Regular', fontSize: 11, color: CYAN, marginTop: 2 },

  // Step 2: packages
  packageCard: {
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 2, borderColor: '#E5E7EB',
    padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center',
  },
  packageLeft:    { flex: 1 },
  packageRight:   { alignItems: 'flex-end', marginLeft: 12 },
  packageName:    { fontFamily: 'Cairo-Bold', fontSize: 16, color: NAVY, textAlign: 'right' },
  packageNameEn:  { fontFamily: 'Cairo-Regular', fontSize: 12, color: GRAY, textAlign: 'right' },
  packageDuration:{ fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY, marginTop: 4, textAlign: 'right' },
  packagePrice:   { fontFamily: 'Cairo-Bold', fontSize: 22, color: NAVY },
  packageCurrency:{ fontFamily: 'Cairo-Regular', fontSize: 12, color: GRAY },
  packageCheck:   { marginLeft: 8 },

  // Step 3: date strip
  dateStrip: { marginBottom: 4 },
  dateChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff',
    marginLeft: 8, alignItems: 'center',
  },
  dateChipText: { fontFamily: 'Cairo-SemiBold', fontSize: 13, color: NAVY },

  subsection: { fontFamily: 'Cairo-Bold', fontSize: 15, color: NAVY, marginBottom: 10, textAlign: 'right' },

  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  slotChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff',
  },
  slotChipTime: { fontFamily: 'Cairo-SemiBold', fontSize: 14, color: NAVY },

  preferenceRow:  { flexDirection: 'row', gap: 12, marginBottom: 24 },
  preferenceBtn:  {
    flex: 1, padding: 16, borderRadius: 14, backgroundColor: '#fff',
    borderWidth: 2, borderColor: '#E5E7EB', alignItems: 'center',
  },
  preferenceEmoji:{ fontSize: 28, marginBottom: 6 },
  preferenceLabel:{ fontFamily: 'Cairo-Bold', fontSize: 14, color: NAVY, textAlign: 'center' },
  preferenceHint: { fontFamily: 'Cairo-Regular', fontSize: 11, color: GRAY, textAlign: 'center', marginTop: 4 },

  // Step 4: summary
  countdownBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: CYAN + '11', borderRadius: 12, borderWidth: 1, borderColor: CYAN + '44',
    padding: 12, marginBottom: 16,
  },
  countdownText: { fontFamily: 'Cairo-SemiBold', fontSize: 14, color: CYAN },

  summaryCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 20,
  },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  summaryLabel: { fontFamily: 'Cairo-Regular', fontSize: 14, color: GRAY },
  summaryValue: { fontFamily: 'Cairo-SemiBold', fontSize: 14, color: NAVY, textAlign: 'right', flex: 1, marginRight: 8 },
  divider:      { height: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },

  payBtn: {
    backgroundColor: CYAN, borderRadius: 14, padding: 18,
    alignItems: 'center', marginBottom: 12,
  },
  payBtnText: { fontFamily: 'Cairo-Bold', fontSize: 17, color: '#fff' },
  payNote:    { fontFamily: 'Cairo-Regular', fontSize: 12, color: GRAY, textAlign: 'center', lineHeight: 18 },

  nextBtn: {
    borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText:     { fontFamily: 'Cairo-Bold', fontSize: 16, color: '#fff' },

  emptyText: { fontFamily: 'Cairo-Regular', fontSize: 14, color: GRAY, textAlign: 'center', marginVertical: 24 },
});
