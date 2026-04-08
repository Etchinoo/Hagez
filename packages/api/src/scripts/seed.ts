// ============================================================
// SUPER RESERVATION PLATFORM — Dev Seed Script
// Creates sample businesses + slots for local development.
// Run: npm run db:seed (from packages/api or monorepo root)
// ============================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding dev database...');

  // ── Seed admin users (EP-09) ───────────────────────────────
  // Phones are read from env to avoid hard-coding credentials.
  // Default to dev placeholders so seed works without .env.
  const adminPhone      = process.env.ADMIN_PHONE      ?? '+201099900001';
  const superAdminPhone = process.env.SUPER_ADMIN_PHONE ?? '+201099900002';

  await prisma.user.upsert({
    where: { phone: adminPhone },
    update: { role: 'admin' },
    create: { phone: adminPhone, full_name: 'Ops Admin', language_pref: 'ar', role: 'admin' },
  });

  await prisma.user.upsert({
    where: { phone: superAdminPhone },
    update: { role: 'super_admin' },
    create: { phone: superAdminPhone, full_name: 'Super Admin', language_pref: 'ar', role: 'super_admin' },
  });

  console.log(`   Admin:       ${adminPhone}`);
  console.log(`   Super Admin: ${superAdminPhone}`);

  // ── Seed user (business owner) ─────────────────────────────
  const owner = await prisma.user.upsert({
    where: { phone: '+201000000001' },
    update: { role: 'business_owner' },
    create: {
      phone: '+201000000001',
      full_name: 'صاحب النشاط',
      language_pref: 'ar',
      role: 'business_owner',
    },
  });

  // ── Seed Restaurant ────────────────────────────────────────
  const restaurant = await prisma.business.upsert({
    where: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    update: {},
    create: {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      owner_user_id: owner.id,
      name_ar: 'مطعم النيل الذهبي',
      name_en: 'Golden Nile Restaurant',
      category: 'restaurant',
      district: 'zamalek',
      lat: 30.0626,
      lng: 31.2197,
      description_ar: 'مطعم راقٍ يقدم أشهى المأكولات المصرية والشرقية بإطلالة على النيل.',
      description_en: 'An upscale restaurant serving the finest Egyptian and Oriental cuisine with a Nile view.',
      status: 'active',
      subscription_tier: 'growth',
      rating_avg: 4.7,
      review_count: 128,
      is_featured: true,
    },
  });

  // ── Seed Salon ─────────────────────────────────────────────
  const salon = await prisma.business.upsert({
    where: { id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' },
    update: {},
    create: {
      id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      owner_user_id: owner.id,
      name_ar: 'صالون لميس للتجميل',
      name_en: 'Lamees Beauty Salon',
      category: 'salon',
      district: 'new_cairo',
      lat: 30.0281,
      lng: 31.4634,
      description_ar: 'صالون متخصص في العناية بالشعر والبشرة مع خبرة تتجاوز 15 عاماً.',
      description_en: 'Specialist salon for hair and skin care with over 15 years of experience.',
      status: 'active',
      subscription_tier: 'starter',
      rating_avg: 4.5,
      review_count: 64,
      is_featured: false,
    },
  });

  // ── Seed Salon Staff (Resources) ───────────────────────────
  await prisma.resource.upsert({
    where: { id: 'c3d4e5f6-a7b8-9012-cdef-123456789012' },
    update: {},
    create: {
      id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      business_id: salon.id,
      type: 'staff',
      name_ar: 'لميس',
      name_en: 'Lamees',
      specialisations: ['haircut', 'colour', 'treatment'],
      is_active: true,
    },
  });

  await prisma.resource.upsert({
    where: { id: 'd4e5f6a7-b8c9-0123-defa-234567890123' },
    update: {},
    create: {
      id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
      business_id: salon.id,
      type: 'staff',
      name_ar: 'نور',
      name_en: 'Nour',
      specialisations: ['haircut', 'blowout'],
      is_active: true,
    },
  });

  // ── Seed Restaurant Tables ─────────────────────────────────
  await prisma.resource.upsert({
    where: { id: 'e5f6a7b8-c9d0-1234-efab-345678901234' },
    update: {},
    create: {
      id: 'e5f6a7b8-c9d0-1234-efab-345678901234',
      business_id: restaurant.id,
      type: 'table',
      name_ar: 'طاولة النيل 1',
      name_en: 'Nile Table 1',
      capacity: 4,
      is_active: true,
    },
  });

  // ── Seed Slots for next 7 days ─────────────────────────────
  // Use createMany with skipDuplicates to avoid UUID conflicts on re-seed.
  const now = new Date();
  const tableId = 'e5f6a7b8-c9d0-1234-efab-345678901234';
  const stylist1Id = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
  const stylist2Id = 'd4e5f6a7-b8c9-0123-defa-234567890123';

  const restaurantSlots = [];
  const restaurantTimes = [12, 14, 18, 20];
  for (let day = 1; day <= 7; day++) {
    for (const hour of restaurantTimes) {
      const start = new Date(now);
      start.setDate(start.getDate() + day);
      start.setHours(hour, 0, 0, 0);
      restaurantSlots.push({
        business_id: restaurant.id,
        resource_id: tableId,
        start_time: start,
        end_time: new Date(start.getTime() + 90 * 60 * 1000),
        duration_minutes: 90,
        capacity: 4,
        status: 'available' as const,
        deposit_amount: 100,
        cancellation_window_hours: 24,
      });
    }
  }
  await prisma.slot.createMany({ data: restaurantSlots, skipDuplicates: true });

  const salonSlots = [];
  const salonTimes = [10, 12, 14, 16];
  for (let day = 1; day <= 7; day++) {
    for (const stylistId of [stylist1Id, stylist2Id]) {
      for (const hour of salonTimes) {
        const start = new Date(now);
        start.setDate(start.getDate() + day);
        start.setHours(hour, 0, 0, 0);
        salonSlots.push({
          business_id: salon.id,
          resource_id: stylistId,
          start_time: start,
          end_time: new Date(start.getTime() + 60 * 60 * 1000),
          duration_minutes: 60,
          capacity: 1,
          status: 'available' as const,
          deposit_amount: 50,
          cancellation_window_hours: 12,
        });
      }
    }
  }

  await prisma.slot.createMany({ data: salonSlots, skipDuplicates: true });

  // ── Seed Court Business (US-088) ───────────────────────────
  const court = await prisma.business.upsert({
    where: { id: 'c3a1b2e4-d5f6-7890-abcd-ef9876543210' },
    update: {},
    create: {
      id: 'c3a1b2e4-d5f6-7890-abcd-ef9876543210',
      owner_user_id: owner.id,
      name_ar: 'ملاعب الأهلي',
      name_en: 'Al Ahly Courts',
      category: 'court',
      district: 'nasr_city',
      lat: 30.0638,
      lng: 31.3416,
      description_ar: 'ملاعب رياضية متعددة الأغراض بأعلى المواصفات في قلب مدينة نصر.',
      description_en: 'Multi-purpose sports courts with top-tier facilities in the heart of Nasr City.',
      status: 'active',
      subscription_tier: 'growth',
      rating_avg: 4.6,
      review_count: 42,
      is_featured: true,
      policy_deposit_value: 150,
      policy_cancellation_window_hours: 6,
    },
  });

  // Court config
  await prisma.courtConfig.upsert({
    where: { business_id: court.id },
    update: {},
    create: {
      business_id: court.id,
      sport_types: ['football', 'basketball', 'volleyball'],
      court_type: 'outdoor',
      surface_type: 'turf',
      has_lighting: true,
      equipment_available: ['balls', 'bibs', 'vests', 'cones'],
      slot_duration_options: [60, 90, 120],
      default_slot_duration_minutes: 60,
    },
  });

  // Court resources
  const court1Id = 'f6a7b8c9-d0e1-2345-fabc-456789012345';
  const court2Id = 'a7b8c9d0-e1f2-3456-abcd-567890123456';

  await prisma.resource.upsert({
    where: { id: court1Id },
    update: {},
    create: {
      id: court1Id,
      business_id: court.id,
      type: 'court',
      name_ar: 'ملعب ١',
      name_en: 'Court 1',
      capacity: 1,
      is_active: true,
    },
  });

  await prisma.resource.upsert({
    where: { id: court2Id },
    update: {},
    create: {
      id: court2Id,
      business_id: court.id,
      type: 'court',
      name_ar: 'ملعب ٢',
      name_en: 'Court 2',
      capacity: 1,
      is_active: true,
    },
  });

  // Court slots: next 14 days, 07:00–21:00 hourly, 1 slot per court per hour
  const courtSlots = [];
  for (let day = 1; day <= 14; day++) {
    for (const courtId of [court1Id, court2Id]) {
      for (let hour = 7; hour <= 21; hour++) {
        const start = new Date(now);
        start.setDate(start.getDate() + day);
        start.setHours(hour, 0, 0, 0);
        courtSlots.push({
          business_id: court.id,
          resource_id: courtId,
          start_time: start,
          end_time: new Date(start.getTime() + 60 * 60 * 1000),
          duration_minutes: 60,
          capacity: 1,
          status: 'available' as const,
          deposit_amount: 150,
          cancellation_window_hours: 6,
        });
      }
    }
  }
  await prisma.slot.createMany({ data: courtSlots, skipDuplicates: true });

  // ── Seed Gaming Cafe (US-095) ──────────────────────────────
  const gamingCafe = await prisma.business.upsert({
    where: { id: 'd4b3c2e1-f6a7-8901-bcde-fa9876543211' },
    update: {},
    create: {
      id: 'd4b3c2e1-f6a7-8901-bcde-fa9876543211',
      owner_user_id: owner.id,
      name_ar: 'نادي الجيمنج كايرو',
      name_en: 'Cairo Gaming Club',
      category: 'gaming_cafe',
      district: 'new_cairo',
      lat: 30.0271,
      lng: 31.4634,
      description_ar: 'أحدث محطات الألعاب بأعلى مواصفات PC وـ PlayStation وـ VR في القاهرة الجديدة.',
      description_en: 'Top-spec PC, PlayStation, and VR gaming stations in New Cairo.',
      status: 'active',
      subscription_tier: 'growth',
      rating_avg: 4.8,
      review_count: 93,
      is_featured: true,
      policy_deposit_value: 80,
      policy_cancellation_window_hours: 2,
    },
  });

  // Gaming config
  await prisma.gamingConfig.upsert({
    where: { business_id: gamingCafe.id },
    update: {},
    create: {
      business_id: gamingCafe.id,
      station_types: ['pc', 'console', 'vr', 'group_room'],
      has_group_rooms: true,
      group_room_capacity: 8,
      genre_options: ['fps', 'rpg', 'sports', 'racing', 'casual', 'horror', 'moba'],
      slot_duration_options: [60, 120, 180],
      default_slot_duration_minutes: 60,
    },
  });

  // Gaming station resources (3 PC, 2 console, 1 VR, 1 group room)
  const station1Id = 'b8c9d0e1-f2a3-4567-bcde-678901234567';
  const station2Id = 'b9d0e1f2-a3b4-5678-cdef-789012345678';
  const station3Id = 'c0e1f2a3-b4c5-6789-defa-890123456789';
  const station4Id = 'c1f2a3b4-c5d6-7890-efab-901234567890';
  const station5Id = 'c2a3b4c5-d6e7-8901-fabc-012345678901';
  const station6Id = 'c3b4c5d6-e7f8-9012-abcd-123456789012';
  const station7Id = 'c4c5d6e7-f8a9-0123-bcde-234567890123';

  const stationData = [
    { id: station1Id, type_label: 'PC Station 1', type_ar: 'محطة PC ١',   type_val: 'pc',         capacity: 1 },
    { id: station2Id, type_label: 'PC Station 2', type_ar: 'محطة PC ٢',   type_val: 'pc',         capacity: 1 },
    { id: station3Id, type_label: 'PC Station 3', type_ar: 'محطة PC ٣',   type_val: 'pc',         capacity: 1 },
    { id: station4Id, type_label: 'Console 1',    type_ar: 'بلايستيشن ١', type_val: 'console',    capacity: 2 },
    { id: station5Id, type_label: 'Console 2',    type_ar: 'بلايستيشن ٢', type_val: 'console',    capacity: 2 },
    { id: station6Id, type_label: 'VR Zone',      type_ar: 'ركن الـ VR',   type_val: 'vr',         capacity: 1 },
    { id: station7Id, type_label: 'Group Room',   type_ar: 'غرفة جماعية',  type_val: 'group_room', capacity: 8 },
  ];

  for (const st of stationData) {
    await prisma.resource.upsert({
      where: { id: st.id },
      update: {},
      create: {
        id: st.id,
        business_id: gamingCafe.id,
        type: 'station',
        name_ar: st.type_ar,
        name_en: st.type_label,
        capacity: st.capacity,
        is_active: true,
      },
    });
  }

  // Gaming slots: next 14 days, 10:00–23:00 hourly, 1 slot per station per hour
  const gamingSlots = [];
  const stationIds = stationData.map((s) => s.id);
  for (let day = 1; day <= 14; day++) {
    for (const stationId of stationIds) {
      for (let hour = 10; hour <= 23; hour++) {
        const start = new Date(now);
        start.setDate(start.getDate() + day);
        start.setHours(hour, 0, 0, 0);
        gamingSlots.push({
          business_id: gamingCafe.id,
          resource_id: stationId,
          start_time: start,
          end_time: new Date(start.getTime() + 60 * 60 * 1000),
          duration_minutes: 60,
          capacity: 1,
          status: 'available' as const,
          deposit_amount: 80,
          cancellation_window_hours: 2,
        });
      }
    }
  }
  await prisma.slot.createMany({ data: gamingSlots, skipDuplicates: true });

  // ── Seed Car Wash Business (US-101) ───────────────────────
  const carWash = await prisma.business.upsert({
    where: { id: 'e5c4d3b2-a1f0-9876-cdef-ab1234567890' },
    update: {},
    create: {
      id: 'e5c4d3b2-a1f0-9876-cdef-ab1234567890',
      owner_user_id: owner.id,
      name_ar: 'اكسبريس واش',
      name_en: 'Express Wash',
      category: 'car_wash',
      district: 'maadi',
      lat: 29.9602,
      lng: 31.2569,
      description_ar: 'خدمة غسيل السيارات الاحترافية السريعة في المعادي. خدمات أساسية وبريميوم وتفصيل.',
      description_en: 'Professional express car wash in Maadi. Basic, premium, and detailing services.',
      status: 'active',
      subscription_tier: 'starter',
      rating_avg: 4.4,
      review_count: 57,
      is_featured: false,
      policy_deposit_value: 50,
      policy_cancellation_window_hours: 1,
    },
  });

  // Car wash config
  await prisma.carWashConfig.upsert({
    where: { business_id: carWash.id },
    update: {},
    create: {
      business_id: carWash.id,
      vehicle_types: ['sedan', 'suv', 'truck', 'motorcycle'],
      service_packages: [
        { id: 'basic',     name_ar: 'غسيل خارجي',      name_en: 'Basic Wash',      duration_min: 20, price_egp: 80  },
        { id: 'premium',   name_ar: 'غسيل خارجي وداخلي', name_en: 'Premium Wash',    duration_min: 45, price_egp: 150 },
        { id: 'detailing', name_ar: 'تفصيل كامل',        name_en: 'Full Detailing',  duration_min: 90, price_egp: 350 },
      ],
      allows_drop_off: true,
      allows_wait: true,
      estimated_duration_minutes: 30,
      slot_duration_options: [30, 60],
      default_slot_duration_minutes: 30,
    },
  });

  // Car wash bay resources
  const bay1Id = 'd5d6e7f8-a9b0-1234-cdef-345678901234';
  const bay2Id = 'd6e7f8a9-b0c1-2345-defa-456789012345';
  const bay3Id = 'd7f8a9b0-c1d2-3456-efab-567890123456';

  for (const [bayId, nameAr, nameEn] of [
    [bay1Id, 'بيه ١', 'Bay 1'],
    [bay2Id, 'بيه ٢', 'Bay 2'],
    [bay3Id, 'بيه ٣', 'Bay 3'],
  ] as [string, string, string][]) {
    await prisma.resource.upsert({
      where: { id: bayId },
      update: {},
      create: {
        id: bayId,
        business_id: carWash.id,
        type: 'bay',
        name_ar: nameAr,
        name_en: nameEn,
        capacity: 1,
        is_active: true,
      },
    });
  }

  // Car wash slots: next 14 days, 08:00–20:00 every 30 min, 1 slot per bay
  const carWashSlots = [];
  const bayIds = [bay1Id, bay2Id, bay3Id];
  for (let day = 1; day <= 14; day++) {
    for (const bayId of bayIds) {
      for (let hour = 8; hour < 20; hour++) {
        for (const min of [0, 30]) {
          const start = new Date(now);
          start.setDate(start.getDate() + day);
          start.setHours(hour, min, 0, 0);
          carWashSlots.push({
            business_id: carWash.id,
            resource_id: bayId,
            start_time: start,
            end_time: new Date(start.getTime() + 30 * 60 * 1000),
            duration_minutes: 30,
            capacity: 1,
            status: 'available' as const,
            deposit_amount: 50,
            cancellation_window_hours: 1,
          });
        }
      }
    }
  }
  await prisma.slot.createMany({ data: carWashSlots, skipDuplicates: true });

  // ── Seed Consumer Test User ────────────────────────────────
  const consumer = await prisma.user.upsert({
    where: { phone: '+201000000099' },
    update: {},
    create: {
      phone: '+201000000099',
      full_name: 'أحمد محمود',
      language_pref: 'ar',
      role: 'consumer',
    },
  });

  // ── Seed Business Services (US-058) ───────────────────────
  // Salon services — deleteMany + createMany so re-seed stays clean
  await prisma.businessService.deleteMany({ where: { business_id: salon.id } });
  await prisma.businessService.createMany({
    data: [
      { business_id: salon.id, name_ar: 'قص شعر',        name_en: 'Haircut',         price_egp: 150, duration_min: 45, is_active: true },
      { business_id: salon.id, name_ar: 'صبغ شعر',        name_en: 'Hair Color',      price_egp: 350, duration_min: 90, is_active: true },
      { business_id: salon.id, name_ar: 'علاج شعر',       name_en: 'Hair Treatment',  price_egp: 250, duration_min: 60, is_active: true },
      { business_id: salon.id, name_ar: 'سشوار',           name_en: 'Blow Dry',        price_egp: 100, duration_min: 30, is_active: true },
      { business_id: salon.id, name_ar: 'عناية بالأظافر', name_en: 'Nail Care',       price_egp: 120, duration_min: 45, is_active: true },
      { business_id: salon.id, name_ar: 'مكياج',           name_en: 'Makeup',          price_egp: 400, duration_min: 60, is_active: true },
    ],
  });

  // Restaurant services
  await prisma.businessService.deleteMany({ where: { business_id: restaurant.id } });
  await prisma.businessService.createMany({
    data: [
      { business_id: restaurant.id, name_ar: 'حجز طاولة',   name_en: 'Table Reservation', price_egp: 100, duration_min: 90,  is_active: true },
      { business_id: restaurant.id, name_ar: 'حجز VIP',     name_en: 'VIP Table',          price_egp: 300, duration_min: 120, is_active: true },
      { business_id: restaurant.id, name_ar: 'حفلة خاصة',   name_en: 'Private Event',      price_egp: 800, duration_min: 180, is_active: true },
    ],
  });

  console.log('   Services:    6 salon + 3 restaurant');

  // ── Seed Pricing Rules ─────────────────────────────────────
  await prisma.pricingRule.deleteMany({ where: { business_id: { in: [restaurant.id, salon.id] } } });
  await prisma.pricingRule.createMany({
    data: [
      {
        // Restaurant weekend evening surge
        business_id: restaurant.id,
        rule_type: 'surge',
        name_ar: 'سعر نهاية الأسبوع',
        multiplier: 1.25,
        days_of_week: [5, 6],
        hour_start: 18,
        hour_end: 23,
        is_active: true,
      },
      {
        // Restaurant last-minute discount
        business_id: restaurant.id,
        rule_type: 'last_minute',
        name_ar: 'خصم اللحظة الأخيرة',
        discount_pct: 15,
        minutes_before: 90,
        days_of_week: [],
        is_active: true,
      },
      {
        // Salon last-minute discount
        business_id: salon.id,
        rule_type: 'last_minute',
        name_ar: 'خصم الحجز السريع',
        discount_pct: 20,
        minutes_before: 120,
        days_of_week: [],
        is_active: true,
      },
    ],
  });

  console.log('   Pricing rules: 3 rules seeded');

  // ── Seed Sample Bookings ───────────────────────────────────
  // Pick the first available slot per business for demo bookings
  const [restaurantSlot, salonSlot1, salonSlot2] = await Promise.all([
    prisma.slot.findFirst({ where: { business_id: restaurant.id, status: 'available' } }),
    prisma.slot.findFirst({ where: { business_id: salon.id, status: 'available', resource_id: stylist1Id } }),
    prisma.slot.findFirst({ where: { business_id: salon.id, status: 'available', resource_id: stylist2Id }, skip: 1 }),
  ]);

  if (restaurantSlot) {
    await prisma.booking.upsert({
      where: { booking_ref: 'BK-20260408-00001' },
      update: {},
      create: {
        booking_ref: 'BK-20260408-00001',
        consumer_id: consumer.id,
        business_id: restaurant.id,
        slot_id: restaurantSlot.id,
        resource_id: restaurantSlot.resource_id,
        party_size: 4,
        status: 'confirmed',
        deposit_amount: 100,
        platform_fee: 25,
        payment_method: 'card',
        escrow_status: 'holding',
      },
    });
    await prisma.slot.update({ where: { id: restaurantSlot.id }, data: { status: 'fully_booked' } });
  }

  if (salonSlot1) {
    await prisma.booking.upsert({
      where: { booking_ref: 'BK-20260408-00002' },
      update: {},
      create: {
        booking_ref: 'BK-20260408-00002',
        consumer_id: consumer.id,
        business_id: salon.id,
        slot_id: salonSlot1.id,
        resource_id: salonSlot1.resource_id,
        party_size: 1,
        status: 'confirmed',
        deposit_amount: 50,
        platform_fee: 15,
        payment_method: 'fawry',
        escrow_status: 'holding',
      },
    });
    await prisma.slot.update({ where: { id: salonSlot1.id }, data: { status: 'fully_booked' } });
  }

  if (salonSlot2) {
    await prisma.booking.upsert({
      where: { booking_ref: 'BK-20260408-00003' },
      update: {},
      create: {
        booking_ref: 'BK-20260408-00003',
        consumer_id: consumer.id,
        business_id: salon.id,
        slot_id: salonSlot2.id,
        resource_id: salonSlot2.resource_id,
        party_size: 1,
        status: 'completed',
        deposit_amount: 50,
        platform_fee: 15,
        payment_method: 'card',
        escrow_status: 'released_to_business',
        completed_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    });
    await prisma.slot.update({ where: { id: salonSlot2.id }, data: { status: 'past' } });
  }

  const bookingCount = [restaurantSlot, salonSlot1, salonSlot2].filter(Boolean).length;
  console.log(`   Bookings:    ${bookingCount} sample bookings seeded`);

  const totalSlots = restaurantSlots.length + salonSlots.length + courtSlots.length + gamingSlots.length + carWashSlots.length;
  console.log('✅ Seed complete.');
  console.log(`   Restaurant:  ${restaurant.name_ar} (${restaurant.id})`);
  console.log(`   Salon:       ${salon.name_ar} (${salon.id})`);
  console.log(`   Court:       ${court.name_ar} (${court.id})`);
  console.log(`   Gaming Cafe: ${gamingCafe.name_ar} (${gamingCafe.id})`);
  console.log(`   Car Wash:    ${carWash.name_ar} (${carWash.id})`);
  console.log(`   Slots:       ${totalSlots} total`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
