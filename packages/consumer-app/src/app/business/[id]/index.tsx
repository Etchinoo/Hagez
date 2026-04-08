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
import { toArabic } from '../../../utils/numerals';

const NAVY = '#0F2044';
const TEAL = '#1B8A7A';
const GRAY = '#9CA3AF';
const ORANGE = '#D4622A';  // restaurant accent
const MAGENTA = '#C2185B'; // salon accent
const GREEN  = '#2E7D32';   // court accent
const PURPLE = '#6B21A8';   // gaming accent
const CYAN   = '#0891B2';   // car wash accent

function categoryColor(category: string) {
  if (category === 'restaurant') return ORANGE;
  if (category === 'salon') return MAGENTA;
  if (category === 'court') return GREEN;
  if (category === 'gaming_cafe') return PURPLE;
  if (category === 'car_wash') return CYAN;
  return TEAL;
}

const VEHICLE_LABELS: Record<string, string> = {
  sedan:      '🚗 سيدان',
  suv:        '🚙 SUV',
  truck:      '🚛 شاحنة',
  motorcycle: '🏍️ موتوسيكل',
};

const STATION_LABELS: Record<string, string> = {
  pc:         'كمبيوتر PC',
  console:    'بلايستيشن',
  vr:         'واقع افتراضي VR',
  group_room: 'غرفة جماعية',
};

const STATION_EMOJI: Record<string, string> = {
  pc:         '🖥️',
  console:    '🎮',
  vr:         '🥽',
  group_room: '👥',
};

const GENRE_LABELS: Record<string, string> = {
  fps:    'إطلاق نار FPS',
  rpg:    'أدوار RPG',
  sports: 'رياضة',
  racing: 'سباق',
  casual: 'كاجوال',
  horror: 'رعب',
  moba:   'موبا MOBA',
};

const SPORT_LABELS: Record<string, string> = {
  football: 'كرة القدم',
  basketball: 'كرة السلة',
  tennis: 'تنس',
  padel: 'بادل',
  squash: 'إسكواش',
  volleyball: 'كرة الطائرة',
};

const COURT_TYPE_LABELS: Record<string, string> = {
  indoor: 'مغطى',
  outdoor: 'مكشوف',
  both: 'مغطى ومكشوف',
};

const SURFACE_LABELS: Record<string, string> = {
  grass: 'عشب طبيعي',
  turf: 'عشب صناعي',
  hard: 'أرضية صلبة',
  clay: 'تراب',
};

const EQUIPMENT_LABELS: Record<string, string> = {
  balls: 'كرات',
  bibs: 'قمصان تدريب',
  cones: 'أقماع',
  vests: 'صدريات',
  water: 'مياه',
};

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

// ── ReviewsSection (US-077) ───────────────────────────────────
// Shows rating + review cards. Rating hidden until ≥5 verified reviews.
// Consumer name masked: "أحمد م."

function maskName(full: string): string {
  const parts = full.trim().split(' ');
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1,2,3,4,5].map((s) => (
        <Ionicons key={s} name={s <= rating ? 'star' : 'star-outline'} size={size} color="#F59E0B" />
      ))}
    </View>
  );
}

