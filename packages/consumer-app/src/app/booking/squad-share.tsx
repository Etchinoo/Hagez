// ============================================================
// SUPER RESERVATION PLATFORM — Squad Share Card (US-085)
// Generates a shareable card for court bookings.
// Shown via "Share with squad" button on confirmed.tsx.
// Uses react-native Share to share as text (image capture
// requires react-native-view-shot, plugged in when available).
// ============================================================

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const NAVY  = '#0F2044';
const GREEN = '#2E7D32';
const GRAY  = '#9CA3AF';

const SPORT_LABELS: Record<string, string> = {
  football:   'كرة القدم',
  basketball: 'كرة السلة',
  tennis:     'تنس',
  padel:      'بادل',
  squash:     'إسكواش',
  volleyball: 'كرة الطائرة',
};

const SPORT_EMOJI: Record<string, string> = {
  football:   '⚽',
  basketball: '🏀',
  tennis:     '🎾',
  padel:      '🏸',
  squash:     '🟡',
  volleyball: '🏐',
};

export default function SquadShareScreen() {
  const {
    booking_ref,
    business_name,
    sport_type,
    slot_time,
    duration_minutes,
    player_count,
  } = useLocalSearchParams<{
    booking_ref: string;
    business_name: string;
    sport_type: string;
    slot_time: string;     // ISO string
    duration_minutes: string;
    player_count: string;
  }>();

  const router = useRouter();

  const formattedTime = slot_time
    ? new Date(slot_time).toLocaleString('ar-EG', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Cairo',
      })
    : '';

  const durationLabel =
    Number(duration_minutes) === 60 ? 'ساعة واحدة' :
    Number(duration_minutes) === 90 ? 'ساعة ونصف' :
    Number(duration_minutes) === 120 ? 'ساعتان' :
    `${duration_minutes} دقيقة`;

  const sportLabel = SPORT_LABELS[sport_type] ?? sport_type;
  const sportEmoji = SPORT_EMOJI[sport_type] ?? '⚽';

  async function handleShare() {
    const message = [
      `${sportEmoji} يلا نلعب ${sportLabel}! ${sportEmoji}`,
      ``,
      `📍 ${business_name}`,
      `📅 ${formattedTime}`,
      `⏱ ${durationLabel}`,
      `👥 ${player_count} لاعبين`,
      ``,
      `رقم الحجز: ${booking_ref}`,
      ``,
      `مع تحيات Reservr 🏅`,
    ].join('\n');

    await Share.share({ message });
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={22} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>شارك مع الفريق</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Share card preview */}
        <View style={styles.card}>
          {/* Green banner */}
          <View style={styles.cardBanner}>
            <Text style={styles.cardBannerEmoji}>{sportEmoji}</Text>
            <Text style={styles.cardBannerText}>يلا نلعب {sportLabel}!</Text>
            <Text style={styles.cardBannerEmoji}>{sportEmoji}</Text>
          </View>

          {/* Card body */}
          <View style={styles.cardBody}>
            <Text style={styles.cardBusinessName}>{business_name}</Text>

            <View style={styles.cardRow}>
              <Ionicons name="calendar-outline" size={16} color={GRAY} />
              <Text style={styles.cardRowText}>{formattedTime}</Text>
            </View>
            <View style={styles.cardRow}>
              <Ionicons name="time-outline" size={16} color={GRAY} />
              <Text style={styles.cardRowText}>{durationLabel}</Text>
            </View>
            <View style={styles.cardRow}>
              <Ionicons name="people-outline" size={16} color={GRAY} />
              <Text style={styles.cardRowText}>{player_count} لاعبين</Text>
            </View>

            <View style={styles.cardDivider} />

            <Text style={styles.cardRef}>{booking_ref}</Text>
            <Text style={styles.cardFooter}>مع تحيات Reservr 🏅</Text>
          </View>
        </View>

        <Text style={styles.hint}>اضغط "شارك مع الفريق" لإرسال رابط الحجز</Text>
      </ScrollView>

      {/* Share button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
          <Ionicons name="share-social-outline" size={20} color="#fff" style={{ marginLeft: 8 }} />
          <Text style={styles.shareBtnText}>شارك مع الفريق</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },

  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: 'Cairo-Bold', fontSize: 18, color: NAVY },

  content: { padding: 24, paddingBottom: 120, alignItems: 'center' },

  card: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 20,
  },

  cardBanner: {
    backgroundColor: GREEN,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  cardBannerEmoji: { fontSize: 32 },
  cardBannerText: { fontFamily: 'Cairo-Bold', fontSize: 22, color: '#fff' },

  cardBody: { padding: 24 },
  cardBusinessName: { fontFamily: 'Cairo-Bold', fontSize: 20, color: NAVY, textAlign: 'right', marginBottom: 16 },

  cardRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 10 },
  cardRowText: { fontFamily: 'Cairo-Regular', fontSize: 15, color: '#374151', textAlign: 'right', flex: 1 },

  cardDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 16 },

  cardRef: { fontFamily: 'Inter-Medium', fontSize: 18, color: NAVY, textAlign: 'center', letterSpacing: 2, marginBottom: 10 },
  cardFooter: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY, textAlign: 'center' },

  hint: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY, textAlign: 'center' },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 20, paddingBottom: 34, borderTopWidth: 1, borderTopColor: '#F0F0F0', elevation: 6 },
  shareBtn: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 16, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center' },
  shareBtnText: { fontFamily: 'Cairo-Bold', fontSize: 18, color: '#fff' },
});
