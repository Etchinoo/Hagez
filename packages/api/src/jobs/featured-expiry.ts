// ============================================================
// SUPER RESERVATION PLATFORM — Featured Listing Expiry Cron (EP-17)
// US-116: Runs every hour. Marks expired featured listings and
//         resets is_featured on the business when plan ends.
// ============================================================

import { CronJob } from 'cron';
import type { PrismaClient } from '@prisma/client';

export function startFeaturedExpiryJob(db: PrismaClient): CronJob {
  const job = new CronJob(
    '0 * * * *', // every hour on the hour
    async () => {
      try {
        const now = new Date();

        // Find active listings whose end date has passed
        const expired = await db.featuredListing.findMany({
          where: { status: 'active', ends_at: { lte: now } },
          select: { id: true, business_id: true },
        });

        if (expired.length === 0) return;

        for (const listing of expired) {
          await db.$transaction([
            db.featuredListing.update({
              where: { id: listing.id },
              data:  { status: 'expired' },
            }),
            db.business.update({
              where: { id: listing.business_id },
              data:  { is_featured: false, featured_until: null },
            }),
          ]);
        }

        console.log(`[featured-expiry] Expired ${expired.length} featured listing(s).`);
      } catch (err) {
        console.error('[featured-expiry] Job failed:', err);
      }
    },
    null,
    true,
    'Africa/Cairo'
  );

  return job;
}
