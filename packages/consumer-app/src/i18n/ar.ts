// ============================================================
// SUPER RESERVATION PLATFORM — Arabic (RTL) Strings
// All consumer-facing copy. Arabic is the primary language.
// ============================================================

export const ar = {
  common: {
    appName: 'سوبر ريزرفيشن',
    loading: 'جاري التحميل...',
    error: 'حدث خطأ',
    retry: 'إعادة المحاولة',
    confirm: 'تأكيد',
    cancel: 'إلغاء',
    save: 'حفظ',
    back: 'رجوع',
    close: 'إغلاق',
    next: 'التالي',
    egp: 'ج.م',
    viewAll: 'عرض الكل',
  },

  auth: {
    welcomeTitle: 'اتحجز في ثوانٍ',
    welcomeSubtitle: 'احجز جلستك في كافيه جيمنج — في ثوانٍ',
    enterPhone: 'أدخل رقم هاتفك',
    phonePlaceholder: '+201XXXXXXXXX',
    sendOtp: 'إرسال الكود',
    enterOtp: 'أدخل كود التحقق',
    otpSentTo: 'أرسلنا كود التحقق إلى',
    otpPlaceholder: '000000',
    verifyOtp: 'تأكيد',
    resendOtp: 'إعادة إرسال الكود',
    resendIn: 'إعادة الإرسال خلال {{seconds}} ثانية',
    invalidOtp: 'الكود غير صحيح أو منتهي الصلاحية',
    loginWithGoogle: 'الدخول بجوجل',
    loginWithApple: 'الدخول بآبل',
    byProceeding: 'بالمتابعة، أنت توافق على',
    termsOfService: 'شروط الخدمة',
    and: 'و',
    privacyPolicy: 'سياسة الخصوصية',
  },

  home: {
    greeting: 'أهلاً،',
    searchPlaceholder: 'ابحث عن كافيه جيمنج...',
    categories: {
      gaming: 'جيمنج',
    },
    districts: {
      new_cairo: 'القاهرة الجديدة',
      maadi: 'المعادي',
      zamalek: 'الزمالك',
      sheikh_zayed: 'الشيخ زايد',
    },
    featuredTitle: 'مميزة لك',
    nearbyTitle: 'قريبة منك',
    noResults: 'لا توجد نتائج',
    tryAdjustingFilters: 'جرب تعديل الفلاتر أو تغيير المنطقة',
  },

  business: {
    reviews: 'تقييم',
    noReviews: 'لا توجد تقييمات بعد',
    reviewsCount: '{{count}} تقييم',
    bookNow: 'احجز الآن',
    viewAvailability: 'اعرض المواعيد',
    about: 'عن المكان',
    location: 'الموقع',
    stations: 'الأجهزة المتاحة',
    stationType: 'نوع الجهاز',
  },

  booking: {
    selectDate: 'اختر التاريخ',
    selectTime: 'اختر الموعد',
    sessionType: 'نوع الجلسة',
    solo: 'سولو',
    duo: 'ثنائي',
    groupRoom: 'Group Room',
    stationPicker: 'اختر الجهاز',
    genrePreference: 'تفضيل اللعبة',
    duration: 'مدة الجلسة',
    playerCount: 'عدد اللاعبين',
    specialRequests: 'طلبات خاصة (اختياري)',
    specialRequestsPlaceholder: 'طلبات خاصة (اختياري)...',
    slotHeld: 'الموعد محجوز لك لـ',
    minutes: 'دقيقة',
    slotExpired: 'انتهى وقت الحجز. اختر موعداً آخر.',
    summary: {
      title: 'ملخص الحجز',
      at: 'في',
      partySize: 'عدد الأشخاص: {{count}}',
      deposit: 'عربون مسترد',
      platformFee: 'رسوم الحجز',
      total: 'الإجمالي',
      depositNote: 'العربون يُسترد بالكامل عند الإلغاء قبل {{hours}} ساعة',
    },
    payment: {
      title: 'اختر طريقة الدفع',
      card: 'بطاقة بنكية',
      instapay: 'InstaPay',
      fawry: 'فوري',
      vodafone: 'فودافون كاش',
      meeza: 'ميزة',
      payNow: 'ادفع الآن',
    },
    confirmed: {
      title: 'تم تأكيد حجزك! 🎉',
      subtitle: 'شكراً لك. تم إرسال تفاصيل الحجز على واتساب.',
      bookingRef: 'رقم الحجز',
      viewBookings: 'عرض حجوزاتي',
      backHome: 'الرئيسية',
    },
  },

  myBookings: {
    title: 'حجوزاتي',
    upcoming: 'القادمة',
    past: 'السابقة',
    empty: 'لا توجد حجوزات',
    emptySubtitle: 'ابحث عن مكان واحجز الآن',
    statuses: {
      confirmed: 'مؤكد',
      pending_payment: 'في انتظار الدفع',
      completed: 'مكتمل',
      cancelled_by_consumer: 'ملغي منك',
      cancelled_by_business: 'ملغي من المكان',
      no_show: 'غياب',
      disputed: 'قيد المراجعة',
    },
    cancel: 'إلغاء الحجز',
    reschedule: 'تغيير الموعد',
    review: 'اكتب تقييمك',
    cancelConfirm: 'هل أنت متأكد من إلغاء الحجز؟',
    cancelInsideWindow: 'سيتم خصم العربون لأن الإلغاء داخل فترة السياسة.',
    cancelOutsideWindow: 'سيتم استرداد العربون كاملاً خلال 3-5 أيام عمل.',
  },

  review: {
    title: 'كيف كانت تجربتك؟',
    placeholder: 'اكتب تعليقك (اختياري)...',
    submit: 'إرسال التقييم',
    thankYou: 'شكراً على تقييمك! 🌟',
  },

  errors: {
    network: 'تحقق من اتصالك بالإنترنت',
    slotTaken: 'هذا الموعد تم حجزه. اختر موعداً آخر.',
    capacityExceeded: 'لا تتوفر أماكن كافية لعدد ضيوفك.',
    generic: 'حدث خطأ. حاول مرة أخرى.',
  },
} as const;

export type ArStrings = typeof ar;
