// ============================================================
// SUPER RESERVATION PLATFORM — Search Screen (US-010 + US-012)
// Auto-complete after 2 chars, full filter panel,
// Arabic RTL, skeleton loading, empty state.
// ============================================================

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { searchApi } from '../services/api';
import { useDebounce } from '../hooks/useDebounce';

const NAVY = '#0F2044';
const TEAL = '#1B8A7A';
const GRAY = '#9CA3AF';
const ORANGE = '#D4622A';
const MAGENTA = '#C2185B';

// ── Filter state ──────────────────────────────────────────────

interface Filters {
  category?: string;
  district?: string;
  min_rating?: string;
  cuisine_type?: string;
  service_type?: string;
  indoor_outdoor?: string;
  price_range?: string;
}

const CUISINE_OPTIONS = [
  { value: 'egyptian', label: 'مصري' },
  { value: 'italian', label: 'إيطالي' },
  { value: 'asian', label: 'آسيوي' },
  { value: 'seafood', label: 'مأكولات بحرية' },
  { value: 'grills', label: 'مشويات' },
  { value: 'cafe', label: 'كافيه' },
];

const SERVICE_OPTIONS = [
  { value: 'haircut', label: 'قص شعر' },
  { value: 'coloring', label: 'صبغة' },
  { value: 'nails', label: 'مناكير' },
  { value: 'facial', label: 'جلسة وجه' },
  { value: 'blowout', label: 'سشوار' },
];

const DISTRICT_OPTIONS = [
  { value: 'new_cairo', label: 'القاهرة الجديدة' },
  { value: 'maadi', label: 'المعادي' },
  { value: 'zamalek', label: 'الزمالك' },
  { value: 'sheikh_zayed', label: 'الشيخ زايد' },
  { value: 'heliopolis', label: 'مصر الجديدة' },
  { value: 'dokki', label: 'الدقي' },
  { value: 'nasr_city', label: 'مدينة نصر' },
];

const RATING_OPTIONS = [
  { value: '5', label: '⭐⭐⭐⭐⭐' },
  { value: '4', label: '⭐⭐⭐⭐ فأكثر' },
  { value: '3', label: '⭐⭐⭐ فأكثر' },
];

const INDOOR_OUTDOOR_OPTIONS = [
  { value: 'indoor', label: 'داخلي' },
  { value: 'outdoor', label: 'خارجي' },
  { value: 'both', label: 'الاثنان' },
];

// ── Skeleton card ─────────────────────────────────────────────

function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonImage} />
      <View style={{ padding: 14, gap: 8 }}>
        <View style={[styles.skeletonLine, { width: '55%' }]} />
        <View style={[styles.skeletonLine, { width: '35%' }]} />
        <View style={[styles.skeletonLine, { width: '70%' }]} />
      </View>
    </View>
  );
}

// ── Chip selector ─────────────────────────────────────────────

