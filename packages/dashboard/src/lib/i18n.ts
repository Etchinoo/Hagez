// ============================================================
// SUPER RESERVATION PLATFORM — i18n Translations
// Supports Arabic (ar) and English (en).
// Usage: const t = useT(); t('nav_bookings')
// ============================================================

import { useLanguage } from '@/store/language';

export const TRANSLATIONS = {
  ar: {
    // ── Navigation ────────────────────────────────────────────
    nav_bookings:  'الحجوزات',
    nav_analytics: 'الإحصائيات',
    nav_featured:  'الإبراز',
    nav_staff:     'الموظفون',
    nav_courts:    'الملاعب',
    nav_stations:  'المحطات',
    nav_bays:      'البيهات',
    nav_services:  'الخدمات',
    nav_pricing:   'التسعير',
    nav_loyalty:   'الولاء',
    nav_settings:  'الإعدادات',
    nav_profile:   'الملف الشخصي',
    // ── Page titles ───────────────────────────────────────────
    page_bookings:  'الحجوزات',
    page_analytics: 'الإحصائيات',
    page_featured:  'الإبراز',
    page_settings:  'الإعدادات',
    page_pricing:   'التسعير',
    page_staff:     'الموظفون',
    page_services:  'الخدمات',
    page_loyalty:   'الولاء',
    page_courts:    'الملاعب',
    page_stations:  'المحطات',
    page_bays:      'البيهات',
    page_profile:   'الملف الشخصي',
    // ── Upsell box ────────────────────────────────────────────
    upsell_title:   'تعدد الفروع',
    upsell_desc:    'أضف فروعاً متعددة بترقية Growth',
    upsell_cta:     'ترقية الباقة',
    upsell_toast:   'للترقية، تواصل مع فريق Hagez',
    // ── Topbar ────────────────────────────────────────────────
    add_booking:      '+ حجز يدوي',
    add_booking_soon: 'سيتم إضافة الحجز اليدوي قريباً',
    // ── Sidebar footer ────────────────────────────────────────
    logout: 'خروج',
    // ── Auth pages ────────────────────────────────────────────
    auth_business_dashboard: 'لوحة تحكم الأعمال',
    auth_phone_label: 'رقم الهاتف',
    auth_phone_placeholder: '1XXXXXXXXX',
    auth_send_otp: 'إرسال كود التحقق',
    auth_sending: 'جاري الإرسال...',
    auth_otp_label: 'كود التحقق',
    auth_otp_sent_to: 'أرسلنا الكود إلى',
    auth_confirm_login: 'تأكيد الدخول',
    auth_verifying: 'جاري التحقق...',
    auth_change_phone: 'تغيير رقم الهاتف',
    auth_new_business: 'نشاط تجاري جديد؟',
    auth_signup_here: 'سجّل هنا',
    auth_err_phone_required: 'يرجى إدخال رقم الهاتف.',
    auth_err_phone_invalid: 'رقم الهاتف غير صحيح.',
    auth_err_otp_required: 'يرجى إدخال كود التحقق.',
    auth_err_otp_failed: 'فشل إرسال الكود. حاول مرة أخرى.',
    auth_err_otp_invalid: 'الكود غير صحيح أو منتهي الصلاحية.',
    auth_err_no_business: 'هذا الحساب غير مرتبط بنشاط تجاري. تواصل مع فريق Hagez.',
    auth_lang_toggle: 'English',
    // ── Signup page ───────────────────────────────────────────
    signup_title: 'سجّل نشاطك التجاري',
    signup_step_phone: 'أدخل رقم هاتفك لتبدأ',
    signup_step_otp: 'تحقق من رقمك',
    signup_step_details: 'أكمل بيانات نشاطك',
    signup_confirm: 'تأكيد',
    signup_full_name: 'اسمك الكامل *',
    signup_full_name_placeholder: 'مثال: أحمد محمد علي',
    signup_biz_name_ar: 'اسم النشاط التجاري (عربي) *',
    signup_biz_name_ar_placeholder: 'مثال: مطعم النيل الذهبي',
    signup_biz_name_en: 'اسم النشاط (إنجليزي)',
    signup_biz_name_en_placeholder: 'e.g. Golden Nile Restaurant',
    signup_category: 'نوع النشاط *',
    signup_district: 'الحي / المنطقة *',
    signup_district_placeholder: 'مثال: الزمالك، المعادي، مدينة نصر',
    signup_description: 'وصف مختصر (اختياري)',
    signup_description_placeholder: 'اكتب وصفاً قصيراً عن نشاطك...',
    signup_submit: 'تقديم الطلب',
    signup_review_note: 'سيراجع فريق Hagez طلبك خلال 24 ساعة',
    signup_err_required_fields: 'الاسم ونشاطك التجاري والحي كلها حقول مطلوبة.',
    signup_err_business_exists: 'يوجد نشاط تجاري مرتبط بهذا الحساب. يرجى تسجيل الدخول.',
    signup_err_generic: 'حدث خطأ. حاول مرة أخرى.',
    signup_success_title: 'تم استلام طلبك!',
    signup_success_body: 'سيراجع فريق Hagez بيانات نشاطك خلال 24 ساعة وسيتواصل معك عبر واتساب أو رسالة نصية عند الموافقة.',
    signup_go_dashboard: 'الذهاب للوحة التحكم',
    signup_logout: 'تسجيل الخروج',
    signup_has_account: 'لديك حساب بالفعل؟',
    signup_login: 'سجّل الدخول',
    // ── Category labels ───────────────────────────────────────
    cat_restaurant: 'مطعم',
    cat_salon: 'صالون تجميل',
    cat_court: 'ملعب رياضي',
    cat_gaming_cafe: 'كافيه جيمنج',
    cat_car_wash: 'غسيل سيارات',
    cat_medical: 'عيادة طبية',
  },

  en: {
    // ── Navigation ────────────────────────────────────────────
    nav_bookings:  'Bookings',
    nav_analytics: 'Analytics',
    nav_featured:  'Featured',
    nav_staff:     'Staff',
    nav_courts:    'Courts',
    nav_stations:  'Stations',
    nav_bays:      'Bays',
    nav_services:  'Services',
    nav_pricing:   'Pricing',
    nav_loyalty:   'Loyalty',
    nav_settings:  'Settings',
    nav_profile:   'Profile',
    // ── Page titles ───────────────────────────────────────────
    page_bookings:  'Bookings',
    page_analytics: 'Analytics',
    page_featured:  'Featured',
    page_settings:  'Settings',
    page_pricing:   'Pricing',
    page_staff:     'Staff',
    page_services:  'Services',
    page_loyalty:   'Loyalty',
    page_courts:    'Courts',
    page_stations:  'Stations',
    page_bays:      'Bays',
    page_profile:   'Profile',
    // ── Upsell box ────────────────────────────────────────────
    upsell_title: 'Multi-Branch',
    upsell_desc:  'Add multiple branches with a Growth upgrade',
    upsell_cta:   'Upgrade Plan',
    upsell_toast: 'To upgrade, contact the Hagez team',
    // ── Topbar ────────────────────────────────────────────────
    add_booking:      '+ Manual Booking',
    add_booking_soon: 'Manual booking feature coming soon',
    // ── Sidebar footer ────────────────────────────────────────
    logout: 'Logout',
    // ── Auth pages ────────────────────────────────────────────
    auth_business_dashboard: 'Business Dashboard',
    auth_phone_label: 'Phone Number',
    auth_phone_placeholder: '1XXXXXXXXX',
    auth_send_otp: 'Send Verification Code',
    auth_sending: 'Sending...',
    auth_otp_label: 'Verification Code',
    auth_otp_sent_to: 'We sent a code to',
    auth_confirm_login: 'Confirm Login',
    auth_verifying: 'Verifying...',
    auth_change_phone: 'Change Phone Number',
    auth_new_business: 'New business?',
    auth_signup_here: 'Sign up here',
    auth_err_phone_required: 'Please enter your phone number.',
    auth_err_phone_invalid: 'Invalid phone number.',
    auth_err_otp_required: 'Please enter the verification code.',
    auth_err_otp_failed: 'Failed to send code. Please try again.',
    auth_err_otp_invalid: 'Invalid or expired code.',
    auth_err_no_business: 'This account is not linked to a business. Contact the Hagez team.',
    auth_lang_toggle: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629',
    // ── Signup page ───────────────────────────────────────────
    signup_title: 'Register Your Business',
    signup_step_phone: 'Enter your phone number to start',
    signup_step_otp: 'Verify your number',
    signup_step_details: 'Complete your business details',
    signup_confirm: 'Confirm',
    signup_full_name: 'Your Full Name *',
    signup_full_name_placeholder: 'e.g. Ahmed Mohamed Ali',
    signup_biz_name_ar: 'Business Name (Arabic) *',
    signup_biz_name_ar_placeholder: 'e.g. Golden Nile Restaurant',
    signup_biz_name_en: 'Business Name (English)',
    signup_biz_name_en_placeholder: 'e.g. Golden Nile Restaurant',
    signup_category: 'Business Type *',
    signup_district: 'District / Area *',
    signup_district_placeholder: 'e.g. Zamalek, Maadi, Nasr City',
    signup_description: 'Short Description (optional)',
    signup_description_placeholder: 'Write a short description of your business...',
    signup_submit: 'Submit Application',
    signup_review_note: 'The Hagez team will review your application within 24 hours',
    signup_err_required_fields: 'Name, business name, and district are all required.',
    signup_err_business_exists: 'A business is already linked to this account. Please log in.',
    signup_err_generic: 'An error occurred. Please try again.',
    signup_success_title: 'Application Received!',
    signup_success_body: 'The Hagez team will review your business details within 24 hours and will contact you via WhatsApp or SMS upon approval.',
    signup_go_dashboard: 'Go to Dashboard',
    signup_logout: 'Sign Out',
    signup_has_account: 'Already have an account?',
    signup_login: 'Log in',
    // ── Category labels ───────────────────────────────────────
    cat_restaurant: 'Restaurant',
    cat_salon: 'Beauty Salon',
    cat_court: 'Sports Court',
    cat_gaming_cafe: 'Gaming Cafe',
    cat_car_wash: 'Car Wash',
    cat_medical: 'Medical Clinic',
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.ar;

/** Hook — returns a translate function scoped to the current language. */
export function useT() {
  const lang = useLanguage((s) => s.lang);
  return (key: TranslationKey): string => TRANSLATIONS[lang][key];
}

/** Hook — returns language metadata for page-level use.
 *  dir: CSS direction value ('rtl' | 'ltr')
 *  align: natural text-align for the language ('right' | 'left')
 */
export function useLang() {
  const lang = useLanguage((s) => s.lang);
  const isRtl = lang === 'ar';
  return {
    lang,
    isRtl,
    dir:   (isRtl ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
    align: (isRtl ? 'right' : 'left') as 'right' | 'left',
  };
}
