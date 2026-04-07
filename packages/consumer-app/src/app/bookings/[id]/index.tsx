// ============================================================
// SUPER RESERVATION PLATFORM — Booking Detail Screen (US-026)
// Shows full booking info, cancel + reschedule actions,
// review CTA for completed bookings.
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Animated, Modal, TextInput, Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { bookingApi } from '../../../services/api';
import { toArabic } from '../../../utils/numerals';

const NAVY = '#0F2044';
const TEAL = '#1B8A7A';
const ORANGE = '#D4622A';
const GRAY = '#9CA3AF';
const RED = '#D32F2F';

// ── Skeleton ──────────────────────────────────────────────────

function BookingDetailSkeleton() {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const Sk = ({ w, h, mb = 8 }: { w: string | number; h: number; mb?: number }) => (
    <Animated.View style={{ backgroundColor: '#E5E7EB', borderRadius: 6, width: w, height: h, marginBottom: mb, opacity }} />
  );
  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA', padding: 20, paddingTop: 12 }}>
      <Sk w="100%" h={44} mb={16} />
      <Sk w="100%" h={90} mb={16} />
      {[1, 2, 3, 4, 5].map((i) => (
        <Sk key={i} w="100%" h={44} mb={8} />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  confirmed:             { label: 'مؤكد',              color: TEAL,   bg: '#E8F5F3' },
  pending_payment:       { label: 'في انتظار الدفع',    color: '#F59E0B', bg: '#FFF8E1' },
  completed:             { label: 'مكتمل',              color: '#6B7280', bg: '#F5F5F5' },
  cancelled_by_consumer: { label: 'ملغي منك',           color: RED,    bg: '#FFEBEE' },
  cancelled_by_business: { label: 'ملغي من المكان',     color: RED,    bg: '#FFEBEE' },
  no_show:               { label: 'غياب',               color: RED,    bg: '#FFEBEE' },
  disputed:              { label: 'قيد المراجعة',        color: '#F59E0B', bg: '#FFF8E1' },
};

const CANCEL_REASONS = [
  { id: 'changed_mind',  label: 'غيّرت رأيي' },
  { id: 'emergency',     label: 'ظرف طارئ' },
  { id: 'wrong_booking', label: 'حجز خاطئ' },
  { id: 'other',         label: 'أخرى' },
];

const DISPUTE_REASONS = [
  { id: 'i_was_present',     label: 'كنت موجوداً ولم يُسجَّل حضوري' },
  { id: 'cancelled_on_time', label: 'ألغيت في الوقت المحدد' },
  { id: 'business_error',    label: 'خطأ من المكان' },
  { id: 'other',             label: 'أخرى' },
];

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | undefined>();
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState<string | undefined>();
  const [disputeDescription, setDisputeDescription] = useState('');

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingApi.getBooking(id).then((r) => r.data),
    enabled: !!id,
  });

  async function handleShare() {
    if (!booking) return;
    const slotTimeStr = booking.slot?.start_time
      ? new Date(booking.slot.start_time).toLocaleString('ar-EG', {
          weekday: 'long', day: 'numeric', month: 'long',
          hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo',
        })
      : '';
    await Share.share({
      message: `حجزت في ${booking.business?.name_ar ?? ''} 🎉\nرقم الحجز: ${booking.booking_ref}\nالموعد: ${slotTimeStr}`,
    });
  }

  const cancelMutation = useMutation({
    mutationFn: () => bookingApi.cancelBooking(id, selectedReason).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      setCancelModalOpen(false);
      Alert.alert('تم الإلغاء', data.message_ar ?? 'تم إلغاء حجزك بنجاح.');
    },
    onError: (err: any) => {
      Alert.alert('خطأ', err.response?.data?.error?.message_ar ?? 'فشل الإلغاء.');
    },
  });

  const disputeMutation = useMutation({
    mutationFn: () =>
      bookingApi.submitDispute(id, disputeReason!, disputeDescription || undefined).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setDisputeModalOpen(false);
      Alert.alert('تم استقبال اعتراضك ✅', data.message_ar ?? 'سيتم مراجعة اعتراضك خلال 72 ساعة.');
    },
    onError: (err: any) => {
      Alert.alert('خطأ', err.response?.data?.error?.message_ar ?? 'فشل تقديم الاعتراض.');
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () => bookingApi.submitReview(id, rating, reviewText || undefined).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      setReviewModalOpen(false);
      Alert.alert('شكرًا! 🌟', 'تم إرسال تقييمك للمراجعة.');
    },
    onError: (err: any) => {
      Alert.alert('خطأ', err.response?.data?.error?.message_ar ?? 'فشل إرسال التقييم.');
    },
  });

  if (isLoading) {
    return <BookingDetailSkeleton />;
  }

  if (!booking) {
    return (
      <View style={styles.loading}>
        <Text style={{ fontFamily: 'Cairo-Regular', color: GRAY }}>لم يُعثر على الحجز</Text>
      </View>
    );
  }

  const statusCfg = STATUS_CONFIG[booking.status] ?? { label: booking.status, color: GRAY, bg: '#F5F5F5' };
  const slotTime = booking.slot?.start_time
    ? new Date(booking.slot.start_time).toLocaleString('ar-EG', {
        weekday: 'long', day: 'numeric', month: 'long',
        hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo',
      })
    : '';

  const isUpcoming = booking.status === 'confirmed';
  const isCompleted = booking.status === 'completed';
  const hasReview = !!booking.review;

  // US-040: Dispute window — 24h from no_show_detected_at
  const isNoShow = booking.status === 'no_show';
  const noShowDetectedAt = booking.no_show_detected_at ? new Date(booking.no_show_detected_at).getTime() : null;
  const disputeWindowOpen = isNoShow && noShowDetectedAt !== null
    && Date.now() - noShowDetectedAt < 24 * 60 * 60 * 1000;
  const alreadyDisputed = !!booking.dispute_submitted_at;

  // Cancellation window check (client-side pre-check)
  const slotMs = booking.slot?.start_time ? new Date(booking.slot.start_time).getTime() : Infinity;
  const windowHours = booking.slot?.cancellation_window_hours ?? 24;
  const insideWindow = slotMs - Date.now() < windowHours * 60 * 60 * 1000;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={22} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تفاصيل الحجز</Text>
        <TouchableOpacity onPress={handleShare} style={styles.backBtn}>
          <Ionicons name="share-outline" size={22} color={TEAL} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusCfg.bg }]}>
          <Text style={[styles.statusLabel, { color: statusCfg.color }]}>{statusCfg.label}</Text>
        </View>

        {/* Booking ref */}
        <View style={styles.refCard}>
          <Text style={styles.refLabel}>رقم الحجز</Text>
          <Text style={styles.refValue}>{booking.booking_ref}</Text>
        </View>

        {/* Details */}
        <View style={styles.detailsCard}>
          <DetailRow icon="storefront-outline" label="المكان" value={booking.business?.name_ar ?? ''} />
          <DetailRow icon="location-outline" label="المنطقة" value={booking.business?.district ?? ''} />
          <DetailRow icon="calendar-outline" label="الموعد" value={slotTime} />
          <DetailRow icon="people-outline" label="عدد الأشخاص" value={`${toArabic(booking.party_size)} أشخاص`} />
          <DetailRow icon="card-outline" label="العربون" value={`${Number(booking.deposit_amount)} ج.م`} />
          <DetailRow icon="receipt-outline" label="رسوم الخدمة" value={`${Number(booking.platform_fee)} ج.م`} />
        </View>

        {/* Inside-window warning */}
        {isUpcoming && insideWindow && (
          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={16} color={ORANGE} />
            <Text style={styles.warningText}>
              الإلغاء الآن داخل نافذة السياسة — العربون لن يُسترد.
            </Text>
          </View>
        )}

        {/* Actions for upcoming bookings */}
        {isUpcoming && (
          <View style={styles.actionGroup}>
            <TouchableOpacity
              style={styles.rescheduleBtn}
              onPress={() =>
                router.push({
                  pathname: '/booking/checkout',
                  params: { business_id: booking.business_id, reschedule_booking_id: id },
                })
              }
            >
              <Ionicons name="calendar-outline" size={18} color={TEAL} />
              <Text style={styles.rescheduleBtnText}>تغيير الموعد</Text>
              {(booking.reschedule_count ?? 0) >= 2 && (
                <Text style={styles.limitTag}>وصلت للحد الأقصى</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setCancelModalOpen(true)}
            >
              <Ionicons name="close-circle-outline" size={18} color={RED} />
              <Text style={styles.cancelBtnText}>إلغاء الحجز</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Review CTA for completed bookings */}
        {isCompleted && !hasReview && (
          <TouchableOpacity style={styles.reviewCta} onPress={() => setReviewModalOpen(true)}>
            <Text style={styles.reviewCtaEmoji}>🌟</Text>
            <Text style={styles.reviewCtaText}>قيّم تجربتك</Text>
            <Ionicons name="chevron-back" size={18} color={TEAL} />
          </TouchableOpacity>
        )}

        {isCompleted && hasReview && (
          <View style={styles.reviewDone}>
            <Ionicons name="checkmark-circle" size={18} color={TEAL} />
            <Text style={styles.reviewDoneText}>شكرًا على تقييمك!</Text>
          </View>
        )}

        {/* US-040: No-show dispute CTA */}
        {isNoShow && disputeWindowOpen && !alreadyDisputed && (
          <TouchableOpacity style={styles.disputeCta} onPress={() => setDisputeModalOpen(true)}>
            <Ionicons name="flag-outline" size={20} color={ORANGE} />
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.disputeCtaTitle}>اعترض على الغياب</Text>
              <Text style={styles.disputeCtaSubtitle}>تنتهي مهلة الاعتراض خلال 24 ساعة من رصد الغياب</Text>
            </View>
            <Ionicons name="chevron-back" size={16} color={ORANGE} />
          </TouchableOpacity>
        )}

        {isNoShow && alreadyDisputed && (
          <View style={[styles.reviewDone, { backgroundColor: '#FFF8E1', borderRadius: 12, padding: 12 }]}>
            <Ionicons name="time-outline" size={18} color="#F59E0B" />
            <Text style={[styles.reviewDoneText, { color: '#F59E0B', marginRight: 8 }]}>
              اعتراضك قيد المراجعة — سيتم الرد خلال 72 ساعة
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Cancel modal */}
      <Modal visible={cancelModalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCancelModalOpen(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCancelModalOpen(false)}>
              <Text style={styles.modalClose}>إغلاق</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>إلغاء الحجز</Text>
            <View style={{ width: 40 }} />
          </View>

          {insideWindow && (
            <View style={[styles.warningBox, { margin: 20, marginBottom: 0 }]}>
              <Ionicons name="warning-outline" size={16} color={RED} />
              <Text style={[styles.warningText, { color: RED }]}>
                العربون لن يُسترد — أنت داخل نافذة الإلغاء.
              </Text>
            </View>
          )}

          <ScrollView style={styles.modalBody}>
            <Text style={styles.cancelReasonTitle}>سبب الإلغاء (اختياري)</Text>
            {CANCEL_REASONS.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.reasonRow, selectedReason === r.id && styles.reasonRowSelected]}
                onPress={() => setSelectedReason(selectedReason === r.id ? undefined : r.id)}
              >
                <Text style={[styles.reasonLabel, selectedReason === r.id && { color: TEAL }]}>{r.label}</Text>
                {selectedReason === r.id && <Ionicons name="checkmark-circle" size={18} color={TEAL} />}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.confirmCancelBtn}
              onPress={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              <Text style={styles.confirmCancelText}>
                {cancelMutation.isPending ? 'جاري الإلغاء...' : 'تأكيد الإلغاء'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Dispute modal (US-040) */}
      <Modal visible={disputeModalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDisputeModalOpen(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setDisputeModalOpen(false)}>
              <Text style={styles.modalClose}>إغلاق</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>اعتراض على الغياب</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={[styles.warningBox, { marginBottom: 20 }]}>
              <Ionicons name="information-circle-outline" size={16} color={ORANGE} />
              <Text style={styles.warningText}>
                سيتم مراجعة اعتراضك من فريق العمليات خلال 72 ساعة. ستتوقف أي خصومات حتى صدور القرار.
              </Text>
            </View>

            <Text style={styles.cancelReasonTitle}>سبب الاعتراض</Text>
            {DISPUTE_REASONS.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.reasonRow, disputeReason === r.id && styles.reasonRowSelected]}
                onPress={() => setDisputeReason(disputeReason === r.id ? undefined : r.id)}
              >
                <Text style={[styles.reasonLabel, disputeReason === r.id && { color: TEAL }]}>{r.label}</Text>
                {disputeReason === r.id && <Ionicons name="checkmark-circle" size={18} color={TEAL} />}
              </TouchableOpacity>
            ))}

            <Text style={[styles.cancelReasonTitle, { marginTop: 16 }]}>تفاصيل إضافية (اختياري)</Text>
            <TextInput
              style={styles.disputeInput}
              value={disputeDescription}
              onChangeText={(t) => setDisputeDescription(t.slice(0, 300))}
              placeholder="أخبرنا بما حدث بالتفصيل..."
              placeholderTextColor={GRAY}
              multiline
              textAlign="right"
              writingDirection="rtl"
              maxLength={300}
            />
            <Text style={[styles.charCount, { textAlign: 'left' }]}>{disputeDescription.length}/300</Text>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.confirmCancelBtn, { backgroundColor: ORANGE }, !disputeReason && { backgroundColor: GRAY }]}
              onPress={() => disputeMutation.mutate()}
              disabled={!disputeReason || disputeMutation.isPending}
            >
              <Text style={styles.confirmCancelText}>
                {disputeMutation.isPending ? 'جاري الإرسال...' : 'تقديم الاعتراض'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Review modal */}
      <Modal visible={reviewModalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setReviewModalOpen(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setReviewModalOpen(false)}>
              <Text style={styles.modalClose}>إغلاق</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>قيّم {booking.business?.name_ar}</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Star rating */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => setRating(s)}>
                  <Ionicons name={s <= rating ? 'star' : 'star-outline'} size={40} color="#F59E0B" />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.confirmCancelBtn, { backgroundColor: TEAL }, rating === 0 && { backgroundColor: GRAY }]}
              onPress={() => reviewMutation.mutate()}
              disabled={rating === 0 || reviewMutation.isPending}
            >
              <Text style={styles.confirmCancelText}>
                {reviewMutation.isPending ? 'جاري الإرسال...' : 'إرسال التقييم'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailValue}>{value}</Text>
      <View style={styles.detailLeft}>
        <Ionicons name={icon} size={15} color={GRAY} />
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 8 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontFamily: 'Cairo-Bold', fontSize: 18, color: NAVY, textAlign: 'center' },
  body: { padding: 20 },

  statusBanner: { borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginBottom: 16 },
  statusLabel: { fontFamily: 'Cairo-Bold', fontSize: 16 },

  refCard: { backgroundColor: NAVY, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 16 },
  refLabel: { fontFamily: 'Cairo-Regular', fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 6 },
  refValue: { fontFamily: 'Inter-Medium', fontSize: 22, color: '#fff', letterSpacing: 2 },

  detailsCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  detailRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  detailLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailLabel: { fontFamily: 'Cairo-Regular', fontSize: 13, color: GRAY },
  detailValue: { fontFamily: 'Cairo-SemiBold', fontSize: 14, color: NAVY, flex: 1, textAlign: 'right', marginLeft: 12 },

  warningBox: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFF3E0', borderRadius: 12, padding: 12, marginBottom: 16 },
  warningText: { fontFamily: 'Cairo-Regular', fontSize: 13, color: ORANGE, flex: 1, textAlign: 'right' },

  actionGroup: { gap: 10, marginBottom: 16 },
  rescheduleBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#E8F5F3', borderRadius: 14, padding: 16 },
  rescheduleBtnText: { fontFamily: 'Cairo-SemiBold', fontSize: 16, color: TEAL, flex: 1 },
  limitTag: { fontFamily: 'Cairo-Regular', fontSize: 11, color: GRAY, backgroundColor: '#E5E7EB', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  cancelBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#FFEBEE', borderRadius: 14, padding: 16 },
  cancelBtnText: { fontFamily: 'Cairo-SemiBold', fontSize: 16, color: RED },

  reviewCta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: '#FFF8E1', borderRadius: 14, padding: 16, marginBottom: 16 },
  reviewCtaEmoji: { fontSize: 22 },
  reviewCtaText: { fontFamily: 'Cairo-SemiBold', fontSize: 16, color: '#F59E0B', flex: 1 },
  reviewDone: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 16 },
  reviewDoneText: { fontFamily: 'Cairo-SemiBold', fontSize: 15, color: TEAL },

  // Modals
  modal: { flex: 1, backgroundColor: '#F7F8FA' },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  modalTitle: { fontFamily: 'Cairo-Bold', fontSize: 17, color: NAVY },
  modalClose: { fontFamily: 'Cairo-SemiBold', fontSize: 15, color: GRAY },
  modalBody: { flex: 1, padding: 20 },
  modalFooter: { padding: 20, paddingBottom: 36, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0' },

  cancelReasonTitle: { fontFamily: 'Cairo-Bold', fontSize: 15, color: NAVY, textAlign: 'right', marginBottom: 12 },
  reasonRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, marginBottom: 10 },
  reasonRowSelected: { borderColor: TEAL, backgroundColor: '#E8F5F3' },
  reasonLabel: { fontFamily: 'Cairo-SemiBold', fontSize: 15, color: NAVY },

  confirmCancelBtn: { backgroundColor: RED, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  confirmCancelText: { fontFamily: 'Cairo-Bold', fontSize: 17, color: '#fff' },

  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 32, marginBottom: 24 },

  disputeCta: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#FFF3E0', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1.5, borderColor: ORANGE + '40' },
  disputeCtaTitle: { fontFamily: 'Cairo-Bold', fontSize: 15, color: ORANGE },
  disputeCtaSubtitle: { fontFamily: 'Cairo-Regular', fontSize: 12, color: GRAY, marginTop: 2 },
  disputeInput: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontFamily: 'Cairo-Regular', fontSize: 14, color: NAVY, minHeight: 100, textAlignVertical: 'top' },
  charCount: { fontFamily: 'Cairo-Regular', fontSize: 11, color: GRAY, marginTop: 4 },
});
