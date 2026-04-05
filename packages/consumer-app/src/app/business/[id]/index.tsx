// ============================================================
// SUPER RESERVATION PLATFORM — Business Profile Screen (US-011)
// Photos, name AR/EN, description, rating/'New' badge,
// services list, next 3 slots, sticky Book Now CTA.
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Linking,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { searchApi } from '../../../services/api';

const NAVY = '#0F2044';
const TEAL = '#1B8A7A';
const GRAY = '#9CA3AF';
const ORANGE = '#D4622A';  // restaurant accent
const MAGENTA = '#C2185B'; // salon accent

function categoryColor(category: string) {
  if (category === 'restaurant') return ORANGE;
  if (category === 'salon') return MAGENTA;
  return TEAL;
}

// ── Skeleton ──────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <View style={styles.container}>
      <View style={[styles.skeletonBlock, { height: 260 }]} />
      <View style={{ padding: 24 }}>
        <View style={[styles.skeletonBlock, { height: 24, width: '60%', marginBottom: 12 }]} />
        <View style={[styles.skeletonBlock, { height: 16, width: '40%', marginBottom: 24 }]} />
        <View style={[styles.skeletonBlock, { height: 14, width: '100%', marginBottom: 8 }]} />
        <View style={[styles.skeletonBlock, { height: 14, width: '80%', marginBottom: 32 }]} />
        <View style={[styles.skeletonBlock, { height: 80, marginBottom: 12 }]} />
        <View style={[styles.skeletonBlock, { height: 80, marginBottom: 12 }]} />
        <View style={[styles.skeletonBlock, { height: 80 }]} />
      </View>
    </View>
  );
}

// ── Slot chip ─────────────────────────────────────────────────

