// ============================================================
// SUPER RESERVATION PLATFORM — Home / Discovery Screen
// US-009: Category pills, district filter, featured + nearby,
//         skeleton loading (no spinners), geo-aware feed.
// US-015: Recently visited horizontal strip.
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { searchApi, bookingApi } from '../../services/api';
import { useAuthStore } from '../../store/auth';

const NAVY = '#0F2044';
const TEAL = '#1B8A7A';
const ORANGE = '#D4622A';
const MAGENTA = '#C2185B';

const CATEGORIES = [
  { id: 'restaurant', label: 'مطاعم', emoji: '🍽️' },
  { id: 'salon', label: 'صالونات', emoji: '✂️' },
  // Phase 2:
  // { id: 'court', label: 'ملاعب', emoji: '⚽' },
  // { id: 'gaming_cafe', label: 'جيمنج', emoji: '🎮' },
  // { id: 'car_wash', label: 'غسيل سيارات', emoji: '🚗' },
];

const DISTRICTS = [
  { id: 'new_cairo', label: 'القاهرة الجديدة' },
  { id: 'maadi', label: 'المعادي' },
  { id: 'zamalek', label: 'الزمالك' },
  { id: 'sheikh_zayed', label: 'الشيخ زايد' },
  { id: 'heliopolis', label: 'مصر الجديدة' },
  { id: 'nasr_city', label: 'مدينة نصر' },
];

// ── Skeleton components ───────────────────────────────────────

function SkeletonBlock({ width, height, style }: { width?: number | string; height: number; style?: object }) {
  return (
    <View
      style={[{ width: width ?? '100%', height, backgroundColor: '#E5E7EB', borderRadius: 10 }, style]}
    />
  );
}

function BusinessCardSkeleton() {
  return (
    <View style={styles.card}>
      <SkeletonBlock height={140} style={{ borderRadius: 0 }} />
      <View style={{ padding: 16, gap: 8 }}>
        <SkeletonBlock height={16} width="55%" />
        <SkeletonBlock height={13} width="35%" />
        <SkeletonBlock height={13} width="70%" />
      </View>
    </View>
  );
}

function RecentCardSkeleton() {
  return (
    <View style={[styles.recentCard, { justifyContent: 'center', alignItems: 'center', gap: 8 }]}>
      <SkeletonBlock height={70} style={{ borderRadius: 12, width: 100 }} />
      <SkeletonBlock height={12} width={80} />
    </View>
  );
}

// ── Business card ─────────────────────────────────────────────

