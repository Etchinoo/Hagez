// ============================================================
// SUPER RESERVATION PLATFORM — Privacy Policy Screen (US-081)
// EP-19: PDPL 2020 compliance — shown after OTP verification.
// Consumer must scroll to bottom before Accept CTA activates.
// Consent stored with IP + policy version.
// ============================================================

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { complianceApi } from '../services/api';

const NAVY = '#0F2044';
const TEAL = '#1B8A7A';
const GRAY = '#9CA3AF';

const POLICY_VERSION = '1.0';

const POLICY_TEXT = `سياسة الخصوصية — سوبر ريزرفيشن
الإصدار ${POLICY_VERSION} | سارية اعتباراً من يناير ٢٠٢٥

١. مقدمة
تلتزم شركة سوبر ريزرفيشن ("المنصة") بحماية خصوصيتك وبياناتك الشخصية وفقاً لقانون حماية البيانات الشخصية المصري رقم ١٥١ لسنة ٢٠٢٠ (PDPL 2020).

٢. البيانات التي نجمعها
• رقم الهاتف المحمول (لتسجيل الدخول والتواصل)
• الاسم الكامل وعنوان البريد الإلكتروني (اختياري)
• بيانات الحجوزات والمدفوعات
• بيانات الموقع الجغرافي عند استخدام ميزة "قريبة منك" (بإذنك)
• رمز إشعارات Firebase (FCM)

٣. كيف نستخدم بياناتك
• إتمام وإدارة الحجوزات
• إرسال إشعارات التأكيد والتذكير عبر واتساب والرسائل القصيرة
• تحسين تجربة الاستخدام والبحث
• الامتثال للمتطلبات القانونية والمحاسبية

٤. مشاركة البيانات
لا نبيع بياناتك الشخصية. نشاركها فقط مع:
• الأماكن التي تحجز فيها (الاسم وحجم المجموعة والطلبات الخاصة)
• مزودي خدمة الدفع (Paymob) لإتمام المعاملات المالية
• منصات التواصل (360dialog) لإرسال الإشعارات
• السلطات القانونية عند الاقتضاء القانوني

٥. حقوقك (PDPL 2020)
لك الحق في:
• الاطلاع على بياناتك (المادة ١٦) — طلب تصدير كامل لبياناتك
• تصحيح بياناتك غير الدقيقة (المادة ١٧)
• حذف بياناتك (المادة ١٧) — حق النسيان مع الاحتفاظ بسجل محاسبي مجهول الهوية
• سحب الموافقة في أي وقت

٦. الاحتفاظ بالبيانات
• بيانات الحجوزات: ٢٤ شهراً من تاريخ الإتمام أو الإلغاء
• البيانات المالية: ٥ سنوات وفقاً للقانون المصري
• البيانات المحذوفة: تُعدم خلال ٣٠ يوماً من طلب الحذف

٧. الأمان
نستخدم تشفير TLS لجميع البيانات أثناء النقل، وتشفير AES-256 للبيانات المخزنة. نُخزّن بياناتك على خوادم AWS في منطقة الشرق الأوسط (البحرين).

٨. ملفات تعريف الارتباط والتتبع
لا نستخدم ملفات تعريف الارتباط في التطبيق. قد نستخدم تحليلات مجهولة الهوية لتحسين الأداء.

٩. التواصل معنا
لأي استفسارات تتعلق بالخصوصية:
البريد الإلكتروني: privacy@reservr.eg
العنوان: القاهرة، جمهورية مصر العربية

١٠. تحديثات السياسة
عند تحديث هذه السياسة، سنُخطرك عبر التطبيق ونطلب موافقتك من جديد على أي تغييرات جوهرية.`;

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [hasScrolled, setHasScrolled] = useState(false);

  const mutation = useMutation({
    mutationFn: () => complianceApi.acceptPrivacyPolicy(POLICY_VERSION),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      router.replace('/(tabs)');
    },
  });

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 60;
    if (isNearBottom) setHasScrolled(true);
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>سياسة الخصوصية</Text>
        <Text style={styles.subtitle}>اقرأ وافق لمتابعة استخدام المنصة</Text>
        <View style={styles.versionBadge}>
          <Text style={styles.versionText}>الإصدار {POLICY_VERSION} · PDPL 2020</Text>
        </View>
      </View>

      {/* Policy text — must scroll to bottom */}
      <ScrollView
        style={styles.policyScroll}
        contentContainerStyle={styles.policyContent}
        onScroll={onScroll}
        scrollEventThrottle={200}
        showsVerticalScrollIndicator
      >
        <Text style={styles.policyText}>{POLICY_TEXT}</Text>
        <View style={styles.scrollEndMarker}>
          <Text style={styles.scrollEndText}>✓ وصلت إلى نهاية سياسة الخصوصية</Text>
        </View>
      </ScrollView>

      {/* Scroll hint */}
      {!hasScrolled && (
        <View style={styles.scrollHint}>
          <Text style={styles.scrollHintText}>↓ اسحب للأسفل للقراءة والموافقة</Text>
        </View>
      )}

      {/* Accept CTA */}
      <View style={styles.ctaArea}>
        <Text style={styles.ctaCaption}>
          بالنقر على "أوافق"، فأنت توافق على سياسة الخصوصية وشروط الاستخدام.
        </Text>
        <TouchableOpacity
          style={[styles.acceptBtn, !hasScrolled && styles.acceptBtnDisabled]}
          onPress={() => mutation.mutate()}
          disabled={!hasScrolled || mutation.isPending}
          activeOpacity={0.85}
        >
          {mutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.acceptBtnText}>أوافق على سياسة الخصوصية</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },

  header: { backgroundColor: NAVY, paddingTop: 60, paddingBottom: 20, paddingHorizontal: 24, alignItems: 'flex-end' },
  title:    { fontFamily: 'Cairo-Bold', fontSize: 22, color: '#fff', textAlign: 'right' },
  subtitle: { fontFamily: 'Cairo-Regular', fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'right', marginTop: 4 },
  versionBadge: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  versionText: { fontFamily: 'Cairo-Regular', fontSize: 12, color: '#fff' },

  policyScroll: { flex: 1 },
  policyContent: { padding: 24, paddingBottom: 40 },
  policyText: { fontFamily: 'Cairo-Regular', fontSize: 14, color: '#374151', lineHeight: 26, textAlign: 'right' },

  scrollEndMarker: { marginTop: 24, alignItems: 'center', paddingVertical: 12, backgroundColor: '#D1FAE5', borderRadius: 10 },
  scrollEndText: { fontFamily: 'Cairo-SemiBold', fontSize: 13, color: '#065F46' },

  scrollHint: { backgroundColor: '#FEF3C7', paddingVertical: 10, paddingHorizontal: 24, alignItems: 'center' },
  scrollHintText: { fontFamily: 'Cairo-SemiBold', fontSize: 13, color: '#92400E' },

  ctaArea: { backgroundColor: '#fff', padding: 20, paddingBottom: 36, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  ctaCaption: { fontFamily: 'Cairo-Regular', fontSize: 12, color: GRAY, textAlign: 'center', marginBottom: 14 },
  acceptBtn: { backgroundColor: TEAL, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  acceptBtnDisabled: { backgroundColor: '#D1D5DB' },
  acceptBtnText: { fontFamily: 'Cairo-Bold', fontSize: 17, color: '#fff' },
});
