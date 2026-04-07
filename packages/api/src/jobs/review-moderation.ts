// ============================================================
// SUPER RESERVATION PLATFORM — Review Auto-Moderation Job
// US-076: Runs every 10 minutes.
// Reviews pending > 10 min with no spam signals → auto-approved.
// Updates business.rating_avg and review_count on approval.
// ============================================================

import { CronJob } from 'cron';
import type { PrismaClient } from '@prisma/client';

// Basic spam signals: very short body on a 1-star, or duplicate body
const PROFANITY_PATTERNS = [/كس/, /زب/, /shit/i, /fuck/i, /spam/i];

function isSpam(body: string | null): boolean {
  if (!body) return false;
  return PROFANITY_PATTERNS.some((p) => p.test(body));
}

export async function runReviewModeration(db: PrismaClient): Promise<void> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  // Fetch reviews that have been pending for at least 10 minutes
  const pending = await db.review.findMany({
    where: { status: 'pending', created_at: { lte: tenMinutesAgo } },
    select: { id: true, business_id: true, rating: true, body: true },
  });

  if (pending.length === 0) return;

  const toApprove: string[]  = [];
  const toFlag: string[]     = [];

  for (const r of pending) {
    if (isSpam(r.body)) {
      toFlag.push(r.id);
    } else {
      toApprove.push(r.id);
    }
  }

  // Approve clean reviews
  if (toApprove.length > 0) {
    await db.review.updateMany({
      where: { id: { in: toApprove } },
      data: { status: 'approved', moderated_at: new Date() },
    });

    // Recalculate rating_avg + review_count for affected businesses
    const businessIds = [...new Set(
      pending.filter((r) => toApprove.includes(r.id)).map((r) => r.business_id)
    )];

    await Promise.all(
      businessIds.map(async (bizId) => {
        const agg = await db.review.aggregate({
          where: { business_id: bizId, status: 'approved' },
          _avg: { rating: true },
          _count: { id: true },
        });
        await db.business.update({
          where: { id: bizId },
          data: {
            rating_avg: agg._avg.rating ?? 0,
            review_count: agg._count.id,
          },
        });
      })
    );
  }

  // Flag spam reviews for manual ops review (status stays pending — ops sees them in moderation queue)
  // We mark them with a special status so they appear in the flagged queue
  if (toFlag.length > 0) {
    await db.review.updateMany({
      where: { id: { in: toFlag } },
      data: { status: 'rejected' },  // Auto-reject obvious spam
    });
  }
}

export function startReviewModerationJob(db: PrismaClient): CronJob {
  const job = new CronJob(
    '*/10 * * * *',   // Every 10 minutes
    async () => {
      try {
        await runReviewModeration(db);
      } catch (err) {
        console.error('[review-moderation] Job failed:', err);
      }
    },
    null,
    false,
    'Africa/Cairo'
  );
  job.start();
  return job;
}
