// ============================================================
// SUPER RESERVATION PLATFORM — Settings Page
// Tab 1: Working hours / slot generation
// Tab 2: Deposit & cancellation policy (US-033)
// Tab 3: Payout preferences (US-036)
// Tab 4: Notification preferences (US-049)
// Tab 5+: Category-specific config
// Fully bilingual AR/EN with RTL/LTR direction.
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { slotsApi, businessApi, sectionsApi, courtConfigApi, gamingConfigApi, carWashConfigApi } from '@/services/api';
import { useToast } from '@/components/Toast';
import { useDashboardAuth } from '@/store/auth';
import { useLang } from '@/lib/i18n';
import DashboardShell from '@/components/DashboardShell';
import { markOnboardingStep } from '@/lib/onboardingUtils';

// ── Bilingual copy ────────────────────────────────────────────

const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_EN = ['Sunday',  'Monday',  'Tuesday',  'Wednesday', 'Thursday', 'Friday',  'Saturday'];

const SC = {
  ar: {
    // ── AvailabilityTab ───────────────────────────────
    avail_desc:       'حدد أيام عملك وأوقات الحجوزات. سيتم إنشاء المواعيد تلقائياً للـ 4 أسابيع القادمة.',
    avail_to:         'إلى',
    avail_duration:   'مدة الجلسة (دقيقة)',
    avail_capacity:   'الطاقة الاستيعابية',
    avail_deposit:    'العربون (ج.م)',
    avail_save:       'حفظ وإنشاء المواعيد',
    avail_toast_ok:   'تم حفظ أوقات العمل بنجاح',
    avail_toast_err:  'فشل الحفظ. حاول مرة أخرى.',
    // ── PolicyTab ─────────────────────────────────────
    policy_desc:      'حدد مبلغ العربون وسياسة الإلغاء. التغييرات تسري على الحجوزات الجديدة فقط.',
    policy_type_hdr:  'نوع العربون',
    policy_fixed:     'مبلغ ثابت (ج.م)',
    policy_pct:       'نسبة مئوية (%)',
    policy_fixed_lbl: 'مبلغ العربون (ج.م)',
    policy_pct_lbl:   'نسبة العربون (%)',
    policy_cancel_hdr:'نافذة الإلغاء المجاني',
    policy_cancel_desc:'الإلغاء قبل هذه المدة = استرداد كامل. بعدها = يُحتجز العربون.',
    policy_cancel_lbl:'ساعة قبل الموعد',
    policy_no_refund: '⚠️ العربون غير قابل للاسترداد في جميع الأحوال',
    policy_preview_hdr:'معاينة كما يراها العميل',
    policy_fee_note:  '* رسوم المنصة تُضاف تلقائياً على كل حجز وفقاً لفئة نشاطك التجاري',
    policy_save:      'حفظ السياسة',
    policy_toast_ok:  'تم حفظ سياسة العربون بنجاح',
    policy_toast_err: 'فشل الحفظ. حاول مرة أخرى.',
    // ── PayoutTab ─────────────────────────────────────
    payout_desc:      'يتم تحويل مستحقاتك يومياً الساعة 11 مساءً بتوقيت القاهرة.',
    payout_method_hdr:'طريقة الاستلام',
    payout_wallet_lbl:'محفظة Paymob',
    payout_wallet_sub:'يُحول مباشرة إلى محفظتك في Paymob',
    payout_bank_lbl:  'تحويل بنكي',
    payout_bank_sub:  'يُحول إلى حساب البنك المرتبط بـ Paymob',
    payout_thresh_hdr:'الحد الأدنى للتحويل',
    payout_thresh_desc:'إذا كان المبلغ المتراكم أقل من الحد الأدنى، يُؤجل التحويل لليوم التالي.',
    payout_thresh_lbl:'ج.م',
    payout_save:      'حفظ إعدادات الاستلام',
    payout_toast_ok:  'تم حفظ إعدادات المدفوعات بنجاح',
    payout_toast_err: 'فشل الحفظ. حاول مرة أخرى.',
    // ── NotificationsTab ──────────────────────────────
    notif_desc:       'تحكم في الإشعارات التي تتلقاها عبر التطبيق وواتساب.',
    notif_hdr:        'إعدادات الإشعارات',
    notif1_title:     'إشعار حجز جديد',
    notif1_sub:       'إشعار فوري على لوحة التحكم عند وصول حجز جديد',
    notif2_title:     'إشعار الإلغاء',
    notif2_sub:       'إشعار فوري عند إلغاء أحد العملاء لحجزه',
    notif3_title:     'إشعار التحويل المالي',
    notif3_sub:       'رسالة واتساب عند إرسال مستحقاتك أو في حالة فشل التحويل',
    notif_save:       'حفظ إعدادات الإشعارات',
    notif_toast_ok:   'تم حفظ إعدادات الإشعارات بنجاح',
    notif_toast_err:  'فشل الحفظ. حاول مرة أخرى.',
    // ── SectionsTab ───────────────────────────────────
    sec_desc:         'أضف أقسام قاعتك (داخلي، خارجي، VIP...) لتمكين تفضيلات الحجز.',
    sec_new_hdr:      'قسم جديد',
    sec_name_ar:      'الاسم بالعربية *',
    sec_capacity:     'السعة (عدد الأشخاص)',
    sec_cancel:       'إلغاء',
    sec_add:          'إضافة',
    sec_add_btn:      '+ إضافة قسم',
    sec_loading:      'جاري التحميل...',
    sec_empty:        'لم تضف أقساماً بعد',
    sec_cap_lbl:      'سعة',
    sec_person:       'شخص',
    sec_inactive_sfx: '(معطّل)',
    sec_deactivate:   'تعطيل',
    sec_activate:     'تفعيل',
    sec_fail:         'فشل الإضافة. حاول مرة أخرى.',
    // ── CourtConfigTab ────────────────────────────────
    court_sports_hdr:   'الرياضات المتاحة',
    court_type_hdr:     'نوع الملعب والأرضية',
    court_outdoor:      'مكشوف',
    court_indoor:       'مغطى',
    court_both:         'مغطى ومكشوف',
    court_surface_lbl:  'نوع الأرضية',
    court_surface_ph:   '— اختر —',
    court_turf:         'عشب صناعي',
    court_grass:        'عشب طبيعي',
    court_hard:         'أرضية صلبة',
    court_clay:         'تراب',
    court_lighting_hdr: 'الإضاءة الليلية',
    court_lighting_lbl: 'يتوفر إضاءة للمساء',
    court_equip_hdr:    'المعدات المتاحة (مجاناً للحجوزات)',
    court_duration_hdr: 'مدد الحجز المتاحة',
    court_default_hdr:  'المدة الافتراضية',
    court_1h:           'ساعة',
    court_15h:          'ساعة ونصف',
    court_2h:           'ساعتان',
    court_wrong_cat:    'هذا الإعداد مخصص للملاعب الرياضية فقط.',
    court_save:         'حفظ الإعدادات',
    court_saved:        '✅ تم حفظ إعدادات الملاعب',
    // ── GamingConfigTab ───────────────────────────────
    gaming_stations_hdr: 'أنواع المحطات المتاحة',
    gaming_group_hdr:    'الغرف الجماعية',
    gaming_has_group:    'يتوفر غرف جماعية',
    gaming_group_cap:    'طاقة الغرفة الجماعية (عدد اللاعبين)',
    gaming_genre_hdr:    'أنواع الألعاب المتاحة',
    gaming_duration_hdr: 'مدد الجلسة المتاحة',
    gaming_default_hdr:  'المدة الافتراضية',
    gaming_1h:           'ساعة',
    gaming_2h:           'ساعتان',
    gaming_3h:           'ثلاث ساعات',
    gaming_wrong_cat:    'هذا الإعداد مخصص لمراكز الجيمنج فقط.',
    gaming_save:         'حفظ الإعدادات',
    gaming_saved:        '✅ تم حفظ إعدادات الجيمنج',
    // ── CarWashConfigTab ──────────────────────────────
    cw_vehicles_hdr:    'أنواع السيارات المقبولة',
    cw_delivery_hdr:    'خيارات التسليم',
    cw_drop_off:        'إيداع السيارة 🚗',
    cw_wait:            'انتظار أثناء الغسيل ⏳',
    cw_est_dur_hdr:     'مدة الغسيل المتوقعة (دقيقة)',
    cw_durations_hdr:   'مدد الحجز المتاحة (دقيقة)',
    cw_minute:          'دقيقة',
    cw_packages_hdr:    'باقات الخدمة',
    cw_name_ar:         'الاسم (عربي)',
    cw_name_en:         'الاسم (إنجليزي)',
    cw_price:           'السعر (ج.م)',
    cw_duration:        'المدة (دقيقة)',
    cw_remove_pkg:      'حذف الباقة',
    cw_add_pkg:         '+ إضافة باقة',
    cw_wrong_cat:       'هذا الإعداد مخصص لمحلات غسيل السيارات فقط.',
    cw_save:            'حفظ الإعدادات',
    cw_saved:           '✓ تم الحفظ بنجاح',
    cw_toast_err:       'حدث خطأ أثناء الحفظ',
    // ── RestaurantConfigTab ───────────────────────────
    rest_desc:          'اضبط الإعدادات الخاصة بمطعمك — نوع الخدمة، طاقة الحجوزات، والمرافق المتاحة.',
    rest_dining_lbl:    'نوع الخدمة',
    rest_dine_in:       'في المطعم',
    rest_takeaway:      'تيك أواي',
    rest_both:          'الاثنان',
    rest_party_lbl:     'أقصى حجم للمجموعة',
    rest_interval_lbl:  'فترة الحجز (دقيقة)',
    rest_min_adv:       'أدنى وقت للحجز المسبق (ساعة)',
    rest_max_adv:       'أقصى مدة حجز مسبق (أيام)',
    rest_amenities_lbl: 'المرافق المتاحة',
    rest_smoking:       'قسم للتدخين',
    rest_outdoor:       'جلوس خارجي',
    rest_valet:         'خدمة Valet',
    rest_notes_lbl:     'ملاحظات للعملاء (اختياري)',
    rest_notes_ph:      'مثال: يُرجى الحضور قبل الموعد بـ 10 دقائق...',
    rest_save:          'حفظ إعدادات المطعم',
    rest_toast_ok:      'تم حفظ إعدادات المطعم بنجاح',
    rest_toast_err:     'فشل الحفظ. حاول مرة أخرى.',
    // ── SalonConfigTab ────────────────────────────────
    salon_desc:         'اضبط الإعدادات الخاصة بصالونك — الفئة المستهدفة، الخدمات المقدمة، وسياسة الحجز.',
    salon_gender_lbl:   'الفئة المستهدفة',
    salon_female:       'سيدات فقط',
    salon_male:         'رجال فقط',
    salon_mixed:        'مختلط',
    salon_cats_lbl:     'فئات الخدمات المقدمة',
    salon_buffer_lbl:   'فترة التجهيز بين الحجوزات (دقيقة)',
    salon_adv_lbl:      'أقصى مدة حجز مسبق (أيام)',
    salon_walkin_lbl:   'قبول الحجوزات الفورية (Walk-in)',
    salon_home_lbl:     'خدمة في المنزل متاحة',
    salon_notes_lbl:    'ملاحظات للعملاء (اختياري)',
    salon_notes_ph:     'مثال: يُرجى الحضور قبل الموعد بـ 10 دقائق...',
    salon_save:         'حفظ إعدادات الصالون',
    salon_toast_ok:     'تم حفظ إعدادات الصالون بنجاح',
    salon_toast_err:    'فشل الحفظ. حاول مرة أخرى.',
    // ── Shared ────────────────────────────────────────
    saving:  'جاري الحفظ...',
    saved:   '✅ تم حفظ الإعدادات بنجاح',
    cat_wrong: 'نشاطك التجاري لا يندرج ضمن هذه الفئة.',
  },
  en: {
    avail_desc:       'Set your working days and booking times. Slots will be auto-generated for the next 4 weeks.',
    avail_to:         'to',
    avail_duration:   'Session (min)',
    avail_capacity:   'Capacity',
    avail_deposit:    'Deposit (EGP)',
    avail_save:       'Save & Generate Slots',
    avail_toast_ok:   'Working hours saved successfully',
    avail_toast_err:  'Save failed. Please try again.',
    policy_desc:      'Set the deposit amount and cancellation policy. Changes apply to new bookings only.',
    policy_type_hdr:  'Deposit type',
    policy_fixed:     'Fixed amount (EGP)',
    policy_pct:       'Percentage (%)',
    policy_fixed_lbl: 'Deposit amount (EGP)',
    policy_pct_lbl:   'Deposit percentage (%)',
    policy_cancel_hdr:'Free cancellation window',
    policy_cancel_desc:'Cancellation before this window = full refund. After = deposit is kept.',
    policy_cancel_lbl:'hours before the appointment',
    policy_no_refund: '⚠️ Deposit is non-refundable in all cases',
    policy_preview_hdr:'Customer-facing preview',
    policy_fee_note:  '* Platform fees are added automatically per booking based on your business category',
    policy_save:      'Save policy',
    policy_toast_ok:  'Deposit policy saved successfully',
    policy_toast_err: 'Save failed. Please try again.',
    payout_desc:      'Your payouts are transferred daily at 11 PM Cairo time.',
    payout_method_hdr:'Payout method',
    payout_wallet_lbl:'Paymob Wallet',
    payout_wallet_sub:'Transferred directly to your Paymob wallet',
    payout_bank_lbl:  'Bank transfer',
    payout_bank_sub:  'Transferred to the bank account linked to Paymob',
    payout_thresh_hdr:'Minimum transfer threshold',
    payout_thresh_desc:'If the accumulated amount is below the threshold, transfer is postponed to the next day.',
    payout_thresh_lbl:'EGP',
    payout_save:      'Save payout settings',
    payout_toast_ok:  'Payment settings saved successfully',
    payout_toast_err: 'Save failed. Please try again.',
    notif_desc:       'Control which notifications you receive via the app and WhatsApp.',
    notif_hdr:        'Notification settings',
    notif1_title:     'New booking notification',
    notif1_sub:       'Instant notification on the dashboard when a new booking arrives',
    notif2_title:     'Cancellation notification',
    notif2_sub:       'Instant notification when a customer cancels their booking',
    notif3_title:     'Payout notification',
    notif3_sub:       'WhatsApp message when your payout is sent or if a transfer fails',
    notif_save:       'Save notification settings',
    notif_toast_ok:   'Notification settings saved successfully',
    notif_toast_err:  'Save failed. Please try again.',
    sec_desc:         'Add seating sections (indoor, outdoor, VIP...) to enable booking preferences.',
    sec_new_hdr:      'New section',
    sec_name_ar:      'Name (Arabic) *',
    sec_capacity:     'Capacity (persons)',
    sec_cancel:       'Cancel',
    sec_add:          'Add',
    sec_add_btn:      '+ Add section',
    sec_loading:      'Loading...',
    sec_empty:        'No sections added yet',
    sec_cap_lbl:      'Capacity',
    sec_person:       'persons',
    sec_inactive_sfx: '(inactive)',
    sec_deactivate:   'Deactivate',
    sec_activate:     'Activate',
    sec_fail:         'Add failed. Please try again.',
    court_sports_hdr:   'Available sports',
    court_type_hdr:     'Court type & surface',
    court_outdoor:      'Outdoor',
    court_indoor:       'Indoor',
    court_both:         'Both',
    court_surface_lbl:  'Surface type',
    court_surface_ph:   '— Select —',
    court_turf:         'Artificial turf',
    court_grass:        'Natural grass',
    court_hard:         'Hard court',
    court_clay:         'Clay',
    court_lighting_hdr: 'Night lighting',
    court_lighting_lbl: 'Night lighting available',
    court_equip_hdr:    'Available equipment (free with bookings)',
    court_duration_hdr: 'Available booking durations',
    court_default_hdr:  'Default duration',
    court_1h:           '1 hr',
    court_15h:          '1.5 hrs',
    court_2h:           '2 hrs',
    court_wrong_cat:    'This setting is for sports courts only.',
    court_save:         'Save settings',
    court_saved:        '✅ Court settings saved',
    gaming_stations_hdr: 'Available station types',
    gaming_group_hdr:    'Group rooms',
    gaming_has_group:    'Group rooms available',
    gaming_group_cap:    'Group room capacity (players)',
    gaming_genre_hdr:    'Available game genres',
    gaming_duration_hdr: 'Available session durations',
    gaming_default_hdr:  'Default duration',
    gaming_1h:           '1 hr',
    gaming_2h:           '2 hrs',
    gaming_3h:           '3 hrs',
    gaming_wrong_cat:    'This setting is for gaming cafes only.',
    gaming_save:         'Save settings',
    gaming_saved:        '✅ Gaming settings saved',
    cw_vehicles_hdr:    'Accepted vehicle types',
    cw_delivery_hdr:    'Drop-off options',
    cw_drop_off:        'Drop-off 🚗',
    cw_wait:            'Wait while washing ⏳',
    cw_est_dur_hdr:     'Estimated wash duration (min)',
    cw_durations_hdr:   'Available slot durations (min)',
    cw_minute:          'min',
    cw_packages_hdr:    'Service packages',
    cw_name_ar:         'Name (Arabic)',
    cw_name_en:         'Name (English)',
    cw_price:           'Price (EGP)',
    cw_duration:        'Duration (min)',
    cw_remove_pkg:      'Remove package',
    cw_add_pkg:         '+ Add package',
    cw_wrong_cat:       'This setting is for car washes only.',
    cw_save:            'Save settings',
    cw_saved:           '✓ Saved successfully',
    cw_toast_err:       'An error occurred while saving',
    rest_desc:          'Configure your restaurant — service type, booking capacity, and available amenities.',
    rest_dining_lbl:    'Service type',
    rest_dine_in:       'Dine-in',
    rest_takeaway:      'Takeaway',
    rest_both:          'Both',
    rest_party_lbl:     'Max party size',
    rest_interval_lbl:  'Booking interval (min)',
    rest_min_adv:       'Min advance booking (hours)',
    rest_max_adv:       'Max advance booking (days)',
    rest_amenities_lbl: 'Available amenities',
    rest_smoking:       'Smoking section',
    rest_outdoor:       'Outdoor seating',
    rest_valet:         'Valet parking',
    rest_notes_lbl:     'Notes for customers (optional)',
    rest_notes_ph:      'e.g. Please arrive 10 minutes before your appointment...',
    rest_save:          'Save restaurant settings',
    rest_toast_ok:      'Restaurant settings saved successfully',
    rest_toast_err:     'Save failed. Please try again.',
    salon_desc:         'Configure your salon — target audience, offered services, and booking policy.',
    salon_gender_lbl:   'Target audience',
    salon_female:       'Women only',
    salon_male:         'Men only',
    salon_mixed:        'Mixed',
    salon_cats_lbl:     'Offered service categories',
    salon_buffer_lbl:   'Preparation buffer between bookings (min)',
    salon_adv_lbl:      'Max advance booking (days)',
    salon_walkin_lbl:   'Accept walk-in bookings',
    salon_home_lbl:     'Home service available',
    salon_notes_lbl:    'Notes for customers (optional)',
    salon_notes_ph:     'e.g. Please arrive 10 minutes before your appointment...',
    salon_save:         'Save salon settings',
    salon_toast_ok:     'Salon settings saved successfully',
    salon_toast_err:    'Save failed. Please try again.',
    saving:  'Saving...',
    saved:   '✅ Settings saved',
    cat_wrong: 'Your business does not belong to this category.',
  },
} as const;

