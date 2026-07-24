// ============================================================
// SUPER RESERVATION PLATFORM — Daily Payout Job (US-036)
// Runs at 23:00 Africa/Cairo every day.
// Batches all pending deposit payouts by business, calls
// Paymob disbursement API, updates payment records.
// Failed payouts trigger WhatsApp alert to business owner.
// ============================================================

import { CronJob } from 'cron';
import type { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { env } from '../config/env.js';
import { sendPayoutFailedAlert } from '../services/notification.js';

export function startDailyPayoutJob(db: PrismaClient): CronJob {
  const job = new CronJob(
    '0 23 * * *',  // 23:00 every day
    async () => {
      await runDailyPayouts(db);
    },
    null,
    true,
    'Africa/Cairo'
  );

  console.log('✅ Daily payout job started (23:00 Africa/Cairo)');
  return job;
}

async function runDailyPayouts(db: PrismaClient): Promise<void> {
  // Find all pending deposit payout records (created on booking completion)
  const pendingPayouts = await db.payment.findMany({
    where: {
      type: 'deposit',
      direction: 'outbound',
      status: 'pending',
      recipient_type: 'business',
    },
    include: {
      booking: {
        include: {
          business: {
            select: {
              id: true,
              name_ar: true,
              payout_method: true,
              payout_threshold_egp: true,
            },
          },
        },
      },
    },
  });

  if (pendingPayouts.length === 0) {
    console.log('[payout-job] No pending payouts today');
    return;
  }

  // Group by business
  const byBusiness = new Map<string, typeof pendingPayouts>();
  for (const payout of pendingPayouts) {
    const bizId = payout.booking.business_id;
    if (!byBusiness.has(bizId)) byBusiness.set(bizId, []);
    byBusiness.get(bizId)!.push(payout);
  }

  console.log(`[payout-job] Processing payouts for ${byBusiness.size} business(es)`);

  const token = await getPaymobAuthToken();

  for (const [businessId, payouts] of byBusiness.entries()) {
    const business = payouts[0]!.booking.business;
    const totalAmount = payouts.reduce((sum, p) => sum + Number(p.amount), 0);
    const paymentIds = payouts.map((p) => p.id);
    const threshold = Number(business.payout_threshold_egp);

    // US-036: Skip if below threshold — amounts accumulate to next batch
    if (totalAmount < threshold) {
      console.log(`[payout-job] ${business.name_ar}: EGP ${totalAmount} below threshold ${threshold} — deferring`);
      continue;
    }

    // H3: Atomically CLAIM these rows BEFORE disbursing, so a second concurrent
    // runner (or a retry after a mid-flight crash) can't disburse the same
    // payouts twice. Flip pending→completed first; only the runner that wins
    // the claim performs the Paymob HTTP disbursement.
    const claimedAt = new Date();
    const claim = await db.payment.updateMany({
      where: { id: { in: paymentIds }, status: 'pending' },
      data: { status: 'completed', settled_at: claimedAt },
    });

    if (claim.count === 0) {
      // Another runner already claimed these rows — skip.
      console.log(`[payout-job] ${business.name_ar}: payouts already claimed by another runner — skipping`);
      continue;
    }

    if (claim.count !== paymentIds.length) {
      // Partial claim — a concurrent runner grabbed some of these rows between
      // findMany and now. Release only the rows WE just claimed (matched by
      // settled_at) and skip; the next scheduled run retries cleanly.
      await db.payment.updateMany({
        where: { id: { in: paymentIds }, status: 'completed', settled_at: claimedAt },
        data: { status: 'pending', settled_at: null },
      });
      console.log(`[payout-job] ${business.name_ar}: partial claim (${claim.count}/${paymentIds.length}) — reverted and skipping`);
      continue;
    }

    try {
      await disburseToBusiness(token, businessId, totalAmount, paymentIds);

      console.log(`[payout-job] ✅ Disbursed EGP ${totalAmount} to ${business.name_ar}`);
    } catch (err) {
      console.error(`[payout-job] ❌ Payout failed for ${business.name_ar}:`, err);

      // H3: Disbursement failed — release our claim (revert to pending,
      // settled_at null) so the next scheduled run retries these payouts.
      await db.payment.updateMany({
        where: { id: { in: paymentIds }, settled_at: claimedAt },
        data: { status: 'pending', settled_at: null },
      });

      // US-036: Failed payout → WhatsApp alert to business owner
      await sendPayoutFailedAlert(db, businessId, totalAmount).catch((notifErr) =>
        console.error('[payout-job] Failed to send payout alert:', notifErr)
      );
    }
  }
}

// ── Paymob Disbursement ───────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getPaymobAuthToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  const res = await axios.post(`${env.PAYMOB_BASE_URL}/auth/tokens`, {
    api_key: env.PAYMOB_API_KEY,
  });
  cachedToken = { token: res.data.token as string, expiresAt: Date.now() + 50 * 60 * 1000 };
  return cachedToken.token;
}

async function disburseToBusiness(
  authToken: string,
  businessId: string,
  amountEgp: number,
  paymentIds: string[]
): Promise<void> {
  // Paymob disbursement API — sends to the business's linked wallet/bank
  await axios.post(
    `${env.PAYMOB_BASE_URL}/disbursement/disburse`,
    {
      auth_token: authToken,
      receiver_id: businessId,  // Business's Paymob sub-account ID (set during onboarding)
      amount_cents: Math.round(amountEgp * 100),
      currency: 'EGP',
      description: `Reservr payout — ${paymentIds.length} booking(s)`,
      merchant_order_id: `PAYOUT-${businessId.slice(0, 8)}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
    }
  );
}