function BusinessCard({ business, onPress }: { business: any; onPress: () => void }) {
  const accent = business.category === 'restaurant' ? ORANGE : MAGENTA;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.cardImagePlaceholder, { backgroundColor: accent + '18' }]}>
        <Text style={styles.cardImageEmoji}>
          {business.category === 'restaurant' ? '🍽️' : '✂️'}
        </Text>
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardNameRow}>
          <Text style={styles.cardName} numberOfLines={1}>{business.name_ar}</Text>
          {business.is_new ? (
            <View style={[styles.newBadge, { backgroundColor: accent }]}>
              <Text style={styles.newBadgeText}>جديد</Text>
            </View>
          ) : (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.ratingText}>{Number(business.rating_avg).toFixed(1)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardDistrict}>{business.district}</Text>
        <View style={styles.cardFooter}>
          {business.distance_km !== null && (
            <Text style={styles.cardDistance}>{business.distance_km} كم</Text>
          )}
          {business.next_available_slots[0] && (
            <Text style={styles.cardSlot}>
              أقرب موعد:{' '}
              {new Date(business.next_available_slots[0].start_time).toLocaleTimeString('ar-EG', {
                hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo',
              })}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Recently visited card (US-015) ────────────────────────────

function RecentCard({ business, onPress }: { business: any; onPress: () => void }) {
  const accent = business.category === 'restaurant' ? ORANGE : MAGENTA;
  return (
    <TouchableOpacity style={styles.recentCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.recentImage, { backgroundColor: accent + '18' }]}>
        <Text style={{ fontSize: 28 }}>{business.category === 'restaurant' ? '🍽️' : '✂️'}</Text>
      </View>
      <Text style={styles.recentName} numberOfLines={2}>{business.name_ar}</Text>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [selectedDistrict, setSelectedDistrict] = useState<string | undefined>();

  const today = new Date().toISOString().split('T')[0];

  const { data, isLoading } = useQuery({
    queryKey: ['businesses', selectedCategory, selectedDistrict],
    queryFn: () =>
      searchApi.searchBusinesses({
        category: selectedCategory,
        district: selectedDistrict,
        date: today,
        limit: 20,
      }).then((r) => r.data),
  });

  // US-015: last 5 businesses from completed bookings
  const { data: recentData } = useQuery({
    queryKey: ['recent-businesses'],
    queryFn: () => bookingApi.listBookings('completed', 1).then((r) => r.data),
    enabled: !!user,
  });

  const businesses = data?.businesses ?? [];
  const featured = businesses.filter((b: any) => b.is_featured).slice(0, 3);
  const nearby = businesses.filter((b: any) => !b.is_featured);

  // Deduplicate recent businesses
  const recentBookings: any[] = recentData?.bookings ?? [];
  const seenIds = new Set<string>();
  const recentBusinesses = recentBookings
    .filter((bk: any) => {
      if (seenIds.has(bk.business_id)) return false;
      seenIds.add(bk.business_id);
      return true;
    })
    .slice(0, 5)
    .map((bk: any) => bk.business);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          أهلاً{user ? ` ${user.full_name.split(' ')[0]}` : ''} 👋
        </Text>
        <Text style={styles.subGreeting}>تحجز إيه النهارده؟</Text>
      </View>

      {/* Search bar — navigates to /search */}
      <TouchableOpacity
        style={styles.searchContainer}
        onPress={() => router.push('/search')}
        activeOpacity={0.8}
      >
        <Ionicons name="search-outline" size={18} color="#999" style={{ marginLeft: 8 }} />
        <Text style={styles.searchPlaceholder}>ابحث عن مطعم، صالون...</Text>
      </TouchableOpacity>

      {/* Category Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryPill, selectedCategory === cat.id && styles.categoryPillActive]}
            onPress={() => setSelectedCategory(selectedCategory === cat.id ? undefined : cat.id)}
          >
            <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
            <Text style={[styles.categoryLabel, selectedCategory === cat.id && styles.categoryLabelActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* District Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.districtScroll}>
        {DISTRICTS.map((d) => (
          <TouchableOpacity
            key={d.id}
            style={[styles.districtChip, selectedDistrict === d.id && styles.districtChipActive]}
            onPress={() => setSelectedDistrict(selectedDistrict === d.id ? undefined : d.id)}
          >
            <Text style={[styles.districtLabel, selectedDistrict === d.id && styles.districtLabelActive]}>
              {d.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* US-015: Recently visited */}
      {recentBusinesses.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🕐 زرتها قبل كده</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recentBusinesses.map((b: any) => (
              <RecentCard key={b.id} business={b} onPress={() => router.push(`/business/${b.id}`)} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Featured Section */}
      {isLoading ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⭐ مميزة لك</Text>
          <BusinessCardSkeleton />
        </View>
      ) : featured.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⭐ مميزة لك</Text>
          {featured.map((b: any) => (
            <BusinessCard key={b.id} business={b} onPress={() => router.push(`/business/${b.id}`)} />
          ))}
        </View>
      ) : null}

      {/* Nearby Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🗺️ قريبة منك</Text>
        {isLoading ? (
          <>
            <BusinessCardSkeleton />
            <BusinessCardSkeleton />
            <BusinessCardSkeleton />
          </>
        ) : nearby.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>لا توجد نتائج</Text>
            <Text style={styles.emptySubtext}>جرب تغيير المنطقة أو النوع</Text>
          </View>
        ) : (
          nearby.map((b: any) => (
            <BusinessCard key={b.id} business={b} onPress={() => router.push(`/business/${b.id}`)} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  content: { paddingBottom: 100 },
  header: { padding: 24, paddingTop: 60 },
  greeting: { fontFamily: 'Cairo-Bold', fontSize: 26, color: NAVY },
  subGreeting: { fontFamily: 'Cairo-Regular', fontSize: 16, color: '#666', marginTop: 4 },

  // Search (tap-to-navigate)
  searchContainer: { flexDirection: 'row-reverse', alignItems: 'center', marginHorizontal: 24, marginBottom: 16, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  searchPlaceholder: { flex: 1, fontFamily: 'Cairo-Regular', fontSize: 16, color: '#999', textAlign: 'right' },

  // Categories
  categoriesScroll: { paddingHorizontal: 24, marginBottom: 12 },
  categoryPill: { flexDirection: 'column', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, marginLeft: 8, borderWidth: 1.5, borderColor: '#E5E7EB' },
  categoryPillActive: { backgroundColor: NAVY, borderColor: NAVY },
  categoryEmoji: { fontSize: 20 },
  categoryLabel: { fontFamily: 'Cairo-SemiBold', fontSize: 12, color: NAVY, marginTop: 4 },
  categoryLabelActive: { color: '#fff' },

  // Districts
  districtScroll: { paddingHorizontal: 24, marginBottom: 20 },
  districtChip: { backgroundColor: '#F0F0F0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginLeft: 8 },
  districtChipActive: { backgroundColor: TEAL },
  districtLabel: { fontFamily: 'Cairo-Medium', fontSize: 13, color: NAVY },
  districtLabelActive: { color: '#fff' },

  // Sections
  section: { paddingHorizontal: 24, marginBottom: 8 },
  sectionTitle: { fontFamily: 'Cairo-Bold', fontSize: 18, color: NAVY, marginBottom: 12, textAlign: 'right' },

  // Business card
  card: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardImagePlaceholder: { height: 140, justifyContent: 'center', alignItems: 'center' },
  cardImageEmoji: { fontSize: 48 },
  cardContent: { padding: 16 },
  cardNameRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardName: { fontFamily: 'Cairo-Bold', fontSize: 17, color: NAVY, textAlign: 'right', flex: 1, marginLeft: 8 },
  newBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  newBadgeText: { fontFamily: 'Cairo-Bold', fontSize: 11, color: '#fff' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontFamily: 'Cairo-SemiBold', fontSize: 13, color: NAVY },
  cardDistrict: { fontFamily: 'Cairo-Regular', fontSize: 13, color: '#888', textAlign: 'right', marginTop: 2 },
  cardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' },
  cardDistance: { fontFamily: 'Cairo-Regular', fontSize: 12, color: TEAL },
  cardSlot: { fontFamily: 'Cairo-Regular', fontSize: 12, color: TEAL },

  // Recently visited
  recentCard: { width: 100, marginLeft: 12, alignItems: 'center' },
  recentImage: { width: 80, height: 70, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  recentName: { fontFamily: 'Cairo-SemiBold', fontSize: 12, color: NAVY, textAlign: 'center' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontFamily: 'Cairo-Bold', fontSize: 16, color: NAVY },
  emptySubtext: { fontFamily: 'Cairo-Regular', fontSize: 14, color: '#888', marginTop: 8 },
});