function ReviewsSection({ businessId, isNew, accent }: { businessId: string; isNew: boolean; accent: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['reviews', businessId, page],
    queryFn: () => searchApi.getBusinessReviews(businessId, page).then((r) => r.data),
  });

  if (isNew) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>التقييمات</Text>
        <View style={[styles.newBadgeBlock, { borderColor: accent + '44' }]}>
          <Text style={[styles.newBadgeText, { color: accent }]}>جديد — لا توجد تقييمات بعد</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>التقييمات</Text>
      {isLoading && <ActivityIndicator color={TEAL} style={{ marginVertical: 16 }} />}
      {data && data.reviews.length === 0 && (
        <Text style={styles.noReviewsText}>لا توجد تقييمات معتمدة حتى الآن</Text>
      )}
      {data?.reviews.map((r: any, i: number) => (
        <View key={i} style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <StarRow rating={r.rating} />
            <Text style={styles.reviewConsumer}>{maskName(r.consumer_name)}</Text>
          </View>
          {r.body ? <Text style={styles.reviewBody}>{r.body}</Text> : null}
          <Text style={styles.reviewDate}>
            {new Date(r.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
          </Text>
        </View>
      ))}
      {data && data.total > page * 10 && (
        <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setPage((p) => p + 1)}>
          <Text style={[styles.loadMoreText, { color: accent }]}>تحميل المزيد</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

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

  const effectiveDeposit = slot.effective_deposit ?? slot.deposit_amount;
  const hasPricingBadge = !!slot.pricing_badge_ar;
  const isPriceHigher = effectiveDeposit > slot.deposit_amount;
  const isPriceLower  = effectiveDeposit < slot.deposit_amount;

  return (
    <TouchableOpacity
      style={[styles.slotChip, selected && styles.slotChipSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {hasPricingBadge && (
        <Text style={styles.slotPricingBadge}>{slot.pricing_badge_ar}</Text>
      )}
      <Text style={[styles.slotTime, selected && styles.slotTimeSelected]}>{time}</Text>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
        {isPriceHigher && (
          <Text style={[styles.slotDepositStrike, selected && { color: 'rgba(255,255,255,0.5)' }]}>
            {slot.deposit_amount} ج.م
          </Text>
        )}
        <Text style={[
          styles.slotDeposit,
          selected && styles.slotDepositSelected,
          isPriceLower && styles.slotDepositDiscount,
          isPriceHigher && styles.slotDepositSurge,
        ]}>
          {effectiveDeposit} ج.م
        </Text>
      </View>
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
    if (data.category === 'court') {
      router.push({
        pathname: '/booking/court-checkout',
        params: { business_id: id },
      });
    } else if (data.category === 'gaming_cafe') {
      router.push({
        pathname: '/booking/gaming-checkout',
        params: { business_id: id },
      });
    } else if (data.category === 'car_wash') {
      router.push({
        pathname: '/booking/car-wash-checkout',
        params: { business_id: id },
      });
    } else {
      router.push({
        pathname: '/booking/checkout',
        params: { business_id: id, slot_id: selectedSlotId ?? data.next_available_slots[0]?.id },
      });
    }
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
              {data.category === 'restaurant' ? '🍽️' : data.category === 'court' ? '⚽' : data.category === 'gaming_cafe' ? '🎮' : data.category === 'car_wash' ? '🚗' : '✂️'}
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
                <Text style={styles.ratingText}>{toArabic(Number(data.rating_avg).toFixed(1))}</Text>
                <Text style={styles.reviewCount}>({toArabic(data.review_count)})</Text>
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

          {/* Court Info (court only — US-081) */}
          {data.category === 'court' && data.court_config && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>تفاصيل الملعب</Text>

              {/* Sport type badges */}
              {data.court_config.sport_types?.length > 0 && (
                <View style={styles.badgeRow}>
                  {data.court_config.sport_types.map((s: string) => (
                    <View key={s} style={[styles.sportBadge, { borderColor: GREEN + '66', backgroundColor: GREEN + '11' }]}>
                      <Text style={[styles.sportBadgeText, { color: GREEN }]}>
                        {SPORT_LABELS[s] ?? s}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Surface + lighting */}
              <View style={styles.courtInfoRow}>
                {data.court_config.surface_type && (
                  <View style={styles.courtInfoItem}>
                    <Ionicons name="football-outline" size={15} color={GRAY} />
                    <Text style={styles.courtInfoText}>{SURFACE_LABELS[data.court_config.surface_type] ?? data.court_config.surface_type}</Text>
                  </View>
                )}
                <View style={styles.courtInfoItem}>
                  <Ionicons name="business-outline" size={15} color={GRAY} />
                  <Text style={styles.courtInfoText}>{COURT_TYPE_LABELS[data.court_config.court_type] ?? data.court_config.court_type}</Text>
                </View>
                {data.court_config.has_lighting && (
                  <View style={styles.courtInfoItem}>
                    <Ionicons name="flashlight-outline" size={15} color={GRAY} />
                    <Text style={styles.courtInfoText}>إضاءة ليلية</Text>
                  </View>
                )}
              </View>

              {/* Equipment */}
              {data.court_config.equipment_available?.length > 0 && (
                <View>
                  <Text style={styles.courtEquipLabel}>المعدات المتاحة مجاناً</Text>
                  <View style={styles.badgeRow}>
                    {data.court_config.equipment_available.map((e: string) => (
                      <View key={e} style={styles.equipBadge}>
                        <Text style={styles.equipBadgeText}>{EQUIPMENT_LABELS[e] ?? e}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Car Wash Info (car_wash only — US-096) */}
          {data.category === 'car_wash' && data.car_wash_config && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>تفاصيل الغسيل</Text>

              {/* Vehicle type badges */}
              {data.car_wash_config.vehicle_types?.length > 0 && (
                <View style={styles.badgeRow}>
                  {data.car_wash_config.vehicle_types.map((v: string) => (
                    <View key={v} style={[styles.sportBadge, { borderColor: CYAN + '66', backgroundColor: CYAN + '11' }]}>
                      <Text style={[styles.sportBadgeText, { color: CYAN }]}>
                        {VEHICLE_LABELS[v] ?? v}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Service packages */}
              {data.car_wash_config.service_packages?.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.courtEquipLabel}>الخدمات المتاحة</Text>
                  {data.car_wash_config.service_packages.map((pkg: any) => (
                    <View key={pkg.id} style={[styles.courtInfoRow, { justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingVertical: 8 }]}>
                      <Text style={[styles.courtInfoText, { flex: 1 }]}>{pkg.name_ar}</Text>
                      <Text style={[styles.courtInfoText, { color: CYAN, fontWeight: '600' }]}>{pkg.price_egp} ج.م</Text>
                      <Text style={[styles.courtInfoText, { color: GRAY, marginRight: 12 }]}>~{pkg.duration_min} دقيقة</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Drop-off / wait */}
              <View style={[styles.courtInfoRow, { marginTop: 8 }]}>
                {data.car_wash_config.allows_drop_off && (
                  <View style={styles.courtInfoItem}>
                    <Ionicons name="car-outline" size={15} color={GRAY} />
                    <Text style={styles.courtInfoText}>إيداع السيارة</Text>
                  </View>
                )}
                {data.car_wash_config.allows_wait && (
                  <View style={styles.courtInfoItem}>
                    <Ionicons name="time-outline" size={15} color={GRAY} />
                    <Text style={styles.courtInfoText}>انتظار أثناء الغسيل</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Gaming Info (gaming_cafe only — US-089) */}
          {data.category === 'gaming_cafe' && data.gaming_config && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>تفاصيل الجيمنج</Text>

              {/* Station type badges */}
              {data.gaming_config.station_types?.length > 0 && (
                <View style={styles.badgeRow}>
                  {data.gaming_config.station_types.map((s: string) => (
                    <View key={s} style={[styles.sportBadge, { borderColor: PURPLE + '66', backgroundColor: PURPLE + '11' }]}>
                      <Text style={[styles.sportBadgeText, { color: PURPLE }]}>
                        {STATION_EMOJI[s] ?? '🎮'} {STATION_LABELS[s] ?? s}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Group room info */}
              {data.gaming_config.has_group_rooms && (
                <View style={styles.courtInfoRow}>
                  <View style={styles.courtInfoItem}>
                    <Ionicons name="people-outline" size={15} color={GRAY} />
                    <Text style={styles.courtInfoText}>
                      غرف جماعية — حتى {data.gaming_config.group_room_capacity} لاعبين
                    </Text>
                  </View>
                </View>
              )}

              {/* Genre options */}
              {data.gaming_config.genre_options?.length > 0 && (
                <View>
                  <Text style={styles.courtEquipLabel}>أنواع الألعاب المتاحة</Text>
                  <View style={styles.badgeRow}>
                    {data.gaming_config.genre_options.map((g: string) => (
                      <View key={g} style={styles.equipBadge}>
                        <Text style={styles.equipBadgeText}>{GENRE_LABELS[g] ?? g}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
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

          {/* Reviews Section (US-077) */}
          <ReviewsSection businessId={id as string} isNew={data.is_new} accent={accent} />

          {/* Spacer for sticky CTA */}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Sticky Book Now CTA */}
      <View style={styles.ctaContainer}>
        {selectedSlot && (
          <View style={{ alignItems: 'center', marginBottom: 10 }}>
            {selectedSlot.pricing_badge_ar && (
              <Text style={styles.ctaPricingBadge}>{selectedSlot.pricing_badge_ar}</Text>
            )}
            <Text style={styles.ctaSlotInfo}>
              {new Date(selectedSlot.start_time).toLocaleTimeString('ar-EG', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Africa/Cairo',
              })}
              {'  ·  '}مقدّم {selectedSlot.effective_deposit ?? selectedSlot.deposit_amount} ج.م
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: accent }, data.next_available_slots.length === 0 && styles.ctaBtnDisabled]}
          onPress={handleBookNow}
          disabled={data.next_available_slots.length === 0}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaBtnText}>
            {data.category === 'court' ? 'احجز الملعب' : data.category === 'gaming_cafe' ? 'احجز المحطة' : data.category === 'car_wash' ? 'احجز الغسيل' : 'احجز الآن'}
          </Text>
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

  // Reviews (US-077)
  newBadgeBlock: { borderWidth: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
  newBadgeText: { fontFamily: 'Cairo-SemiBold', fontSize: 14 },
  noReviewsText: { fontFamily: 'Cairo-Regular', fontSize: 14, color: GRAY, textAlign: 'center', paddingVertical: 12 },
  reviewCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  reviewHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reviewConsumer: { fontFamily: 'Cairo-SemiBold', fontSize: 13, color: NAVY },
  reviewBody: { fontFamily: 'Cairo-Regular', fontSize: 14, color: '#374151', lineHeight: 22, textAlign: 'right', marginBottom: 8 },
  reviewDate: { fontFamily: 'Cairo-Regular', fontSize: 12, color: GRAY, textAlign: 'right' },
  loadMoreBtn: { alignItems: 'center', paddingVertical: 12 },
  loadMoreText: { fontFamily: 'Cairo-SemiBold', fontSize: 14 },

  // Slots
  slotsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  slotChip: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  slotChipSelected: { borderColor: TEAL, backgroundColor: TEAL },
  slotTime: { fontFamily: 'Cairo-Bold', fontSize: 15, color: NAVY },
  slotTimeSelected: { color: '#fff' },
  slotDeposit: { fontFamily: 'Cairo-Regular', fontSize: 12, color: GRAY, marginTop: 2 },
  slotDepositSelected: { color: 'rgba(255,255,255,0.85)' },
  slotDepositDiscount: { color: '#16A34A', fontFamily: 'Cairo-Bold' },
  slotDepositSurge: { color: '#DC2626', fontFamily: 'Cairo-Bold' },
  slotDepositStrike: { fontFamily: 'Cairo-Regular', fontSize: 11, color: GRAY, textDecorationLine: 'line-through' },
  slotPricingBadge: { fontFamily: 'Cairo-SemiBold', fontSize: 10, color: '#92400E', backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4, textAlign: 'center' },
  ctaPricingBadge: { fontFamily: 'Cairo-SemiBold', fontSize: 12, color: '#92400E', backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 6 },

  // No slots
  noSlots: { alignItems: 'center', paddingVertical: 24, backgroundColor: '#fff', borderRadius: 16, marginBottom: 24 },
  noSlotsText: { fontFamily: 'Cairo-Bold', fontSize: 16, color: NAVY },
  noSlotsSubtext: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY, marginTop: 6 },

  // Court info (US-081)
  badgeRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  sportBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  sportBadgeText: { fontFamily: 'Cairo-SemiBold', fontSize: 13 },
  courtInfoRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 14, marginBottom: 12 },
  courtInfoItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  courtInfoText: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY },
  courtEquipLabel: { fontFamily: 'Cairo-SemiBold', fontSize: 13, color: NAVY, textAlign: 'right', marginBottom: 8 },
  equipBadge: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#fff' },
  equipBadgeText: { fontFamily: 'Cairo-Regular', fontSize: 12, color: '#374151' },

  // CTA
  ctaContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 20, paddingBottom: 34, borderTopWidth: 1, borderTopColor: '#F0F0F0', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 8 },
  ctaSlotInfo: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY, textAlign: 'center', marginBottom: 10 },
  ctaBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaBtnDisabled: { backgroundColor: GRAY },
  ctaBtnText: { fontFamily: 'Cairo-Bold', fontSize: 18, color: '#fff' },
});