function SlotChip({
  slot,
  selected,
  onPress,
}: {
  slot: any;
  selected: boolean;
  onPress: () => void;
}) {
  const time = new Date(slot.start_time).toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Cairo',
  });
  return (
    <TouchableOpacity
      style={[styles.slotChip, selected && styles.slotChipSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.slotTime, selected && styles.slotTimeSelected]}>{time}</Text>
      <Text style={[styles.slotDeposit, selected && styles.slotDepositSelected]}>
        {slot.deposit_amount} ج.م
      </Text>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────

export default function BusinessProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['business', id],
    queryFn: () => searchApi.getBusiness(id).then((r) => r.data),
    enabled: !!id,
  });

  if (isLoading) return <ProfileSkeleton />;

  if (isError || !data) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>تعذّر تحميل البيانات</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>رجوع</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const accent = categoryColor(data.category);

  function openMaps() {
    const url = `https://www.google.com/maps/search/?api=1&query=${data.location.lat},${data.location.lng}`;
    Linking.openURL(url);
  }

  function handleBookNow() {
    router.push({
      pathname: '/booking/checkout',
      params: { business_id: id, slot_id: selectedSlotId ?? data.next_available_slots[0]?.id },
    });
  }

  const selectedSlot =
    selectedSlotId
      ? data.next_available_slots.find((s: any) => s.id === selectedSlotId)
      : data.next_available_slots[0];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Photos */}
        {data.photos.length > 0 ? (
          <View style={styles.photoContainer}>
            <Image
              source={{ uri: data.photos[photoIndex] }}
              style={styles.photo}
              resizeMode="cover"
            />
            {data.photos.length > 1 && (
              <View style={styles.photoDots}>
                {data.photos.map((_: string, i: number) => (
                  <TouchableOpacity key={i} onPress={() => setPhotoIndex(i)}>
                    <View style={[styles.dot, i === photoIndex && { backgroundColor: '#fff' }]} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.photoPlaceholder, { backgroundColor: accent + '22' }]}>
            <Text style={{ fontSize: 64 }}>
              {data.category === 'restaurant' ? '🍽️' : '✂️'}
            </Text>
          </View>
        )}

        {/* Back button overlay */}
        <TouchableOpacity style={styles.backOverlay} onPress={() => router.back()}>
          <Ionicons name="chevron-forward" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.body}>
          {/* Name + badge */}
          <View style={styles.nameRow}>
            <View style={styles.nameBlock}>
              <Text style={styles.nameAr}>{data.name_ar}</Text>
              {data.name_en && <Text style={styles.nameEn}>{data.name_en}</Text>}
            </View>
            {data.is_new ? (
              <View style={[styles.badge, { backgroundColor: accent }]}>
                <Text style={styles.badgeText}>جديد</Text>
              </View>
            ) : (
              <View style={styles.ratingBlock}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={styles.ratingText}>{Number(data.rating_avg).toFixed(1)}</Text>
                <Text style={styles.reviewCount}>({data.review_count})</Text>
              </View>
            )}
          </View>

          {/* District + map link */}
          <TouchableOpacity style={styles.locationRow} onPress={openMaps}>
            <Ionicons name="location-outline" size={16} color={TEAL} />
            <Text style={styles.locationText}>{data.district}</Text>
            <Text style={styles.mapsLink}>فتح الخريطة</Text>
          </TouchableOpacity>

          {/* Description */}
          {(data.description_ar || data.description_en) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>عن المكان</Text>
              <Text style={styles.description}>{data.description_ar || data.description_en}</Text>
            </View>
          )}

          {/* Staff (salon only) */}
          {data.category === 'salon' && data.staff?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>الفريق</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {data.staff.map((member: any) => (
                  <View key={member.id} style={styles.staffCard}>
                    <View style={[styles.staffAvatar, { backgroundColor: accent + '22' }]}>
                      <Text style={{ fontSize: 24 }}>✂️</Text>
                    </View>
                    <Text style={styles.staffName}>{member.name_ar}</Text>
                    {member.specialty && (
                      <Text style={styles.staffSpecialty}>{member.specialty}</Text>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Available Slots */}
          {data.next_available_slots.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>المواعيد المتاحة</Text>
              <View style={styles.slotsRow}>
                {data.next_available_slots.map((slot: any) => (
                  <SlotChip
                    key={slot.id}
                    slot={slot}
                    selected={
                      selectedSlotId ? slot.id === selectedSlotId : slot.id === data.next_available_slots[0]?.id
                    }
                    onPress={() => setSelectedSlotId(slot.id)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* No slots state */}
          {data.next_available_slots.length === 0 && (
            <View style={styles.noSlots}>
              <Text style={styles.noSlotsText}>لا توجد مواعيد متاحة اليوم</Text>
              <Text style={styles.noSlotsSubtext}>جرّب يوم آخر من شاشة الحجز</Text>
            </View>
          )}

          {/* Spacer for sticky CTA */}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Sticky Book Now CTA */}
      <View style={styles.ctaContainer}>
        {selectedSlot && (
          <Text style={styles.ctaSlotInfo}>
            {new Date(selectedSlot.start_time).toLocaleTimeString('ar-EG', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Africa/Cairo',
            })}
            {'  ·  '}مقدّم {selectedSlot.deposit_amount} ج.م
          </Text>
        )}
        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: accent }, data.next_available_slots.length === 0 && styles.ctaBtnDisabled]}
          onPress={handleBookNow}
          disabled={data.next_available_slots.length === 0}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaBtnText}>احجز الآن</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  scrollContent: { paddingBottom: 0 },

  // Skeleton
  skeletonBlock: { backgroundColor: '#E5E7EB', borderRadius: 8, marginBottom: 0 },

  // Error
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { fontFamily: 'Cairo-Bold', fontSize: 18, color: NAVY, marginBottom: 16 },
  backBtn: { backgroundColor: TEAL, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  backBtnText: { fontFamily: 'Cairo-SemiBold', fontSize: 16, color: '#fff' },

  // Photo
  photoContainer: { position: 'relative' },
  photo: { width: '100%', height: 260 },
  photoPlaceholder: { height: 260, justifyContent: 'center', alignItems: 'center' },
  photoDots: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },

  // Back overlay
  backOverlay: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Body
  body: { backgroundColor: '#F7F8FA', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, padding: 24 },

  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  nameBlock: { flex: 1, marginLeft: 12 },
  nameAr: { fontFamily: 'Cairo-Bold', fontSize: 22, color: NAVY, textAlign: 'right' },
  nameEn: { fontFamily: 'Inter-Regular', fontSize: 14, color: GRAY, textAlign: 'right', marginTop: 2 },

  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontFamily: 'Cairo-Bold', fontSize: 12, color: '#fff' },

  ratingBlock: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontFamily: 'Cairo-Bold', fontSize: 16, color: NAVY },
  reviewCount: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY },

  locationRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 20 },
  locationText: { fontFamily: 'Cairo-Regular', fontSize: 14, color: GRAY, flex: 1, textAlign: 'right' },
  mapsLink: { fontFamily: 'Cairo-SemiBold', fontSize: 13, color: TEAL },

  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: 'Cairo-Bold', fontSize: 17, color: NAVY, textAlign: 'right', marginBottom: 12 },
  description: { fontFamily: 'Cairo-Regular', fontSize: 15, color: '#444', textAlign: 'right', lineHeight: 24 },

  // Staff
  staffCard: { alignItems: 'center', marginLeft: 12, width: 80 },
  staffAvatar: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  staffName: { fontFamily: 'Cairo-SemiBold', fontSize: 12, color: NAVY, textAlign: 'center' },
  staffSpecialty: { fontFamily: 'Cairo-Regular', fontSize: 11, color: GRAY, textAlign: 'center' },

  // Slots
  slotsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  slotChip: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  slotChipSelected: { borderColor: TEAL, backgroundColor: TEAL },
  slotTime: { fontFamily: 'Cairo-Bold', fontSize: 15, color: NAVY },
  slotTimeSelected: { color: '#fff' },
  slotDeposit: { fontFamily: 'Cairo-Regular', fontSize: 12, color: GRAY, marginTop: 2 },
  slotDepositSelected: { color: 'rgba(255,255,255,0.85)' },

  // No slots
  noSlots: { alignItems: 'center', paddingVertical: 24, backgroundColor: '#fff', borderRadius: 16, marginBottom: 24 },
  noSlotsText: { fontFamily: 'Cairo-Bold', fontSize: 16, color: NAVY },
  noSlotsSubtext: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY, marginTop: 6 },

  // CTA
  ctaContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 20, paddingBottom: 34, borderTopWidth: 1, borderTopColor: '#F0F0F0', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 8 },
  ctaSlotInfo: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY, textAlign: 'center', marginBottom: 10 },
  ctaBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaBtnDisabled: { backgroundColor: GRAY },
  ctaBtnText: { fontFamily: 'Cairo-Bold', fontSize: 18, color: '#fff' },
});
