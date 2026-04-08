// ============================================================
// SUPER RESERVATION PLATFORM — PII Purge Cron (EP-19, US-084)
// PDPL 2020 data minimisation principle.
// Runs monthly on the 1st at 02:00 Africa/Cairo.
// Nulls PII fields on bookings older than 24 months.
// Retains: booking_id, amounts, dates, status, category.
// Logs to audit_logs for compliance trail.
// Job is idempotent — safe to re-run.
// ============================================================

import { CronJob } from 'cron';
import type { PrismaClient } from '@prisma/client';

const RETENTION_MONTHS = 24;

export function startPiiPurgeJob(db: PrismaClient): CronJob {
  const job = new CronJob(
    '0 2 1 * *', // 1st of every month at 02:00
    async () => {
      const runStart = new Date();
      console.log(`[pii-purge] Starting PII purge run at ${runStart.toISOString()}`);

      try {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - RETENTION_MONTHS);

        // Target: bookings that ended (completed/cancelled/no_show) before the cutoff
        // AND still have PII data (special_requests not null)
        const result = await db.booking.updateMany({
          where: {
            special_requests: { not: null },
            OR: [
              { status: 'completed',                created_at: { lt: cutoffDate } },
              { status: 'no_show',                  created_at: { lt: cutoffDate } },
              { status: 'cancelled_by_consumer',    created_at: { lt: cutoffDate } },
              { status: 'cancelled_by_business',    created_at: { lt: cutoffDate } },
            ],
          },
          data: { special_requests: null },
        });

        // Also null consumer_phone on manual/walk-in bookings (stored in special_requests field)
        // and expired bookings older than cutoff
        const expiredResult = await db.booking.updateMany({
          where: {
            status:           'expired',
            special_requests: { not: null },
            created_at:       { lt: cutoffDate },
          },
          data: { special_requests: null },
        });

        const totalPurged = result.count + expiredResult.count;

        // Write audit log
        await db.auditLog.create({
          data: {
            actor_id:    null,
            actor_type:  'system',
            action:      'pii_purge',
            target_type: 'booking',
            metadata: {
              records_processed:    totalPurged,
              fields_nulled:        ['special_requests'],
              cutoff_date:          cutoffDate.toISOString(),
              retention_months:     RETENTION_MONTHS,
              run_timestamp:        runStart.toISOString(),
              completed_timestamp:  new Date().toISOString(),
            },
          },
        });

        console.log(`[pii-purge] Done — ${totalPurged} booking(s) purged.`);
      } catch (err) {
        console.error('[pii-purge] Job failed:', err);

        // Log failure to audit trail
        await db.auditLog.create({
          data: {
            actor_type: 'system',
            action:     'pii_purge_failed',
            metadata:   { error: String(err), run_timestamp: runStart.toISOString() },
          },
        }).catch(() => {}); // best-effort
      }
    },
    null,
    true,
    'Africa/Cairo'
  );

  return job;
}