function ChipGroup({
  options,
  value,
  onSelect,
}: {
  options: { value: string; label: string }[];
  value?: string;
  onSelect: (v: string | undefined) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.filterChip, value === opt.value && styles.filterChipActive]}
          onPress={() => onSelect(value === opt.value ? undefined : opt.value)}
        >
          <Text style={[styles.filterChipText, value === opt.value && styles.filterChipTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ── Filter panel modal ────────────────────────────────────────

function FilterPanel({
  visible,
  filters,
  onApply,
  onClose,
}: {
  visible: boolean;
  filters: Filters;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Filters>(filters);

  function set(key: keyof Filters, val: string | undefined) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  function activeCount() {
    return Object.values(draft).filter(Boolean).length;
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.filterModal}>
        <View style={styles.filterHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.filterClose}>إغلاق</Text>
          </TouchableOpacity>
          <Text style={styles.filterTitle}>تصفية النتائج</Text>
          <TouchableOpacity onPress={() => setDraft({})}>
            <Text style={styles.filterReset}>مسح الكل</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.filterBody} showsVerticalScrollIndicator={false}>
          {/* Category */}
          <Text style={styles.filterSectionLabel}>النوع</Text>
          <ChipGroup
            options={[{ value: 'restaurant', label: '🍽️ مطاعم' }, { value: 'salon', label: '✂️ صالونات' }]}
            value={draft.category}
            onSelect={(v) => { set('category', v); set('cuisine_type', undefined); set('service_type', undefined); }}
          />

          {/* Cuisine (restaurants only) */}
          {draft.category === 'restaurant' && (
            <>
              <Text style={styles.filterSectionLabel}>نوع المطبخ</Text>
              <ChipGroup options={CUISINE_OPTIONS} value={draft.cuisine_type} onSelect={(v) => set('cuisine_type', v)} />
            </>
          )}

          {/* Service (salons only) */}
          {draft.category === 'salon' && (
            <>
              <Text style={styles.filterSectionLabel}>نوع الخدمة</Text>
              <ChipGroup options={SERVICE_OPTIONS} value={draft.service_type} onSelect={(v) => set('service_type', v)} />
            </>
          )}

          {/* District */}
          <Text style={styles.filterSectionLabel}>المنطقة</Text>
          <ChipGroup options={DISTRICT_OPTIONS} value={draft.district} onSelect={(v) => set('district', v)} />

          {/* Rating */}
          <Text style={styles.filterSectionLabel}>التقييم</Text>
          <ChipGroup options={RATING_OPTIONS} value={draft.min_rating} onSelect={(v) => set('min_rating', v)} />

          {/* Indoor / Outdoor */}
          <Text style={styles.filterSectionLabel}>الجلسة</Text>
          <ChipGroup options={INDOOR_OUTDOOR_OPTIONS} value={draft.indoor_outdoor} onSelect={(v) => set('indoor_outdoor', v)} />

          <View style={{ height: 32 }} />
        </ScrollView>

        <View style={styles.filterFooter}>
          <TouchableOpacity style={styles.applyBtn} onPress={() => { onApply(draft); onClose(); }}>
            <Text style={styles.applyBtnText}>
              عرض النتائج{activeCount() > 0 ? ` (${activeCount()} فلاتر)` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Result card ───────────────────────────────────────────────

function ResultCard({ business, onPress }: { business: any; onPress: () => void }) {
  const accent = business.category === 'restaurant' ? ORANGE : MAGENTA;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.cardImagePlaceholder, { backgroundColor: accent + '18' }]}>
        <Text style={{ fontSize: 40 }}>{business.category === 'restaurant' ? '🍽️' : '✂️'}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardName}>{business.name_ar}</Text>
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
        {business.distance_km !== null && (
          <Text style={styles.cardDistance}>{business.distance_km} كم</Text>
        )}
        {business.next_available_slots[0] && (
          <Text style={styles.cardSlot}>
            أقرب موعد:{' '}
            {new Date(business.next_available_slots[0].start_time).toLocaleTimeString('ar-EG', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Africa/Cairo',
            })}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const router = useRouter();

  const [query, setQuery] = useState(params.q ?? '');
  const [filters, setFilters] = useState<Filters>({});
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Autocomplete
  const { data: autocompleteData } = useQuery({
    queryKey: ['autocomplete', debouncedQuery, filters.category],
    queryFn: () => searchApi.autocomplete(debouncedQuery, filters.category).then((r) => r.data),
    enabled: debouncedQuery.length >= 2 && showSuggestions,
  });
  const suggestions = autocompleteData?.suggestions ?? [];

  // Search results
  const searchParams = {
    ...filters,
    ...(debouncedQuery.length >= 2 ? {} : {}), // full-text handled server-side
    limit: 30,
  };

  const { data: searchData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['search', debouncedQuery, filters],
    queryFn: () =>
      searchApi.searchBusinesses({ ...searchParams, q: debouncedQuery || undefined }).then((r) => r.data),
    enabled: debouncedQuery.length >= 2 || activeFilterCount > 0,
  });

  const isOffline = isError && ((error as any)?.code === 'ERR_NETWORK' || (error as any)?.message === 'Network Error');

  const results = searchData?.businesses ?? [];

  return (
    <View style={styles.container}>
      {/* Search bar row */}
      <View style={styles.searchBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={22} color={NAVY} />
        </TouchableOpacity>

        <View style={styles.inputWrapper}>
          <Ionicons name="search-outline" size={18} color={GRAY} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={(t) => { setQuery(t); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="ابحث عن مطعم، صالون..."
            placeholderTextColor={GRAY}
            textAlign="right"
            writingDirection="rtl"
            autoFocus={!params.q}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setShowSuggestions(false); }}>
              <Ionicons name="close-circle" size={18} color={GRAY} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter button */}
        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setFilterPanelOpen(true)}
        >
          <Ionicons name="options-outline" size={20} color={activeFilterCount > 0 ? '#fff' : NAVY} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Autocomplete dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsBox}>
          {suggestions.map((s: any) => (
            <TouchableOpacity
              key={s.id}
              style={styles.suggestionRow}
              onPress={() => {
                setQuery(s.name_ar);
                setShowSuggestions(false);
                router.push(`/business/${s.id}`);
              }}
            >
              <Text style={styles.suggestionName}>{s.name_ar}</Text>
              <Text style={styles.suggestionDistrict}>{s.district}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Results */}
      {isLoading ? (
        <ScrollView contentContainerStyle={styles.list}>
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </ScrollView>
      ) : isOffline ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📡</Text>
          <Text style={styles.emptyTitle}>لا يوجد اتصال بالإنترنت</Text>
          <Text style={styles.emptySubtitle}>تحقق من اتصالك وحاول مرة أخرى</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.clearFiltersBtn}>
            <Text style={styles.clearFiltersText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      ) : results.length === 0 && (debouncedQuery.length >= 2 || activeFilterCount > 0) ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>مفيش نتائج</Text>
          <Text style={styles.emptySubtitle}>عدّل البحث</Text>
          {activeFilterCount > 0 && (
            <TouchableOpacity onPress={() => setFilters({})} style={styles.clearFiltersBtn}>
              <Text style={styles.clearFiltersText}>مسح الفلاتر</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }) => (
            <ResultCard business={item} onPress={() => router.push(`/business/${item.id}`)} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            results.length > 0 ? (
              <Text style={styles.resultsCount}>{results.length} نتيجة</Text>
            ) : null
          }
        />
      )}

      {/* Filter Panel */}
      <FilterPanel
        visible={filterPanelOpen}
        filters={filters}
        onApply={setFilters}
        onClose={() => setFilterPanelOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },

  // Search bar
  searchBar: { flexDirection: 'row-reverse', alignItems: 'center', padding: 16, paddingTop: 56, backgroundColor: '#fff', gap: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  inputWrapper: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#F7F8FA', borderRadius: 12, paddingHorizontal: 12, gap: 8 },
  inputIcon: { marginLeft: 4 },
  input: { flex: 1, fontFamily: 'Cairo-Regular', fontSize: 16, color: NAVY, paddingVertical: 11 },
  filterBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  filterBtnActive: { backgroundColor: TEAL },
  filterBadge: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: ORANGE, justifyContent: 'center', alignItems: 'center' },
  filterBadgeText: { fontFamily: 'Cairo-Bold', fontSize: 10, color: '#fff' },

  // Autocomplete
  suggestionsBox: { position: 'absolute', top: 116, left: 16, right: 16, zIndex: 99, backgroundColor: '#fff', borderRadius: 14, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  suggestionRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  suggestionName: { fontFamily: 'Cairo-SemiBold', fontSize: 15, color: NAVY },
  suggestionDistrict: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY },

  // Results
  list: { padding: 16, paddingTop: 8 },
  resultsCount: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY, textAlign: 'right', marginBottom: 8 },

  // Card
  card: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardImagePlaceholder: { height: 120, justifyContent: 'center', alignItems: 'center' },
  cardBody: { padding: 14 },
  cardTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardName: { fontFamily: 'Cairo-Bold', fontSize: 16, color: NAVY, textAlign: 'right', flex: 1, marginLeft: 8 },
  newBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  newBadgeText: { fontFamily: 'Cairo-Bold', fontSize: 11, color: '#fff' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontFamily: 'Cairo-SemiBold', fontSize: 13, color: NAVY },
  cardDistrict: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY, textAlign: 'right' },
  cardDistance: { fontFamily: 'Cairo-Regular', fontSize: 12, color: TEAL, textAlign: 'right', marginTop: 2 },
  cardSlot: { fontFamily: 'Cairo-Regular', fontSize: 12, color: TEAL, textAlign: 'right', marginTop: 4 },

  // Skeleton
  skeletonCard: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
  skeletonImage: { height: 120, backgroundColor: '#E5E7EB' },
  skeletonLine: { height: 14, backgroundColor: '#E5E7EB', borderRadius: 6, marginBottom: 6 },

  // Empty state
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontFamily: 'Cairo-Bold', fontSize: 20, color: NAVY, marginBottom: 6 },
  emptySubtitle: { fontFamily: 'Cairo-Regular', fontSize: 15, color: GRAY },
  clearFiltersBtn: { marginTop: 16, borderWidth: 1.5, borderColor: TEAL, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  clearFiltersText: { fontFamily: 'Cairo-SemiBold', fontSize: 14, color: TEAL },

  // Filter modal
  filterModal: { flex: 1, backgroundColor: '#F7F8FA' },
  filterHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  filterTitle: { fontFamily: 'Cairo-Bold', fontSize: 18, color: NAVY },
  filterClose: { fontFamily: 'Cairo-SemiBold', fontSize: 15, color: GRAY },
  filterReset: { fontFamily: 'Cairo-SemiBold', fontSize: 15, color: ORANGE },
  filterBody: { flex: 1, padding: 20 },
  filterSectionLabel: { fontFamily: 'Cairo-Bold', fontSize: 15, color: NAVY, textAlign: 'right', marginBottom: 10, marginTop: 4 },
  filterChip: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginLeft: 8, backgroundColor: '#fff' },
  filterChipActive: { borderColor: TEAL, backgroundColor: TEAL },
  filterChipText: { fontFamily: 'Cairo-Medium', fontSize: 13, color: NAVY },
  filterChipTextActive: { color: '#fff' },
  filterFooter: { padding: 20, paddingBottom: 36, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  applyBtn: { backgroundColor: TEAL, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  applyBtnText: { fontFamily: 'Cairo-Bold', fontSize: 17, color: '#fff' },
});
