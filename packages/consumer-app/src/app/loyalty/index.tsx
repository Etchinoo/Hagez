// ============================================================
// SUPER RESERVATION PLATFORM — Loyalty Screen (EP-16)
// US-111: Loyalty card — balance, tier badge, progress bar
// US-112: Scrollable transaction history
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { loyaltyApi } from '../../services/api';
import { toArabic } from '../../utils/numerals';

const NAVY   = '#0F2044';
const TEAL   = '#1B8A7A';
const GRAY   = '#9CA3AF';
const GOLD   = '#D97706';
const GREEN  = '#16A34A';
const RED    = '#DC2626';

// ── Tier config ───────────────────────────────────────────────

const TIER_CONFIG = {
  bronze:   { label: 'برونزي',   color: '#92400E', bg: '#FEF3C7', emoji: '🥉' },
  silver:   { label: 'فضي',      color: '#4B5563', bg: '#F3F4F6', emoji: '🥈' },
  gold:     { label: 'ذهبي',     color: '#B45309', bg: '#FEF9C3', emoji: '🥇' },
  platinum: { label: 'بلاتيني',  color: '#6B21A8', bg: '#F3E8FF', emoji: '💎' },
} as const;

type Tier = keyof typeof TIER_CONFIG;

function TierBadge({ tier }: { tier: Tier }) {
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.bronze;
  return (
    <View style={[styles.tierBadge, { backgroundColor: cfg.bg }]}>
      <Text style={styles.tierEmoji}>{cfg.emoji}</Text>
      <Text style={[styles.tierLabel, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

// ── Transaction type config ───────────────────────────────────

function txIcon(type: string) {
  if (type === 'earn')   return { icon: 'add-circle', color: GREEN  };
  if (type === 'redeem') return { icon: 'remove-circle', color: RED  };
  return                        { icon: 'time', color: GRAY };
}

// ── Main Screen ───────────────────────────────────────────────

export default function LoyaltyScreen() {
  const router = useRouter();
  const [historyPage, setHistoryPage] = useState(1);

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['loyalty-summary'],
    queryFn: () => loyaltyApi.getSummary().then((r) => r.data),
  });

  const { data: history, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['loyalty-history', historyPage],
    queryFn: () => loyaltyApi.getHistory(historyPage).then((r) => r.data),
  });

  function onRefresh() {
    refetchSummary();
    refetchHistory();
  }

  if (summaryLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={TEAL} />
      </View>
    );
  }

  const tier: Tier = summary?.tier ?? 'bronze';
  const tierCfg = TIER_CONFIG[tier];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={22} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>نقاط الولاء</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={TEAL} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Loyalty Card */}
        <View style={[styles.loyaltyCard, { borderColor: tierCfg.color + '44' }]}>
          <View style={styles.cardTop}>
            <TierBadge tier={tier} />
            <View style={styles.balanceBlock}>
              <Text style={styles.balanceNum}>{toArabic(summary?.balance ?? 0)}</Text>
              <Text style={styles.balanceLabel}>نقطة</Text>
            </View>
          </View>

          {/* Progress bar */}
          {summary?.next_tier && (
            <View style={styles.progressSection}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressText}>
                  {toArabic(summary.points_to_next_tier)} نقطة للوصول إلى {TIER_CONFIG[summary.next_tier as Tier]?.label}
                </Text>
                <Text style={styles.progressPct}>{toArabic(summary.progress_pct)}٪</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(100, summary.progress_pct)}%` as any, backgroundColor: tierCfg.color },
                  ]}
                />
              </View>
            </View>
          )}

          {summary?.next_tier === null && (
            <Text style={[styles.platinumMsg, { color: tierCfg.color }]}>
              💎 وصلت إلى أعلى مستوى — مستوى البلاتيني!
            </Text>
          )}

          {/* Redemption value */}
          {(summary?.redemption_value_egp ?? 0) > 0 && (
            <View style={styles.redeemBanner}>
              <Ionicons name="gift-outline" size={16} color={TEAL} />
              <Text style={styles.redeemText}>
                يمكنك استرداد ما يصل إلى {toArabic(summary.redemption_value_egp)} ج.م في حجزك القادم
              </Text>
            </View>
          )}

          {/* Tier thresholds legend */}
          <View style={styles.tiersRow}>
            {(['bronze', 'silver', 'gold', 'platinum'] as Tier[]).map((t) => (
              <View key={t} style={styles.tierLegendItem}>
                <Text style={[styles.tierLegendEmoji, t === tier && { opacity: 1 }]}>
                  {TIER_CONFIG[t].emoji}
                </Text>
                <Text style={[styles.tierLegendPts, t === tier && { color: tierCfg.color, fontFamily: 'Cairo-Bold' }]}>
                  {toArabic(summary?.tier_thresholds?.[t] ?? 0)}+
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* How it works */}
        <View style={styles.howSection}>
          <Text style={styles.sectionTitle}>كيف تكسب النقاط؟</Text>
          <View style={styles.howRow}>
            <Ionicons name="calendar-outline" size={20} color={TEAL} />
            <Text style={styles.howText}>كل جنيه تدفعه كمقدّم = نقطة واحدة</Text>
          </View>
          <View style={styles.howRow}>
            <Ionicons name="gift-outline" size={20} color={TEAL} />
            <Text style={styles.howText}>كل ١٠٠ نقطة = خصم ٥ ج.م على حجزك القادم</Text>
          </View>
          <View style={styles.howRow}>
            <Ionicons name="time-outline" size={20} color={GRAY} />
            <Text style={[styles.howText, { color: GRAY }]}>تنتهي صلاحية النقاط بعد ١٨ شهراً</Text>
          </View>
        </View>

        {/* Transaction History */}
        <Text style={styles.sectionTitle}>سجل النقاط</Text>

        {historyLoading && <ActivityIndicator color={TEAL} style={{ marginVertical: 16 }} />}

        {history?.transactions?.length === 0 && !historyLoading && (
          <View style={styles.emptyHistory}>
            <Text style={styles.emptyText}>لا توجد معاملات بعد</Text>
            <Text style={styles.emptySubtext}>ابدأ الحجز لكسب نقاطك الأولى!</Text>
          </View>
        )}

        {history?.transactions?.map((tx: any) => {
          const { icon, color } = txIcon(tx.transaction_type);
          const isPositive = tx.points > 0;
          return (
            <View key={tx.id} style={styles.txCard}>
              <Ionicons name={icon as any} size={24} color={color} style={styles.txIcon} />
              <View style={styles.txBody}>
                <Text style={styles.txDesc}>{tx.description_ar ?? (isPositive ? 'نقاط مكتسبة' : 'نقاط مستردة')}</Text>
                {tx.business_name_ar && (
                  <Text style={styles.txBusiness}>{tx.business_name_ar}</Text>
                )}
                <Text style={styles.txDate}>
                  {new Date(tx.created_at).toLocaleDateString('ar-EG', {
                    year: 'numeric', month: 'short', day: 'numeric',
                  })}
                  {tx.expires_at && tx.points > 0 && (
                    ` · تنتهي ${new Date(tx.expires_at).toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' })}`
                  )}
                </Text>
              </View>
              <Text style={[styles.txPoints, { color }]}>
                {isPositive ? '+' : ''}{toArabic(tx.points)} نقطة
              </Text>
            </View>
          );
        })}

        {/* Pagination */}
        {history?.has_more && (
          <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setHistoryPage((p) => p + 1)}>
            <Text style={styles.loadMoreText}>تحميل المزيد</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn:     { padding: 4 },
  headerTitle: { flex: 1, fontFamily: 'Cairo-Bold', fontSize: 20, color: NAVY, textAlign: 'right', marginRight: 12 },

  scrollContent: { padding: 20 },

  // Loyalty card
  loyaltyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  tierEmoji: { fontSize: 20 },
  tierLabel: { fontFamily: 'Cairo-Bold', fontSize: 14 },

  balanceBlock: { alignItems: 'flex-end' },
  balanceNum:   { fontFamily: 'Cairo-Bold', fontSize: 40, color: NAVY, lineHeight: 48 },
  balanceLabel: { fontFamily: 'Cairo-Regular', fontSize: 14, color: GRAY },

  progressSection: { marginBottom: 16 },
  progressLabelRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontFamily: 'Cairo-Regular', fontSize: 12, color: GRAY, flex: 1, textAlign: 'right' },
  progressPct:  { fontFamily: 'Cairo-Bold', fontSize: 12, color: NAVY, marginRight: 8 },
  progressTrack: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progressFill:  { height: 8, borderRadius: 4 },

  platinumMsg: { fontFamily: 'Cairo-Bold', fontSize: 14, textAlign: 'center', marginBottom: 12 },

  redeemBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: TEAL + '11',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  redeemText: { fontFamily: 'Cairo-SemiBold', fontSize: 13, color: TEAL, flex: 1, textAlign: 'right' },

  tiersRow: { flexDirection: 'row-reverse', justifyContent: 'space-around', marginTop: 8 },
  tierLegendItem: { alignItems: 'center', gap: 2 },
  tierLegendEmoji: { fontSize: 18, opacity: 0.5 },
  tierLegendPts: { fontFamily: 'Cairo-Regular', fontSize: 11, color: GRAY },

  // How it works
  howSection: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20 },
  howRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 10 },
  howText: { fontFamily: 'Cairo-Regular', fontSize: 14, color: NAVY, flex: 1, textAlign: 'right' },

  sectionTitle: { fontFamily: 'Cairo-Bold', fontSize: 17, color: NAVY, textAlign: 'right', marginBottom: 12 },

  // Transactions
  txCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  txIcon:     { marginLeft: 4 },
  txBody:     { flex: 1 },
  txDesc:     { fontFamily: 'Cairo-SemiBold', fontSize: 14, color: NAVY, textAlign: 'right' },
  txBusiness: { fontFamily: 'Cairo-Regular', fontSize: 12, color: GRAY, textAlign: 'right', marginTop: 2 },
  txDate:     { fontFamily: 'Cairo-Regular', fontSize: 11, color: GRAY, textAlign: 'right', marginTop: 2 },
  txPoints:   { fontFamily: 'Cairo-Bold', fontSize: 16, minWidth: 70, textAlign: 'left' },

  emptyHistory: { alignItems: 'center', paddingVertical: 32 },
  emptyText:    { fontFamily: 'Cairo-Bold', fontSize: 16, color: NAVY },
  emptySubtext: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY, marginTop: 6 },

  loadMoreBtn:  { alignItems: 'center', paddingVertical: 16 },
  loadMoreText: { fontFamily: 'Cairo-SemiBold', fontSize: 14, color: TEAL },
});