type SCKey = keyof typeof SC.ar;

// ── Tabs config ───────────────────────────────────────────────

type Tab = 'availability' | 'policy' | 'payout' | 'notifications' | 'sections' | 'restaurant_config' | 'salon_config' | 'court_config' | 'gaming_config' | 'car_wash_config';

const ALL_TABS: { key: Tab; labelAr: string; labelEn: string; categories: string[] | null }[] = [
  { key: 'availability',      labelAr: 'أوقات العمل',            labelEn: 'Working Hours',          categories: null },
  { key: 'policy',            labelAr: 'سياسة العربون والإلغاء', labelEn: 'Deposit & Cancellation', categories: null },
  { key: 'payout',            labelAr: 'إعدادات المدفوعات',      labelEn: 'Payment Settings',       categories: null },
  { key: 'notifications',     labelAr: 'إشعارات',                labelEn: 'Notifications',          categories: null },
  { key: 'restaurant_config', labelAr: 'إعداد المطعم',           labelEn: 'Restaurant Setup',       categories: ['restaurant', 'cafe'] },
  { key: 'salon_config',      labelAr: 'إعداد الصالون',          labelEn: 'Salon Setup',            categories: ['salon'] },
  { key: 'sections',          labelAr: 'أقسام الجلوس',           labelEn: 'Seating Sections',       categories: ['restaurant', 'cafe'] },
  { key: 'court_config',      labelAr: 'إعداد الملاعب',          labelEn: 'Court Setup',            categories: ['court'] },
  { key: 'gaming_config',     labelAr: 'إعداد الجيمنج',          labelEn: 'Gaming Setup',           categories: ['gaming_cafe'] },
  { key: 'car_wash_config',   labelAr: 'إعداد الغسيل',           labelEn: 'Car Wash Setup',         categories: ['car_wash'] },
];

