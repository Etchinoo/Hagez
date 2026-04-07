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
    update: {},
    create: {
      phone: '+201000000001',
      full_name: 'صاحب النشاط',
      language_pref: 'ar',
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

  const totalSlots = restaurantSlots.length + salonSlots.length;
  console.log('✅ Seed complete.');
  console.log(`   Restaurant: ${restaurant.name_ar} (${restaurant.id})`);
  console.log(`   Salon:      ${salon.name_ar} (${salon.id})`);
  console.log(`   Slots:      ${totalSlots} total`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
