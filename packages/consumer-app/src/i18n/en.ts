// ============================================================
// SUPER RESERVATION PLATFORM — English Strings
// Secondary language (RTL layout still applies in Arabic locale)
// ============================================================

export const en = {
  common: {
    appName: 'Super Reservation',
    loading: 'Loading...',
    error: 'Something went wrong',
    retry: 'Retry',
    confirm: 'Confirm',
    cancel: 'Cancel',
    save: 'Save',
    back: 'Back',
    close: 'Close',
    next: 'Next',
    egp: 'EGP',
    viewAll: 'View All',
  },

  auth: {
    welcomeTitle: 'Book in seconds',
    welcomeSubtitle: 'Restaurants, salons, courts and more — one app',
    enterPhone: 'Enter your phone number',
    phonePlaceholder: '+201XXXXXXXXX',
    sendOtp: 'Send Code',
    enterOtp: 'Enter verification code',
    otpSentTo: 'We sent a code to',
    otpPlaceholder: '000000',
    verifyOtp: 'Verify',
    resendOtp: 'Resend Code',
    resendIn: 'Resend in {{seconds}}s',
    invalidOtp: 'Invalid or expired code',
    loginWithGoogle: 'Continue with Google',
    loginWithApple: 'Continue with Apple',
    byProceeding: 'By proceeding, you agree to our',
    termsOfService: 'Terms of Service',
    and: 'and',
    privacyPolicy: 'Privacy Policy',
  },

  home: {
    greeting: 'Hello,',
    searchPlaceholder: 'Search restaurants, salons...',
    categories: {
      restaurant: 'Restaurants',
      salon: 'Salons',
      court: 'Courts',
      gaming: 'Gaming',
      carWash: 'Car Wash',
    },
    districts: {
      new_cairo: 'New Cairo',
      maadi: 'Maadi',
      zamalek: 'Zamalek',
      sheikh_zayed: 'Sheikh Zayed',
    },
    featuredTitle: 'Featured',
    nearbyTitle: 'Nearby',
    noResults: 'No results found',
    tryAdjustingFilters: 'Try adjusting filters or changing the district',
  },

  booking: {
    confirmed: {
      title: 'Booking Confirmed! 🎉',
      subtitle: 'Confirmation details sent to WhatsApp.',
      bookingRef: 'Booking Reference',
      viewBookings: 'My Bookings',
      backHome: 'Home',
    },
    summary: {
      deposit: 'Refundable Deposit',
      platformFee: 'Booking Fee',
      total: 'Total',
      depositNote: 'Deposit fully refunded if cancelled {{hours}}+ hours before',
    },
  },

  myBookings: {
    title: 'My Bookings',
    upcoming: 'Upcoming',
    past: 'Past',
    empty: 'No bookings yet',
    emptySubtitle: 'Find a place and make your first booking',
    statuses: {
      confirmed: 'Confirmed',
      pending_payment: 'Awaiting Payment',
      completed: 'Completed',
      cancelled_by_consumer: 'Cancelled by You',
      cancelled_by_business: 'Cancelled by Business',
      no_show: 'No Show',
      disputed: 'Under Review',
    },
  },
} as const;