// ── Page wrapper ──────────────────────────────────────────────

export default function SettingsPageWrapper() {
  return <DashboardShell pageTitle="page_settings"><SettingsPage /></DashboardShell>;
}

function SettingsPage() {
  const { user } = useDashboardAuth();
  const { dir, lang } = useLang();
  const category = user?.business_category ?? '';
  const [activeTab, setActiveTab] = useState<Tab>('availability');

  const visibleTabs = ALL_TABS.filter((t) => !t.categories || t.categories.includes(category));
  const settingsTitle = lang === 'ar' ? 'الإعدادات' : 'Settings';

  return (
    <div style={{ padding: '24px', fontFamily: 'Cairo, sans-serif', direction: dir, maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0F2044', marginBottom: '8px' }}>{settingsTitle}</h2>

      {/* Tab bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '28px', borderBottom: '2px solid #E5E7EB', paddingBottom: '0' }}>
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
              fontFamily: 'Cairo, sans-serif', fontSize: '15px', fontWeight: activeTab === tab.key ? 700 : 400,
              color: activeTab === tab.key ? '#1B8A7A' : '#6B7280',
              borderBottom: activeTab === tab.key ? '2px solid #1B8A7A' : '2px solid transparent',
              marginBottom: '-2px', whiteSpace: 'nowrap',
            }}
          >
            {lang === 'ar' ? tab.labelAr : tab.labelEn}
          </button>
        ))}
      </div>

      {activeTab === 'availability'      && <AvailabilityTab    onSuccess={() => setActiveTab('policy')} />}
      {activeTab === 'policy'            && <PolicyTab          onSuccess={() => setActiveTab('payout')} />}
      {activeTab === 'payout'            && <PayoutTab          onSuccess={() => setActiveTab('notifications')} />}
      {activeTab === 'notifications'     && <NotificationsTab   onSuccess={() => setActiveTab(category === 'restaurant' || category === 'cafe' ? 'restaurant_config' : category === 'salon' ? 'salon_config' : 'availability')} />}
      {activeTab === 'restaurant_config' && <RestaurantConfigTab />}
      {activeTab === 'salon_config'      && <SalonConfigTab />}
      {activeTab === 'sections'          && <SectionsTab />}
      {activeTab === 'court_config'      && <CourtConfigTab />}
      {activeTab === 'gaming_config'     && <GamingConfigTab />}
      {activeTab === 'car_wash_config'   && <CarWashConfigTab />}
    </div>
  );
}

// ── Tab 1: Availability ───────────────────────────────────────

function AvailabilityTab({ onSuccess }: { onSuccess?: () => void }) {
  const { toast } = useToast();
  const { lang } = useLang();
  const c = SC[lang];
  const DAYS = lang === 'ar' ? DAYS_AR : DAYS_EN;
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [rules, setRules] = useState([
    { day_of_week: 0, open_time: '09:00', close_time: '22:00', slot_duration_min: 90, capacity: 4, deposit_amount: 100, enabled: true },
    { day_of_week: 1, open_time: '09:00', close_time: '22:00', slot_duration_min: 90, capacity: 4, deposit_amount: 100, enabled: true },
    { day_of_week: 2, open_time: '09:00', close_time: '22:00', slot_duration_min: 90, capacity: 4, deposit_amount: 100, enabled: true },
    { day_of_week: 3, open_time: '09:00', close_time: '22:00', slot_duration_min: 90, capacity: 4, deposit_amount: 100, enabled: true },
    { day_of_week: 4, open_time: '09:00', close_time: '22:00', slot_duration_min: 90, capacity: 4, deposit_amount: 100, enabled: true },
    { day_of_week: 5, open_time: '12:00', close_time: '24:00', slot_duration_min: 90, capacity: 4, deposit_amount: 150, enabled: true },
    { day_of_week: 6, open_time: '12:00', close_time: '24:00', slot_duration_min: 90, capacity: 4, deposit_amount: 150, enabled: true },
  ]);

  const updateRule = (i: number, field: string, value: any) =>
    setRules((prev) => prev.map((r, j) => j === i ? { ...r, [field]: value } : r));

  const handleSave = async () => {
    setSaving(true);
    try {
      const enabledRules = rules.filter((r) => r.enabled).map((r) => ({ ...r, weeks_ahead: 4 }));
      await slotsApi.createBulk(enabledRules);
      toast.success(c.avail_toast_ok);
      markOnboardingStep('profile');
      markOnboardingStep('hours');
      markOnboardingStep('firstslot');
      onSuccess?.();
    } catch {
      toast.error(c.avail_toast_err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>{c.avail_desc}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {rules.map((rule, i) => (
          <div key={i} style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', opacity: rule.enabled ? 1 : 0.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
                <input type="checkbox" checked={rule.enabled} onChange={(e) => updateRule(i, 'enabled', e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                <span style={{ fontWeight: 700, fontSize: '15px', color: '#0F2044' }}>{DAYS[i]}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="time" value={rule.open_time} onChange={(e) => updateRule(i, 'open_time', e.target.value)} style={inputStyle} disabled={!rule.enabled} />
                <span style={{ color: '#6B7280' }}>{c.avail_to}</span>
                <input type="time" value={rule.close_time} onChange={(e) => updateRule(i, 'close_time', e.target.value)} style={inputStyle} disabled={!rule.enabled} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={labelStyle}>{c.avail_duration}</label>
                <input type="number" min={30} max={240} step={15} value={rule.slot_duration_min} onChange={(e) => updateRule(i, 'slot_duration_min', parseInt(e.target.value))} style={{ ...inputStyle, width: '80px' }} disabled={!rule.enabled} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={labelStyle}>{c.avail_capacity}</label>
                <input type="number" min={1} max={50} value={rule.capacity} onChange={(e) => updateRule(i, 'capacity', parseInt(e.target.value))} style={{ ...inputStyle, width: '70px' }} disabled={!rule.enabled} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={labelStyle}>{c.avail_deposit}</label>
                <input type="number" min={0} step={50} value={rule.deposit_amount} onChange={(e) => updateRule(i, 'deposit_amount', parseInt(e.target.value))} style={{ ...inputStyle, width: '90px' }} disabled={!rule.enabled} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={handleSave} disabled={saving} style={saveButtonStyle(saving)}>
          {saving ? c.saving : c.avail_save}
        </button>
        {success && <span style={{ color: '#1B8A7A', fontSize: '15px' }}>{c.saved}</span>}
      </div>
    </div>
  );
}

// ── Tab 2: Deposit & Cancellation Policy (US-033) ─────────────

function PolicyTab({ onSuccess }: { onSuccess?: () => void }) {
  const { toast } = useToast();
  const { lang } = useLang();
  const c = SC[lang];
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState({
    deposit_type: 'fixed' as 'fixed' | 'percentage',
    deposit_value: 100,
    cancellation_window_hours: 24,
  });

  useEffect(() => {
    businessApi.getPolicy().then((r) => {
      if (r.data) setPolicy({ deposit_type: r.data.deposit_type, deposit_value: r.data.deposit_value, cancellation_window_hours: r.data.cancellation_window_hours });
    }).catch(() => {});
  }, []);

  const policyPreview = buildPolicyPreview(policy.deposit_type, policy.deposit_value, policy.cancellation_window_hours, lang);

  const handleSave = async () => {
    setSaving(true);
    try {
      await businessApi.updatePolicy(policy);
      toast.success(c.policy_toast_ok);
      markOnboardingStep('deposit');
      onSuccess?.();
    } catch {
      toast.error(c.policy_toast_err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>{c.policy_desc}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        <div style={sectionCard}>
          <h3 style={sectionTitle}>{c.policy_type_hdr}</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            {(['fixed', 'percentage'] as const).map((type) => (
              <button key={type} onClick={() => setPolicy((p) => ({ ...p, deposit_type: type }))} style={{
                padding: '10px 20px', border: `1.5px solid ${policy.deposit_type === type ? '#1B8A7A' : '#E5E7EB'}`,
                borderRadius: '10px', background: policy.deposit_type === type ? '#E8F5F3' : '#fff',
                fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: 600,
                color: policy.deposit_type === type ? '#1B8A7A' : '#6B7280', cursor: 'pointer',
              }}>
                {type === 'fixed' ? c.policy_fixed : c.policy_pct}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
            <label style={{ ...labelStyle, fontSize: '14px' }}>
              {policy.deposit_type === 'fixed' ? c.policy_fixed_lbl : c.policy_pct_lbl}
            </label>
            <input type="number" min={0} max={policy.deposit_type === 'percentage' ? 100 : 9999} step={policy.deposit_type === 'fixed' ? 25 : 5} value={policy.deposit_value} onChange={(e) => setPolicy((p) => ({ ...p, deposit_value: Number(e.target.value) }))} style={{ ...inputStyle, width: '110px', fontSize: '16px' }} />
            <span style={{ color: '#6B7280', fontSize: '14px' }}>{policy.deposit_type === 'fixed' ? 'EGP' : '%'}</span>
          </div>
        </div>

        <div style={sectionCard}>
          <h3 style={sectionTitle}>{c.policy_cancel_hdr}</h3>
          <p style={{ color: '#6B7280', fontSize: '13px', marginBottom: '12px' }}>{c.policy_cancel_desc}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input type="number" min={0} max={168} step={1} value={policy.cancellation_window_hours} onChange={(e) => setPolicy((p) => ({ ...p, cancellation_window_hours: Number(e.target.value) }))} style={{ ...inputStyle, width: '90px', fontSize: '16px' }} />
            <label style={{ color: '#0F2044', fontSize: '14px', fontWeight: 600 }}>{c.policy_cancel_lbl}</label>
          </div>
          {policy.cancellation_window_hours === 0 && <p style={{ color: '#D32F2F', fontSize: '12px', marginTop: '8px' }}>{c.policy_no_refund}</p>}
        </div>

        <div style={{ ...sectionCard, background: '#F0FBF9', border: '1.5px solid #0B8B8F30' }}>
          <h3 style={{ ...sectionTitle, color: '#0B8B8F' }}>{c.policy_preview_hdr}</h3>
          <p style={{ fontSize: '14px', color: '#0F2044', lineHeight: '1.7', margin: 0 }}>{policyPreview}</p>
          <p style={{ fontSize: '11px', color: '#6B7280', marginTop: '8px', marginBottom: 0 }}>{c.policy_fee_note}</p>
        </div>
      </div>

      <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={handleSave} disabled={saving} style={saveButtonStyle(saving)}>
          {saving ? c.saving : c.policy_save}
        </button>
      </div>
    </div>
  );
}

// ── Tab 3: Payout Preferences (US-036) ───────────────────────

function PayoutTab({ onSuccess }: { onSuccess?: () => void }) {
  const { toast } = useToast();
  const { lang } = useLang();
  const c = SC[lang];
  const [saving, setSaving] = useState(false);
  const [pref, setPref] = useState({ payout_method: 'paymob_wallet' as 'paymob_wallet' | 'bank_transfer', payout_threshold_egp: 50 });

  useEffect(() => {
    businessApi.getPolicy().then((r) => {
      if (r.data?.payout_method) setPref({ payout_method: r.data.payout_method, payout_threshold_egp: r.data.payout_threshold_egp ?? 50 });
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await businessApi.updatePolicy(pref);
      toast.success(c.payout_toast_ok);
      onSuccess?.();
    } catch {
      toast.error(c.payout_toast_err);
    } finally {
      setSaving(false);
    }
  };

  const opts = [
    { id: 'paymob_wallet' as const, label: c.payout_wallet_lbl, subtitle: c.payout_wallet_sub },
    { id: 'bank_transfer' as const, label: c.payout_bank_lbl,   subtitle: c.payout_bank_sub  },
  ];

  return (
    <div>
      <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>{c.payout_desc}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={sectionCard}>
          <h3 style={sectionTitle}>{c.payout_method_hdr}</h3>
          {opts.map((opt) => (
            <div key={opt.id} onClick={() => setPref((p) => ({ ...p, payout_method: opt.id }))} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '10px', cursor: 'pointer', border: `1.5px solid ${pref.payout_method === opt.id ? '#1B8A7A' : '#E5E7EB'}`, background: pref.payout_method === opt.id ? '#E8F5F3' : '#fff', marginBottom: '10px' }}>
              <input type="radio" readOnly checked={pref.payout_method === opt.id} style={{ accentColor: '#1B8A7A' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F2044' }}>{opt.label}</div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{opt.subtitle}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={sectionCard}>
          <h3 style={sectionTitle}>{c.payout_thresh_hdr}</h3>
          <p style={{ color: '#6B7280', fontSize: '13px', marginBottom: '12px' }}>{c.payout_thresh_desc}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input type="number" min={0} max={5000} step={50} value={pref.payout_threshold_egp} onChange={(e) => setPref((p) => ({ ...p, payout_threshold_egp: Number(e.target.value) }))} style={{ ...inputStyle, width: '100px', fontSize: '16px' }} />
            <label style={{ color: '#0F2044', fontSize: '14px', fontWeight: 600 }}>{c.payout_thresh_lbl}</label>
          </div>
        </div>
      </div>
      <div style={{ marginTop: '24px' }}>
        <button onClick={handleSave} disabled={saving} style={saveButtonStyle(saving)}>
          {saving ? c.saving : c.payout_save}
        </button>
      </div>
    </div>
  );
}

// ── Tab 4: Notification Preferences (US-049) ─────────────────

function NotificationsTab({ onSuccess }: { onSuccess?: () => void }) {
  const { toast } = useToast();
  const { lang } = useLang();
  const c = SC[lang];
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState({ notify_new_booking_push: true, notify_cancellation_push: true, notify_payout_whatsapp: true });

  useEffect(() => {
    businessApi.getPolicy().then((r) => {
      if (r.data) setPrefs({ notify_new_booking_push: r.data.notify_new_booking_push ?? true, notify_cancellation_push: r.data.notify_cancellation_push ?? true, notify_payout_whatsapp: r.data.notify_payout_whatsapp ?? true });
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await businessApi.updatePolicy(prefs);
      toast.success(c.notif_toast_ok);
      onSuccess?.();
    } catch {
      toast.error(c.notif_toast_err);
    } finally {
      setSaving(false);
    }
  };

  const items: { key: keyof typeof prefs; title: string; subtitle: string; channel: string }[] = [
    { key: 'notify_new_booking_push',   title: c.notif1_title, subtitle: c.notif1_sub, channel: 'Push' },
    { key: 'notify_cancellation_push',  title: c.notif2_title, subtitle: c.notif2_sub, channel: 'Push' },
    { key: 'notify_payout_whatsapp',    title: c.notif3_title, subtitle: c.notif3_sub, channel: 'WhatsApp' },
  ];

  return (
    <div>
      <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>{c.notif_desc}</p>
      <div style={sectionCard}>
        <h3 style={sectionTitle}>{c.notif_hdr}</h3>
        {items.map((item, i) => (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: i === 0 ? 0 : '16px', paddingBottom: '16px', borderBottom: i < items.length - 1 ? '1px solid #F0F0F0' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div onClick={() => setPrefs((p) => ({ ...p, [item.key]: !p[item.key] }))} style={{ width: '48px', height: '28px', borderRadius: '14px', cursor: 'pointer', backgroundColor: prefs[item.key] ? '#1B8A7A' : '#D1D5DB', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: '3px', left: prefs[item.key] ? '22px' : '3px', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: item.channel === 'WhatsApp' ? '#25D366' : '#1B8A7A', backgroundColor: item.channel === 'WhatsApp' ? '#E8F9EE' : '#E8F5F3', padding: '2px 8px', borderRadius: '12px' }}>{item.channel}</span>
            </div>
            <div style={{ textAlign: 'right' as const, flex: 1, marginRight: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F2044' }}>{item.title}</div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{item.subtitle}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '24px' }}>
        <button onClick={handleSave} disabled={saving} style={saveButtonStyle(saving)}>
          {saving ? c.saving : c.notif_save}
        </button>
      </div>
    </div>
  );
}

// ── Tab 5: Sections Config (US-060) — Restaurant/Cafe only ────

function SectionsTab() {
  const { toast } = useToast();
  const { lang } = useLang();
  const c = SC[lang];
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name_ar: '', name_en: '', capacity: 10 });

  useEffect(() => {
    sectionsApi.list().then((r) => setSections(r.data.sections ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!form.name_ar.trim()) return;
    setSaving(true);
    try {
      const res = await sectionsApi.create(form);
      setSections((s) => [...s, res.data]);
      setForm({ name_ar: '', name_en: '', capacity: 10 });
      setShowForm(false);
    } catch {
      toast.error(c.sec_fail);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, is_active: boolean) => {
    await sectionsApi.update(id, { is_active });
    setSections((s) => s.map((sec) => sec.id === id ? { ...sec, is_active } : sec));
  };

  const active   = sections.filter((s) => s.is_active);
  const inactive = sections.filter((s) => !s.is_active);

  return (
    <div>
      <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>{c.sec_desc}</p>
      {showForm ? (
        <div style={sectionCard}>
          <h3 style={sectionTitle}>{c.sec_new_hdr}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: '6px' }}>{c.sec_name_ar}</label>
              <input style={inputStyle} value={form.name_ar} onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: '6px' }}>{c.sec_capacity}</label>
              <input type="number" min={1} max={500} style={{ ...inputStyle, width: '100px' }} value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowForm(false)} style={{ ...saveButtonStyle(false), background: '#6B7280', padding: '10px 16px', fontSize: '14px' }}>{c.sec_cancel}</button>
              <button onClick={handleAdd} disabled={saving} style={{ ...saveButtonStyle(saving), padding: '10px 16px', fontSize: '14px' }}>{c.sec_add}</button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} style={{ ...saveButtonStyle(false), marginBottom: '20px' }}>{c.sec_add_btn}</button>
      )}
      {loading ? (
        <div style={{ color: '#6B7280', fontSize: '14px' }}>{c.sec_loading}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {active.map((sec) => (
            <div key={sec.id} style={{ ...sectionCard, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
              <button onClick={() => handleToggle(sec.id, false)} style={{ padding: '6px 12px', background: '#FEF2F2', border: 'none', borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#D32F2F', cursor: 'pointer' }}>{c.sec_deactivate}</button>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#0F2044' }}>{sec.name_ar}</div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{c.sec_cap_lbl} {sec.capacity} {c.sec_person}</div>
              </div>
            </div>
          ))}
          {inactive.map((sec) => (
            <div key={sec.id} style={{ ...sectionCard, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0, opacity: 0.5 }}>
              <button onClick={() => handleToggle(sec.id, true)} style={{ padding: '6px 12px', background: '#E8F5F3', border: 'none', borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#1B8A7A', cursor: 'pointer' }}>{c.sec_activate}</button>
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px', color: '#0F2044' }}>{sec.name_ar} {c.sec_inactive_sfx}</div>
                <div style={{ fontSize: '12px', color: '#6B7280' }}>{c.sec_cap_lbl} {sec.capacity} {c.sec_person}</div>
              </div>
            </div>
          ))}
          {active.length === 0 && !showForm && <p style={{ color: '#9CA3AF', fontSize: '14px', textAlign: 'center' as const, padding: '32px' }}>{c.sec_empty}</p>}
        </div>
      )}
    </div>
  );
}

// ── Tab 6: Court Config (US-087) ─────────────────────────────

const SPORT_OPTIONS: Record<string, { ar: string; en: string }> = {
  football:   { ar: 'كرة القدم',   en: 'Football' },
  basketball: { ar: 'كرة السلة',   en: 'Basketball' },
  tennis:     { ar: 'تنس',         en: 'Tennis' },
  padel:      { ar: 'بادل',        en: 'Padel' },
  squash:     { ar: 'إسكواش',      en: 'Squash' },
  volleyball: { ar: 'كرة الطائرة', en: 'Volleyball' },
};

const EQUIPMENT_OPTIONS: Record<string, { ar: string; en: string }> = {
  balls:  { ar: 'كرات',          en: 'Balls' },
  bibs:   { ar: 'قمصان تدريب',   en: 'Bibs' },
  cones:  { ar: 'أقماع',         en: 'Cones' },
  vests:  { ar: 'صدريات',        en: 'Vests' },
  water:  { ar: 'مياه',          en: 'Water' },
};

function CourtConfigTab() {
  const { lang } = useLang();
  const c = SC[lang];
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [wrongCategory, setWrongCategory] = useState(false);
  const [config, setConfig] = useState({ sport_types: [] as string[], court_type: 'outdoor', surface_type: '', has_lighting: false, equipment_available: [] as string[], slot_duration_options: [60] as number[], default_slot_duration_minutes: 60 });

  useEffect(() => {
    courtConfigApi.get().then((r) => { if (r.data?.court_config) setConfig(r.data.court_config); }).catch((e: any) => { if (e?.response?.data?.error?.code === 'WRONG_CATEGORY') setWrongCategory(true); });
  }, []);

  if (wrongCategory) return (
    <div style={{ padding: '40px', textAlign: 'center' as const, color: '#6B7280', fontFamily: 'Cairo, sans-serif' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚽</div>
      <p style={{ fontSize: '16px', fontWeight: 600 }}>{c.court_wrong_cat}</p>
      <p style={{ fontSize: '14px' }}>{c.cat_wrong}</p>
    </div>
  );

  function toggle<T>(arr: T[], val: T): T[] { return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]; }

  async function handleSave() {
    setSaving(true);
    try { await courtConfigApi.update(config); setSuccess(true); setTimeout(() => setSuccess(false), 3000); }
    finally { setSaving(false); }
  }

  const durationLabels: Record<number, string> = { 60: c.court_1h, 90: c.court_15h, 120: c.court_2h };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={sectionCard}>
        <h3 style={sectionTitle}>{c.court_sports_hdr}</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {Object.entries(SPORT_OPTIONS).map(([id, labels]) => {
            const checked = config.sport_types.includes(id);
            return (
              <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 14px', border: `1.5px solid ${checked ? '#2E7D32' : '#E5E7EB'}`, borderRadius: 10, backgroundColor: checked ? '#F0FDF4' : '#fff' }}>
                <input type="checkbox" checked={checked} onChange={() => setConfig((c) => ({ ...c, sport_types: toggle(c.sport_types, id) }))} style={{ accentColor: '#2E7D32' }} />
                <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: 14, color: checked ? '#166534' : '#374151' }}>{lang === 'ar' ? labels.ar : labels.en}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div style={sectionCard}>
        <h3 style={sectionTitle}>{c.court_type_hdr}</h3>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
          {(['outdoor', 'indoor', 'both'] as const).map((type) => (
            <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="radio" name="court_type" value={type} checked={config.court_type === type} onChange={() => setConfig((c) => ({ ...c, court_type: type }))} style={{ accentColor: '#2E7D32' }} />
              <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: 14 }}>
                {type === 'outdoor' ? c.court_outdoor : type === 'indoor' ? c.court_indoor : c.court_both}
              </span>
            </label>
          ))}
        </div>
        <div>
          <label style={labelStyle}>{c.court_surface_lbl}</label>
          <select style={{ ...inputStyle, marginTop: 6, display: 'block' }} value={config.surface_type} onChange={(e) => setConfig((c) => ({ ...c, surface_type: e.target.value }))}>
            <option value="">{c.court_surface_ph}</option>
            <option value="turf">{c.court_turf}</option>
            <option value="grass">{c.court_grass}</option>
            <option value="hard">{c.court_hard}</option>
            <option value="clay">{c.court_clay}</option>
          </select>
        </div>
      </div>

      <div style={sectionCard}>
        <h3 style={sectionTitle}>{c.court_lighting_hdr}</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={config.has_lighting} onChange={(e) => setConfig((c) => ({ ...c, has_lighting: e.target.checked }))} style={{ accentColor: '#2E7D32', width: 18, height: 18 }} />
          <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: 15 }}>{c.court_lighting_lbl}</span>
        </label>
      </div>

      <div style={sectionCard}>
        <h3 style={sectionTitle}>{c.court_equip_hdr}</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {Object.entries(EQUIPMENT_OPTIONS).map(([id, labels]) => {
            const checked = config.equipment_available.includes(id);
            return (
              <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 14px', border: `1.5px solid ${checked ? '#2E7D32' : '#E5E7EB'}`, borderRadius: 10, backgroundColor: checked ? '#F0FDF4' : '#fff' }}>
                <input type="checkbox" checked={checked} onChange={() => setConfig((c) => ({ ...c, equipment_available: toggle(c.equipment_available, id) }))} style={{ accentColor: '#2E7D32' }} />
                <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: 14, color: checked ? '#166534' : '#374151' }}>{lang === 'ar' ? labels.ar : labels.en}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div style={sectionCard}>
        <h3 style={sectionTitle}>{c.court_duration_hdr}</h3>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          {[60, 90, 120].map((mins) => {
            const checked = config.slot_duration_options.includes(mins);
            return (
              <label key={mins} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 16px', border: `1.5px solid ${checked ? '#2E7D32' : '#E5E7EB'}`, borderRadius: 10, backgroundColor: checked ? '#F0FDF4' : '#fff' }}>
                <input type="checkbox" checked={checked} onChange={() => setConfig((c) => ({ ...c, slot_duration_options: toggle(c.slot_duration_options, mins) }))} style={{ accentColor: '#2E7D32' }} />
                <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: 14 }}>{durationLabels[mins]}</span>
              </label>
            );
          })}
        </div>
        <div>
          <label style={labelStyle}>{c.court_default_hdr}</label>
          <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
            {config.slot_duration_options.map((mins) => (
              <label key={mins} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="radio" name="default_duration" value={mins} checked={config.default_slot_duration_minutes === mins} onChange={() => setConfig((c) => ({ ...c, default_slot_duration_minutes: mins }))} style={{ accentColor: '#2E7D32' }} />
                <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: 14 }}>{durationLabels[mins]}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {success && <div style={{ color: '#166534', backgroundColor: '#DCFCE7', borderRadius: 10, padding: '12px 20px', fontFamily: 'Cairo, sans-serif', textAlign: 'center' as const }}>{c.court_saved}</div>}
      <button style={saveButtonStyle(saving)} onClick={handleSave} disabled={saving}>{saving ? c.saving : c.court_save}</button>
    </div>
  );
}

// ── Tab 7: Gaming Config (US-094) ─────────────────────────────

const STATION_TYPES: Record<string, { ar: string; en: string }> = {
  pc:         { ar: '🖥️ كمبيوتر PC',       en: '🖥️ PC Station' },
  console:    { ar: '🎮 بلايستيشن',          en: '🎮 Console' },
  vr:         { ar: '🥽 واقع افتراضي VR',    en: '🥽 VR' },
  group_room: { ar: '👥 غرفة جماعية',        en: '👥 Group Room' },
};

const GENRE_OPTIONS: Record<string, { ar: string; en: string }> = {
  fps:    { ar: 'إطلاق نار FPS', en: 'FPS' },
  rpg:    { ar: 'أدوار RPG',     en: 'RPG' },
  sports: { ar: 'رياضة',         en: 'Sports' },
  racing: { ar: 'سباق',          en: 'Racing' },
  casual: { ar: 'كاجوال',        en: 'Casual' },
  horror: { ar: 'رعب',           en: 'Horror' },
  moba:   { ar: 'موبا MOBA',     en: 'MOBA' },
};

function GamingConfigTab() {
  const { lang } = useLang();
  const c = SC[lang];
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [wrongCategory, setWrongCategory] = useState(false);
  const [config, setConfig] = useState({ station_types: [] as string[], has_group_rooms: false, group_room_capacity: 6, genre_options: [] as string[], slot_duration_options: [60] as number[], default_slot_duration_minutes: 60 });

  useEffect(() => {
    gamingConfigApi.get().then((r) => { if (r.data?.gaming_config) setConfig(r.data.gaming_config); }).catch((e: any) => { if (e?.response?.data?.error?.code === 'WRONG_CATEGORY') setWrongCategory(true); });
  }, []);

  if (wrongCategory) return (
    <div style={{ padding: '40px', textAlign: 'center' as const, color: '#6B7280', fontFamily: 'Cairo, sans-serif' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎮</div>
      <p style={{ fontSize: '16px', fontWeight: 600 }}>{c.gaming_wrong_cat}</p>
      <p style={{ fontSize: '14px' }}>{c.cat_wrong}</p>
    </div>
  );

  function toggle<T>(arr: T[], val: T): T[] { return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]; }

  async function handleSave() {
    setSaving(true);
    try { await gamingConfigApi.update(config); setSuccess(true); setTimeout(() => setSuccess(false), 3000); }
    finally { setSaving(false); }
  }

  const gamingDurations: Record<number, string> = { 60: c.gaming_1h, 120: c.gaming_2h, 180: c.gaming_3h };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={sectionCard}>
        <h3 style={sectionTitle}>{c.gaming_stations_hdr}</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {Object.entries(STATION_TYPES).map(([id, labels]) => {
            const checked = config.station_types.includes(id);
            return (
              <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 14px', border: `1.5px solid ${checked ? '#6B21A8' : '#E5E7EB'}`, borderRadius: 10, backgroundColor: checked ? '#F5F3FF' : '#fff' }}>
                <input type="checkbox" checked={checked} onChange={() => setConfig((c) => ({ ...c, station_types: toggle(c.station_types, id) }))} style={{ accentColor: '#6B21A8' }} />
                <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: 14, color: checked ? '#6B21A8' : '#374151' }}>{lang === 'ar' ? labels.ar : labels.en}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div style={sectionCard}>
        <h3 style={sectionTitle}>{c.gaming_group_hdr}</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
          <input type="checkbox" checked={config.has_group_rooms} onChange={(e) => setConfig((c) => ({ ...c, has_group_rooms: e.target.checked }))} style={{ accentColor: '#6B21A8', width: 18, height: 18 }} />
          <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: 15 }}>{c.gaming_has_group}</span>
        </label>
        {config.has_group_rooms && (
          <div>
            <label style={labelStyle}>{c.gaming_group_cap}</label>
            <input style={{ ...inputStyle, width: 80, marginTop: 6, display: 'block' }} type="number" min={2} max={20} value={config.group_room_capacity} onChange={(e) => setConfig((c) => ({ ...c, group_room_capacity: Number(e.target.value) }))} />
          </div>
        )}
      </div>

      <div style={sectionCard}>
        <h3 style={sectionTitle}>{c.gaming_genre_hdr}</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {Object.entries(GENRE_OPTIONS).map(([id, labels]) => {
            const checked = config.genre_options.includes(id);
            return (
              <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 14px', border: `1.5px solid ${checked ? '#6B21A8' : '#E5E7EB'}`, borderRadius: 10, backgroundColor: checked ? '#F5F3FF' : '#fff' }}>
                <input type="checkbox" checked={checked} onChange={() => setConfig((c) => ({ ...c, genre_options: toggle(c.genre_options, id) }))} style={{ accentColor: '#6B21A8' }} />
                <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: 14, color: checked ? '#6B21A8' : '#374151' }}>{lang === 'ar' ? labels.ar : labels.en}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div style={sectionCard}>
        <h3 style={sectionTitle}>{c.gaming_duration_hdr}</h3>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          {[60, 120, 180].map((m) => {
            const checked = config.slot_duration_options.includes(m);
            return (
              <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 16px', border: `1.5px solid ${checked ? '#6B21A8' : '#E5E7EB'}`, borderRadius: 10, backgroundColor: checked ? '#F5F3FF' : '#fff' }}>
                <input type="checkbox" checked={checked} onChange={() => setConfig((c) => ({ ...c, slot_duration_options: toggle(c.slot_duration_options, m) }))} style={{ accentColor: '#6B21A8' }} />
                <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: 14 }}>{gamingDurations[m]}</span>
              </label>
            );
          })}
        </div>
        <div>
          <label style={labelStyle}>{c.gaming_default_hdr}</label>
          <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
            {config.slot_duration_options.map((m) => (
              <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="radio" name="default_gaming_duration" value={m} checked={config.default_slot_duration_minutes === m} onChange={() => setConfig((c) => ({ ...c, default_slot_duration_minutes: m }))} style={{ accentColor: '#6B21A8' }} />
                <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: 14 }}>{gamingDurations[m]}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {success && <div style={{ color: '#6B21A8', backgroundColor: '#F5F3FF', borderRadius: 10, padding: '12px 20px', fontFamily: 'Cairo, sans-serif', textAlign: 'center' as const }}>{c.gaming_saved}</div>}
      <button style={saveButtonStyle(saving)} onClick={handleSave} disabled={saving}>{saving ? c.saving : c.gaming_save}</button>
    </div>
  );
}

// ── Tab 8: Car Wash Config (US-101) ───────────────────────────

const VEHICLE_OPTS = ['sedan', 'suv', 'truck', 'motorcycle'] as const;
const VEHICLE_LABELS: Record<string, { ar: string; en: string }> = {
  sedan:      { ar: 'سيدان 🚗',      en: 'Sedan 🚗' },
  suv:        { ar: 'SUV 🚙',         en: 'SUV 🚙' },
  truck:      { ar: 'شاحنة 🚛',       en: 'Truck 🚛' },
  motorcycle: { ar: 'موتوسيكل 🏍️',   en: 'Motorcycle 🏍️' },
};
const CW_DURATION_OPTS = [30, 60, 90];
const SALON_STORAGE_KEY  = 'hagez_salon_config';
const RESTAURANT_STORAGE_KEY = 'hagez_restaurant_config';

function CarWashConfigTab() {
  const { toast } = useToast();
  const { lang } = useLang();
  const c = SC[lang];
  const CYAN = '#0891B2';
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [wrongCategory, setWrongCategory] = useState(false);
  const [config, setConfig] = useState({ vehicle_types: [] as string[], allows_drop_off: true, allows_wait: true, estimated_duration_minutes: 30, slot_duration_options: [30] as number[], default_slot_duration_minutes: 30, service_packages: [] as { id: string; name_ar: string; name_en: string; duration_min: number; price_egp: number }[] });

  useEffect(() => {
    carWashConfigApi.get().then((r) => { if (r.data?.car_wash_config) setConfig((prev) => ({ ...prev, ...r.data.car_wash_config })); }).catch((e: any) => { if (e?.response?.data?.error?.code === 'WRONG_CATEGORY') setWrongCategory(true); });
  }, []);

  if (wrongCategory) return (
    <div style={{ padding: '40px', textAlign: 'center' as const, color: '#6B7280', fontFamily: 'Cairo, sans-serif' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚗</div>
      <p style={{ fontSize: '16px', fontWeight: 600 }}>{c.cw_wrong_cat}</p>
      <p style={{ fontSize: '14px' }}>{c.cat_wrong}</p>
    </div>
  );

  const toggleVehicle = (v: string) => setConfig((c) => ({ ...c, vehicle_types: c.vehicle_types.includes(v) ? c.vehicle_types.filter((x) => x !== v) : [...c.vehicle_types, v] }));
  const toggleDuration = (d: number) => setConfig((c) => ({ ...c, slot_duration_options: c.slot_duration_options.includes(d) ? c.slot_duration_options.filter((x) => x !== d) : [...c.slot_duration_options, d].sort((a, b) => a - b) }));
  const updatePackage = (index: number, field: string, value: any) => setConfig((c) => { const pkgs = [...c.service_packages]; pkgs[index] = { ...pkgs[index], [field]: value }; return { ...c, service_packages: pkgs }; });
  const addPackage = () => setConfig((c) => ({ ...c, service_packages: [...c.service_packages, { id: `pkg_${Date.now()}`, name_ar: '', name_en: '', duration_min: 30, price_egp: 80 }] }));
  const removePackage = (i: number) => setConfig((c) => ({ ...c, service_packages: c.service_packages.filter((_, j) => j !== i) }));

  async function handleSave() {
    setSaving(true);
    try { await carWashConfigApi.update(config); setSuccess(true); setTimeout(() => setSuccess(false), 3000); }
    catch { toast.error(c.cw_toast_err); }
    finally { setSaving(false); }
  }

  const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #E5E7EB', marginBottom: 16 };
  const sT: React.CSSProperties = { ...sectionTitle, marginBottom: 14 };

  return (
    <div>
      <div style={cardStyle}>
        <p style={sT}>{c.cw_vehicles_hdr}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
          {VEHICLE_OPTS.map((v) => (
            <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 16px', borderRadius: '10px', border: `2px solid ${config.vehicle_types.includes(v) ? CYAN : '#E5E7EB'}`, backgroundColor: config.vehicle_types.includes(v) ? CYAN + '11' : '#fff' }}>
              <input type="checkbox" checked={config.vehicle_types.includes(v)} onChange={() => toggleVehicle(v)} style={{ accentColor: CYAN }} />
              <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: config.vehicle_types.includes(v) ? CYAN : '#374151', fontWeight: 600 }}>{lang === 'ar' ? VEHICLE_LABELS[v].ar : VEHICLE_LABELS[v].en}</span>
            </label>
          ))}
        </div>

        <p style={sT}>{c.cw_delivery_hdr}</p>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
          {[{ key: 'allows_drop_off', label: c.cw_drop_off }, { key: 'allows_wait', label: c.cw_wait }].map((opt) => (
            <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={(config as any)[opt.key]} onChange={(e) => setConfig((c) => ({ ...c, [opt.key]: e.target.checked }))} style={{ accentColor: CYAN }} />
              <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#374151' }}>{opt.label}</span>
            </label>
          ))}
        </div>

        <p style={sT}>{c.cw_est_dur_hdr}</p>
        <input type="number" min={10} max={180} value={config.estimated_duration_minutes} onChange={(e) => setConfig((c) => ({ ...c, estimated_duration_minutes: Number(e.target.value) }))} style={{ padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #E5E7EB', fontFamily: 'Cairo, sans-serif', fontSize: '15px', width: '120px', marginBottom: '20px', direction: 'ltr', textAlign: 'center' as const }} />

        <p style={sT}>{c.cw_durations_hdr}</p>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          {CW_DURATION_OPTS.map((d) => (
            <label key={d} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 18px', borderRadius: '10px', border: `2px solid ${config.slot_duration_options.includes(d) ? CYAN : '#E5E7EB'}`, backgroundColor: config.slot_duration_options.includes(d) ? CYAN + '11' : '#fff' }}>
              <input type="checkbox" checked={config.slot_duration_options.includes(d)} onChange={() => toggleDuration(d)} style={{ accentColor: CYAN }} />
              <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: config.slot_duration_options.includes(d) ? CYAN : '#374151', fontWeight: 600 }}>{d} {c.cw_minute}</span>
            </label>
          ))}
        </div>

        <p style={sT}>{c.cw_packages_hdr}</p>
        {config.service_packages.map((pkg, i) => (
          <div key={i} style={{ backgroundColor: '#F9FAFB', borderRadius: '12px', padding: '16px', marginBottom: '12px', border: '1px solid #E5E7EB' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#6B7280', marginBottom: '4px' }}>{c.cw_name_ar}</label>
                <input style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontFamily: 'Cairo, sans-serif', fontSize: '14px', direction: 'rtl' }} value={pkg.name_ar} onChange={(e) => updatePackage(i, 'name_ar', e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#6B7280', marginBottom: '4px' }}>{c.cw_name_en}</label>
                <input style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontFamily: 'Cairo, sans-serif', fontSize: '14px' }} value={pkg.name_en} onChange={(e) => updatePackage(i, 'name_en', e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#6B7280', marginBottom: '4px' }}>{c.cw_price}</label>
                <input type="number" min={0} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontFamily: 'Cairo, sans-serif', fontSize: '14px' }} value={pkg.price_egp} onChange={(e) => updatePackage(i, 'price_egp', Number(e.target.value))} />
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#6B7280', marginBottom: '4px' }}>{c.cw_duration}</label>
                <input type="number" min={5} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontFamily: 'Cairo, sans-serif', fontSize: '14px' }} value={pkg.duration_min} onChange={(e) => updatePackage(i, 'duration_min', Number(e.target.value))} />
              </div>
            </div>
            <button onClick={() => removePackage(i)} style={{ marginTop: '10px', padding: '6px 14px', background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '8px', fontFamily: 'Cairo, sans-serif', fontSize: '13px', cursor: 'pointer' }}>{c.cw_remove_pkg}</button>
          </div>
        ))}
        <button onClick={addPackage} style={{ padding: '10px 20px', background: CYAN + '22', color: CYAN, border: `1.5px dashed ${CYAN}`, borderRadius: '10px', fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '24px' }}>{c.cw_add_pkg}</button>

        <div>
          <button style={saveButtonStyle(saving)} disabled={saving} onClick={handleSave}>{saving ? c.saving : c.cw_save}</button>
          {success && <span style={{ marginRight: '16px', color: '#059669', fontFamily: 'Cairo, sans-serif', fontSize: '14px' }}>{c.cw_saved}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Tab 9: Restaurant Config ──────────────────────────────────

function RestaurantConfigTab() {
  const { toast } = useToast();
  const { lang } = useLang();
  const c = SC[lang];
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({ dining_type: 'dine_in' as 'dine_in' | 'takeaway' | 'both', max_party_size: 10, reservation_interval_min: 30, smoking_section: false, outdoor_seating: false, valet_parking: false, min_advance_booking_hours: 1, max_advance_booking_days: 30, notes_ar: '' });

  useEffect(() => {
    try { const saved = localStorage.getItem(RESTAURANT_STORAGE_KEY); if (saved) setConfig(JSON.parse(saved)); } catch { /* ignore */ }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    try { localStorage.setItem(RESTAURANT_STORAGE_KEY, JSON.stringify(config)); toast.success(c.rest_toast_ok); }
    catch { toast.error(c.rest_toast_err); }
    finally { setSaving(false); }
  };

  const lbl = (label: string) => (
    <label style={{ display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>{label}</label>
  );

  return (
    <div style={{ maxWidth: '720px' }}>
      <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>{c.rest_desc}</p>

      <div style={{ marginBottom: '20px' }}>
        {lbl(c.rest_dining_lbl)}
        <div style={{ display: 'flex', gap: '10px' }}>
          {([['dine_in', c.rest_dine_in], ['takeaway', c.rest_takeaway], ['both', c.rest_both]] as [string, string][]).map(([val, label]) => (
            <button key={val} onClick={() => setConfig((c) => ({ ...c, dining_type: val as typeof config.dining_type }))} style={{ padding: '10px 20px', borderRadius: '10px', border: `2px solid ${config.dining_type === val ? '#0F2044' : '#E5E7EB'}`, background: config.dining_type === val ? '#0F2044' : '#fff', fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: 600, color: config.dining_type === val ? '#fff' : '#6B7280', cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {[
          { key: 'max_party_size',            label: c.rest_party_lbl,    min: 1, max: 50 },
          { key: 'reservation_interval_min',  label: c.rest_interval_lbl, min: 15, max: 120, step: 15 },
          { key: 'min_advance_booking_hours', label: c.rest_min_adv,      min: 0, max: 48 },
          { key: 'max_advance_booking_days',  label: c.rest_max_adv,      min: 1, max: 90 },
        ].map(({ key, label, min, max, step }) => (
          <div key={key}>
            {lbl(label)}
            <input type="number" min={min} max={max} step={step ?? 1} value={(config as any)[key]} onChange={(e) => setConfig((c) => ({ ...c, [key]: Number(e.target.value) }))} style={inputStyle} />
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '20px' }}>
        {lbl(c.rest_amenities_lbl)}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {([['smoking_section', c.rest_smoking], ['outdoor_seating', c.rest_outdoor], ['valet_parking', c.rest_valet]] as [keyof typeof config, string][]).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#0F2044' }}>
              <input type="checkbox" checked={config[key] as boolean} onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.checked }))} style={{ width: '17px', height: '17px', accentColor: '#0F2044', cursor: 'pointer' }} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        {lbl(c.rest_notes_lbl)}
        <textarea value={config.notes_ar} onChange={(e) => setConfig((c) => ({ ...c, notes_ar: e.target.value }))} placeholder={c.rest_notes_ph} style={{ ...inputStyle, height: '80px', resize: 'vertical' } as React.CSSProperties} />
      </div>

      <button style={saveButtonStyle(saving)} disabled={saving} onClick={handleSave}>{saving ? c.saving : c.rest_save}</button>
    </div>
  );
}

// ── Tab 10: Salon Config ──────────────────────────────────────

function SalonConfigTab() {
  const { toast } = useToast();
  const { lang } = useLang();
  const c = SC[lang];
  const MAGENTA = '#E91E8C';
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({ gender_policy: 'female' as 'female' | 'male' | 'mixed', walk_in_allowed: true, home_service: false, max_advance_booking_days: 14, session_buffer_min: 15, service_categories: [] as string[], notes_ar: '' });

  const SERVICE_CATS = [
    { key: 'hair',    ar: 'شعر',         en: 'Hair' },
    { key: 'nails',   ar: 'أظافر',       en: 'Nails' },
    { key: 'skin',    ar: 'بشرة وعناية', en: 'Skin care' },
    { key: 'makeup',  ar: 'مكياج',       en: 'Makeup' },
    { key: 'lashes',  ar: 'رموش',        en: 'Lashes' },
    { key: 'massage', ar: 'مساج',        en: 'Massage' },
    { key: 'laser',   ar: 'ليزر وتقشير', en: 'Laser & Peel' },
  ];

  useEffect(() => {
    try { const saved = localStorage.getItem(SALON_STORAGE_KEY); if (saved) setConfig(JSON.parse(saved)); } catch { /* ignore */ }
  }, []);

  const toggleCat = (key: string) => setConfig((c) => ({ ...c, service_categories: c.service_categories.includes(key) ? c.service_categories.filter((k) => k !== key) : [...c.service_categories, key] }));

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    try { localStorage.setItem(SALON_STORAGE_KEY, JSON.stringify(config)); toast.success(c.salon_toast_ok); }
    catch { toast.error(c.salon_toast_err); }
    finally { setSaving(false); }
  };

  const lbl = (label: string) => (
    <label style={{ display: 'block', fontFamily: 'Cairo, sans-serif', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>{label}</label>
  );

  return (
    <div style={{ maxWidth: '720px' }}>
      <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>{c.salon_desc}</p>

      <div style={{ marginBottom: '20px' }}>
        {lbl(c.salon_gender_lbl)}
        <div style={{ display: 'flex', gap: '10px' }}>
          {([['female', c.salon_female], ['male', c.salon_male], ['mixed', c.salon_mixed]] as [string, string][]).map(([val, label]) => (
            <button key={val} onClick={() => setConfig((c) => ({ ...c, gender_policy: val as typeof config.gender_policy }))} style={{ padding: '10px 20px', borderRadius: '10px', border: `2px solid ${config.gender_policy === val ? MAGENTA : '#E5E7EB'}`, background: config.gender_policy === val ? '#FDF2F8' : '#fff', fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: 600, color: config.gender_policy === val ? MAGENTA : '#6B7280', cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        {lbl(c.salon_cats_lbl)}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {SERVICE_CATS.map(({ key, ar, en }) => (
            <button key={key} onClick={() => toggleCat(key)} style={{ padding: '8px 16px', borderRadius: '20px', border: `2px solid ${config.service_categories.includes(key) ? MAGENTA : '#E5E7EB'}`, background: config.service_categories.includes(key) ? '#FDF2F8' : '#fff', fontFamily: 'Cairo, sans-serif', fontSize: '14px', fontWeight: 600, color: config.service_categories.includes(key) ? MAGENTA : '#6B7280', cursor: 'pointer' }}>
              {lang === 'ar' ? ar : en}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div>
          {lbl(c.salon_buffer_lbl)}
          <input type="number" min={0} max={60} step={5} value={config.session_buffer_min} onChange={(e) => setConfig((c) => ({ ...c, session_buffer_min: Number(e.target.value) }))} style={inputStyle} />
        </div>
        <div>
          {lbl(c.salon_adv_lbl)}
          <input type="number" min={1} max={90} value={config.max_advance_booking_days} onChange={(e) => setConfig((c) => ({ ...c, max_advance_booking_days: Number(e.target.value) }))} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        {([['walk_in_allowed', c.salon_walkin_lbl], ['home_service', c.salon_home_lbl]] as [keyof typeof config, string][]).map(([key, label]) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontSize: '15px', color: '#0F2044' }}>
            <input type="checkbox" checked={config[key] as boolean} onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.checked }))} style={{ width: '18px', height: '18px', accentColor: MAGENTA, cursor: 'pointer' }} />
            {label}
          </label>
        ))}
      </div>

      <div style={{ marginBottom: '24px' }}>
        {lbl(c.salon_notes_lbl)}
        <textarea value={config.notes_ar} onChange={(e) => setConfig((c) => ({ ...c, notes_ar: e.target.value }))} placeholder={c.salon_notes_ph} style={{ ...inputStyle, height: '80px', resize: 'vertical' } as React.CSSProperties} />
      </div>

      <button style={saveButtonStyle(saving)} disabled={saving} onClick={handleSave}>{saving ? c.saving : c.salon_save}</button>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function buildPolicyPreview(depositType: string, depositValue: number, cancellationWindowHours: number, lang: 'ar' | 'en'): string {
  if (lang === 'en') {
    const depositText = depositType === 'fixed' ? `${depositValue} EGP` : `${depositValue}% of the service value`;
    if (cancellationWindowHours === 0) return `A deposit of ${depositText} is required. Cancellation policy: non-refundable.`;
    return `A deposit of ${depositText} is required. Free cancellation up to ${cancellationWindowHours} hours before the appointment. After that, the deposit is forfeited.`;
  }
  const depositText = depositType === 'fixed' ? `${depositValue} ج.م` : `${depositValue}% من قيمة الخدمة`;
  if (cancellationWindowHours === 0) return `يُطلب عربون ${depositText}. سياسة الإلغاء: العربون غير قابل للاسترداد.`;
  return `يُطلب عربون ${depositText}. يمكن الإلغاء مجاناً قبل ${cancellationWindowHours} ساعة من الموعد. الإلغاء بعد ذلك يُفقدك العربون.`;
}

// ── Shared styles ─────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: '8px 10px', border: '1.5px solid #E5E7EB', borderRadius: '8px',
  fontFamily: 'Cairo, sans-serif', fontSize: '14px', color: '#0F2044', width: '100%', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  fontSize: '12px', color: '#6B7280', fontWeight: 600, whiteSpace: 'nowrap',
};
const sectionCard: React.CSSProperties = {
  backgroundColor: '#fff', borderRadius: '12px', padding: '20px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};
const sectionTitle: React.CSSProperties = {
  fontSize: '16px', fontWeight: 700, color: '#0F2044', marginTop: 0, marginBottom: '14px',
};
const saveButtonStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '14px 32px', background: '#1B8A7A', border: 'none', borderRadius: '12px',
  fontFamily: 'Cairo, sans-serif', fontSize: '16px', fontWeight: 700, color: '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.7 : 1,
});
