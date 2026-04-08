// ============================================================
// SUPER RESERVATION PLATFORM — Loyalty Points Expiry Cron (EP-16)
// US-113: Runs daily at 02:00 Africa/Cairo.
//         Expires any earn-points older than 18 months.
// ============================================================

import { CronJob } from 'cron';
import type { PrismaClient } from '@prisma/client';
import { expireOldPoints } from '../services/loyalty.js';

export function startLoyaltyExpiryJob(db: PrismaClient): CronJob {
  const job = new CronJob(
    '0 2 * * *', // daily at 02:00
    async () => {
      try {
        const expired = await expireOldPoints(db);
        if (expired > 0) {
          console.log(`[loyalty-expiry] Expired ${expired} point record(s).`);
        }
      } catch (err) {
        console.error('[loyalty-expiry] Job failed:', err);
      }
    },
    null,
    true,
    'Africa/Cairo'
  );

  return job;
}
