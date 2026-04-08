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
