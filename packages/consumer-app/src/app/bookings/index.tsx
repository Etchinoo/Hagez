// ============================================================
// SUPER RESERVATION PLATFORM — My Bookings Screen
// Shows upcoming + past bookings. Manage, cancel, review.
// ============================================================

import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { bookingApi } from '../../services/api';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  confirmed:             { label: 'مؤكد ✅', color: '#1B8A7A' },
  pending_payment:       { label: 'في انتظار الدفع ⏳', color: '#F59E0B' },
  completed:             { label: 'مكتمل 🎉', color: '#6B7280' },
  cancelled_by_consumer: { label: 'ملغي منك', color: '#D32F2F' },
  cancelled_by_business: { label: 'ملغي من المكان', color: '#D32F2F' },
  no_show:               { label: 'غياب', color: '#D32F2F' },
  disputed:              { label: 'قيد المراجعة', color: '#F59E0B' },
};

export default function MyBookingsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const upcomingStatuses = ['confirmed', 'pending_payment'];
  const pastStatuses = ['completed', 'cancelled_by_consumer', 'cancelled_by_business', 'no_show'];

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bookings', tab],
    queryFn: () => bookingApi.listBookings().then((r) => r.data),
  });

  const allBookings = data?.bookings ?? [];
  const bookings = allBookings.filter((b: any) =>
    tab === 'upcoming' ? upcomingStatuses.includes(b.status) : pastStatuses.includes(b.status)
  );

  const renderBooking = ({ item: booking }: { item: any }) => {
    const statusInfo = STATUS_LABELS[booking.status] ?? { label: booking.status, color: '#666' };
    const slotTime = new Date(booking.slot?.start_time);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: '/bookings/[id]', params: { id: booking.id } } as any)}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.status, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          <Text style={styles.bookingRef}>{booking.booking_ref}</Text>
        </View>
        <Text style={styles.businessName}>{booking.business?.name_ar}</Text>
        <Text style={styles.district}>{booking.business?.district}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.dateTime}>
            {slotTime.toLocaleString('ar-EG', {
              weekday: 'long', month: 'long', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
              timeZone: 'Africa/Cairo',
            })}
          </Text>
          {booking.status === 'completed' && !booking.review && (
            <TouchableOpacity style={styles.reviewButton}>
              <Text style={styles.reviewButtonText}>قيّم 🌟</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>حجوزاتي</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'upcoming' && styles.tabActive]}
          onPress={() => setTab('upcoming')}
        >
          <Text style={[styles.tabText, tab === 'upcoming' && styles.tabTextActive]}>القادمة</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'past' && styles.tabActive]}
          onPress={() => setTab('past')}
        >
          <Text style={[styles.tabText, tab === 'past' && styles.tabTextActive]}>السابقة</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#1B8A7A" style={{ marginTop: 40 }} />
      ) : bookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyText}>لا توجد حجوزات</Text>
          <Text style={styles.emptySubtext}>احجز الآن واستمتع بتجربة مميزة</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBooking}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      )}
    </View>
  );
}

const NAVY = '#0F2044';
const TEAL = '#1B8A7A';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  title: { fontFamily: 'Cairo-Bold', fontSize: 24, color: NAVY, textAlign: 'right' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: TEAL },
  tabText: { fontFamily: 'Cairo-SemiBold', fontSize: 15, color: '#999' },
  tabTextActive: { color: TEAL },
  list: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  status: { fontFamily: 'Cairo-SemiBold', fontSize: 13 },
  bookingRef: { fontFamily: 'Cairo-Regular', fontSize: 12, color: '#999' },
  businessName: { fontFamily: 'Cairo-Bold', fontSize: 18, color: NAVY, textAlign: 'right' },
  district: { fontFamily: 'Cairo-Regular', fontSize: 13, color: '#888', textAlign: 'right', marginTop: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  dateTime: { fontFamily: 'Cairo-Regular', fontSize: 13, color: '#555', flex: 1, textAlign: 'right' },
  reviewButton: { backgroundColor: '#FFF8E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  reviewButtonText: { fontFamily: 'Cairo-SemiBold', fontSize: 12, color: '#F59E0B' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontFamily: 'Cairo-Bold', fontSize: 18, color: NAVY },
  emptySubtext: { fontFamily: 'Cairo-Regular', fontSize: 14, color: '#888', marginTop: 8 },
});
