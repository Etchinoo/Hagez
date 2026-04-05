// ============================================================
// SUPER RESERVATION PLATFORM — Payment Screen
// Wraps Paymob iframe. Payment method selector → WebView.
// Countdown from slot hold continues here.
// ============================================================

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { bookingApi } from '../../services/api';

const NAVY = '#0F2044';
const TEAL = '#1B8A7A';
const GRAY = '#9CA3AF';

const PAYMENT_METHODS = [
  { id: 'card',        label: 'بطاقة بنكية',     emoji: '💳', subtitle: 'Visa / Mastercard / Meeza' },
  { id: 'instapay',   label: 'InstaPay',           emoji: '📱', subtitle: 'رقم الهاتف المرتبط بـ InstaPay' },
  { id: 'fawry',      label: 'فوري',               emoji: '🏪', subtitle: 'ادفع في أي فرع فوري' },
  { id: 'vodafone',   label: 'Vodafone Cash',       emoji: '🔴', subtitle: 'محفظة فودافون كاش' },
];

export default function PaymentScreen() {
  const { booking_id, booking_ref, slot_hold_expires_at, total_amount_egp } =
    useLocalSearchParams<{
      booking_id: string;
      booking_ref: string;
      slot_hold_expires_at: string;
      total_amount_egp: string;
    }>();

  const router = useRouter();
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  const payMutation = useMutation({
    mutationFn: () =>
      bookingApi.initiatePayment(booking_id, selectedMethod!).then((r) => r.data),
    onSuccess: (data) => {
      // In production: open data.iframe_url in a WebView or in-app browser
      // For now navigate to confirmed screen (Paymob sandbox callback simulated)
      router.replace({
        pathname: '/booking/confirmed',
        params: { booking_ref, booking_id },
      });
    },
    onError: () => {
      Alert.alert('خطأ', 'فشل بدء عملية الدفع. حاول مرة أخرى.');
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={22} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الدفع</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Amount */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>المبلغ المطلوب</Text>
          <Text style={styles.amountValue}>{total_amount_egp} ج.م</Text>
          <Text style={styles.bookingRefText}>حجز رقم: {booking_ref}</Text>
        </View>

        {/* Payment methods */}
        <Text style={styles.sectionTitle}>اختر طريقة الدفع</Text>
        {PAYMENT_METHODS.map((method) => (
          <TouchableOpacity
            key={method.id}
            style={[styles.methodRow, selectedMethod === method.id && styles.methodRowSelected]}
            onPress={() => setSelectedMethod(method.id)}
          >
            <Text style={styles.methodEmoji}>{method.emoji}</Text>
            <View style={styles.methodInfo}>
              <Text style={[styles.methodLabel, selectedMethod === method.id && { color: TEAL }]}>
                {method.label}
              </Text>
              <Text style={styles.methodSubtitle}>{method.subtitle}</Text>
            </View>
            {selectedMethod === method.id && (
              <Ionicons name="checkmark-circle" size={22} color={TEAL} />
            )}
          </TouchableOpacity>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={[styles.ctaBtn, !selectedMethod && styles.ctaBtnDisabled]}
          onPress={() => payMutation.mutate()}
          disabled={!selectedMethod || payMutation.isPending}
        >
          <Text style={styles.ctaBtnText}>
            {payMutation.isPending ? 'جاري التوجيه...' : `ادفع ${total_amount_egp} ج.م`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 8 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontFamily: 'Cairo-Bold', fontSize: 18, color: NAVY, textAlign: 'center' },
  body: { padding: 24 },
  amountCard: { backgroundColor: NAVY, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 28 },
  amountLabel: { fontFamily: 'Cairo-Regular', fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
  amountValue: { fontFamily: 'Cairo-Bold', fontSize: 40, color: '#fff' },
  bookingRefText: { fontFamily: 'Inter-Regular', fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 8 },
  sectionTitle: { fontFamily: 'Cairo-Bold', fontSize: 17, color: NAVY, textAlign: 'right', marginBottom: 14 },
  methodRow: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: '#E5E7EB', gap: 12 },
  methodRowSelected: { borderColor: TEAL, backgroundColor: '#E8F5F3' },
  methodEmoji: { fontSize: 24 },
  methodInfo: { flex: 1 },
  methodLabel: { fontFamily: 'Cairo-SemiBold', fontSize: 16, color: NAVY },
  methodSubtitle: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY, marginTop: 2 },
  ctaBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 20, paddingBottom: 36, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  ctaBtn: { backgroundColor: TEAL, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaBtnDisabled: { backgroundColor: GRAY },
  ctaBtnText: { fontFamily: 'Cairo-Bold', fontSize: 18, color: '#fff' },
});
