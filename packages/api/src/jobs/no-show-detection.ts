// ============================================================
// SUPER RESERVATION PLATFORM — No-Show Detection Job
// Runs every 15 minutes via cron.
// Marks confirmed bookings as NO_SHOW if:
//   - 30+ minutes have elapsed past start_time
//   - Business has NOT marked the booking as completed
// ============================================================

import { CronJob } from 'cron';
import type { PrismaClient } from '@prisma/client';
import { markNoShow } from '../services/booking-engine.js';
import { sendNoShowNotifications, scheduleReviewPrompt } from '../services/notification.js';
import { executeNoShowSplit } from '../services/payment.js';
import { env } from '../config/env.js';

export function startNoShowDetectionJob(db: PrismaClient): CronJob {
  const job = new CronJob(
    '*/15 * * * *',   // Every 15 minutes
    async () => {
      await runNoShowDetection(db);
    },
    null,
    true,            // Start immediately
    'Africa/Cairo'
  );

  console.log('✅ No-show detection job started (every 15 min, Africa/Cairo timezone)');
  return job;
}

async function runNoShowDetection(db: PrismaClient): Promise<void> {
  const delayMs = env.NO_SHOW_DETECTION_DELAY_MINUTES * 60 * 1000;
  const cutoffTime = new Date(Date.now() - delayMs);

  // Find all confirmed bookings where start_time was > 30 min ago
  // and no_show_detected_at has not yet been set
  const candidateBookings = await db.booking.findMany({
    where: {
      status: 'confirmed',
      no_show_detected_at: null,
      slot: {
        start_time: { lt: cutoffTime },
      },
    },
    include: {
      slot: true,
    },
  });

  if (candidateBookings.length === 0) return;

  console.log(`[no-show-detection] Processing ${candidateBookings.length} candidate booking(s)`);

  for (const booking of candidateBookings) {
    try {
      // 1. Mark no-show + increment consumer no_show_count
      await markNoShow(db, booking.id);

      // 2. Check if deposit_mandatory should be set
      const updatedUser = await db.user.findUniqueOrThrow({
        where: { id: booking.consumer_id },
      });
      if (updatedUser.no_show_count >= 3 && !updatedUser.deposit_mandatory) {
        await db.user.update({
          where: { id: booking.consumer_id },
          data: { deposit_mandatory: true },
        });
      }

      // 3. Execute 75/25 deposit split
      await executeNoShowSplit(db, booking.id);

      // 4. Send consumer WhatsApp alert + business push
      await sendNoShowNotifications(db, booking.id);

      console.log(`[no-show-detection] Processed booking ${booking.booking_ref}`);
    } catch (err) {
      console.error(`[no-show-detection] Failed for booking ${booking.booking_ref}:`, err);
      // Continue to next booking — do not let one failure block others
    }
  }
}

// ── Expire Pending-Payment Bookings (slot hold timer) ────────

export function startSlotHoldExpiryJob(db: PrismaClient): CronJob {
  const job = new CronJob(
    '* * * * *',  // Every 1 minute
    async () => {
      const cutoff = new Date(Date.now() - (env.SLOT_HOLD_TTL_SECONDS + 60) * 1000);

      await db.booking.updateMany({
        where: {
          status: 'pending_payment',
          created_at: { lt: cutoff },
        },
        data: { status: 'expired' },
      });
    },
    null,
    true,
    'Africa/Cairo'
  );

  console.log('✅ Slot hold expiry job started (every 1 min)');
  return job;
}
