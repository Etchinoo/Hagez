// ============================================================
// SUPER RESERVATION PLATFORM — Booking Confirmed (US-025)
// Shows booking reference in monospace, time, business name.
// No back gesture (gestureEnabled: false in _layout.tsx).
// ============================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { bookingApi } from '../../services/api';
import { toArabic } from '../../utils/numerals';

const NAVY = '#0F2044';
const TEAL = '#1B8A7A';
const GRAY = '#9CA3AF';

export default function BookingConfirmedScreen() {
  const { booking_ref, booking_id } = useLocalSearchParams<{
    booking_ref: string;
    booking_id: string;
  }>();
  const router = useRouter();

  const { data } = useQuery({
    queryKey: ['booking', booking_id],
    queryFn: () => bookingApi.getBooking(booking_id).then((r) => r.data),
    enabled: !!booking_id,
  });

  const slotTime = data?.slot?.start_time
    ? new Date(data.slot.start_time).toLocaleString('ar-EG', {
        weekday: 'long', day: 'numeric', month: 'long',
        hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo',
      })
    : '';

  async function handleShare() {
    await Share.share({
      message: `حجزت في ${data?.business?.name_ar ?? ''} 🎉\nرقم الحجز: ${booking_ref}\nالموعد: ${slotTime}`,
    });
  }

  return (
    <View style={styles.container}>
      {/* Success animation placeholder */}
      <View style={styles.successCircle}>
        <Ionicons name="checkmark" size={56} color="#fff" />
      </View>

      <Text style={styles.title}>تم الحجز بنجاح! 🎉</Text>
      <Text style={styles.subtitle}>
        في انتظارك في{' '}
        <Text style={styles.businessName}>{data?.business?.name_ar}</Text>
      </Text>

      {/* Booking reference (US-025: monospace font) */}
      <View style={styles.refCard}>
        <Text style={styles.refLabel}>رقم الحجز</Text>
        <Text style={styles.refValue}>{booking_ref}</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Ionicons name="share-outline" size={18} color={TEAL} />
          <Text style={styles.shareBtnText}>شارك</Text>
        </TouchableOpacity>
      </View>

      {/* Booking details */}
      <View style={styles.detailsCard}>
        {slotTime !== '' && (
          <DetailRow icon="calendar-outline" label="الموعد" value={slotTime} />
        )}
        {data?.party_size && (
          <DetailRow icon="people-outline" label="عدد الأشخاص" value={`${toArabic(data.party_size)} أشخاص`} />
        )}
        {data?.business?.district && (
          <DetailRow icon="location-outline" label="المنطقة" value={data.business.district} />
        )}
        <DetailRow icon="card-outline" label="المدفوع" value={`${(Number(data?.deposit_amount ?? 0) + Number(data?.platform_fee ?? 0))} ج.م`} />
      </View>

      <Text style={styles.reminderNote}>
        ستصلك رسالة واتساب للتذكير قبل 24 ساعة ومرة أخرى قبل ساعتين من موعدك.
      </Text>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace('/(tabs)/bookings')}
        >
          <Text style={styles.primaryBtnText}>حجوزاتي</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.secondaryBtnText}>الرئيسية</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailValue}>{value}</Text>
      <View style={styles.detailLeft}>
        <Ionicons name={icon} size={16} color={GRAY} />
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA', alignItems: 'center', paddingHorizontal: 24, paddingTop: 80 },

  successCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: TEAL, justifyContent: 'center', alignItems: 'center', marginBottom: 24, shadowColor: TEAL, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },

  title: { fontFamily: 'Cairo-Bold', fontSize: 26, color: NAVY, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontFamily: 'Cairo-Regular', fontSize: 16, color: GRAY, textAlign: 'center', marginBottom: 28 },
  businessName: { fontFamily: 'Cairo-Bold', color: NAVY },

  refCard: { width: '100%', backgroundColor: NAVY, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16 },
  refLabel: { fontFamily: 'Cairo-Regular', fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 8 },
  refValue: { fontFamily: 'Inter-Medium', fontSize: 24, color: '#fff', letterSpacing: 3, marginBottom: 16 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  shareBtnText: { fontFamily: 'Cairo-SemiBold', fontSize: 14, color: '#fff' },

  detailsCard: { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  detailRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  detailLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailLabel: { fontFamily: 'Cairo-Regular', fontSize: 14, color: GRAY },
  detailValue: { fontFamily: 'Cairo-SemiBold', fontSize: 14, color: NAVY, textAlign: 'right', flex: 1, marginLeft: 12 },

  reminderNote: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY, textAlign: 'center', lineHeight: 20, marginBottom: 28, paddingHorizontal: 8 },

  actions: { width: '100%', gap: 10 },
  primaryBtn: { backgroundColor: TEAL, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { fontFamily: 'Cairo-Bold', fontSize: 17, color: '#fff' },
  secondaryBtn: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingVertical: 15, alignItems: 'center', backgroundColor: '#fff' },
  secondaryBtnText: { fontFamily: 'Cairo-Bold', fontSize: 17, color: NAVY },
});
