// ============================================================
// SUPER RESERVATION PLATFORM — Loyalty Service (EP-16)
// US-108: Earn points on booking confirmation (1 EGP = 1 pt)
// US-109: Redeem points at checkout  (100 pts = 5 EGP)
// US-113: Expire points 18 months after earn
//
// Tier thresholds (cumulative lifetime earned):
//   Bronze  0–499 pts
//   Silver  500–1 999 pts
//   Gold    2 000–4 999 pts
//   Platinum ≥ 5 000 pts
// ============================================================

import type { PrismaClient } from '@prisma/client';

// ── Constants ────────────────────────────────────────────────

export const POINTS_PER_EGP    = 1;       // 1 EGP deposit paid = 1 point
export const POINTS_TO_EGP     = 0.05;    // 1 point = 0.05 EGP (100 pts = 5 EGP)
export const MIN_REDEEM_POINTS  = 100;     // minimum redemption block
export const EXPIRY_MONTHS      = 18;      // points expire after 18 months

export const TIER_THRESHOLDS = {
  bronze:   0,
  silver:   500,
  gold:     2_000,
  platinum: 5_000,
} as const;

type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

// ── Tier resolver ─────────────────────────────────────────────

export function resolveTier(balance: number): LoyaltyTier {
  if (balance >= TIER_THRESHOLDS.platinum) return 'platinum';
  if (balance >= TIER_THRESHOLDS.gold)     return 'gold';
  if (balance >= TIER_THRESHOLDS.silver)   return 'silver';
  return 'bronze';
}

export function nextTier(current: LoyaltyTier): LoyaltyTier | null {
  if (current === 'platinum') return null;
  if (current === 'gold')     return 'platinum';
  if (current === 'silver')   return 'gold';
  return 'silver';
}

export function pointsToNextTier(balance: number): number | null {
  const tier = resolveTier(balance);
  const next = nextTier(tier);
  if (!next) return null;
  return TIER_THRESHOLDS[next] - balance;
}

// ── US-108: Earn points on booking confirmation ───────────────
// Called from booking engine after payment is confirmed.
// Earns floor(deposit_egp * POINTS_PER_EGP) points.

export async function earnPoints(
  db: PrismaClient,
  userId: string,
  bookingId: string,
  depositEgp: number,
  categoryAr: string
): Promise<void> {
  const pts = Math.floor(depositEgp * POINTS_PER_EGP);
  if (pts <= 0) return;

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + EXPIRY_MONTHS);

  await db.$transaction(async (tx) => {
    await tx.loyaltyPoint.create({
      data: {
        user_id:          userId,
        booking_id:       bookingId,
        points:           pts,
        transaction_type: 'earn',
        description_ar:   `كسبت ${pts} نقطة من حجز ${categoryAr}`,
        expires_at:       expiresAt,
      },
    });

    // Update balance + recompute tier atomically
    const updated = await tx.user.update({
      where:  { id: userId },
      data:   { loyalty_balance: { increment: pts } },
      select: { loyalty_balance: true },
    });

    const newTier = resolveTier(updated.loyalty_balance);
    await tx.user.update({
      where: { id: userId },
      data:  { loyalty_tier: newTier },
    });
  });
}

// ── US-109: Validate redemption before checkout ───────────────
// Returns the EGP discount and points to burn, or throws.

export function calcRedemption(
  currentBalance: number,
  requestedPoints: number,
  depositEgp: number
): { pointsToBurn: number; discountEgp: number } {
  if (requestedPoints < MIN_REDEEM_POINTS) {
    throw new Error(`الحد الأدنى للاسترداد ${MIN_REDEEM_POINTS} نقطة`);
  }
  if (requestedPoints > currentBalance) {
    throw new Error('رصيد النقاط غير كافٍ');
  }

  const rawDiscount = requestedPoints * POINTS_TO_EGP;
  // Can't discount more than the deposit itself
  const discountEgp = Math.min(rawDiscount, depositEgp);
  const pointsToBurn = Math.ceil(discountEgp / POINTS_TO_EGP);

  return { pointsToBurn, discountEgp: Math.round(discountEgp * 100) / 100 };
}

// ── US-109: Redeem points — called inside booking transaction ─

export async function redeemPoints(
  db: PrismaClient,
  userId: string,
  bookingId: string,
  pointsToBurn: number
): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.loyaltyPoint.create({
      data: {
        user_id:          userId,
        booking_id:       bookingId,
        points:           -pointsToBurn,
        transaction_type: 'redeem',
        description_ar:   `استردادت ${pointsToBurn} نقطة عند الحجز`,
      },
    });

    const updated = await tx.user.update({
      where: { id: userId },
      data:  { loyalty_balance: { decrement: pointsToBurn } },
      select: { loyalty_balance: true },
    });

    const newTier = resolveTier(updated.loyalty_balance);
    await tx.user.update({
      where: { id: userId },
      data:  { loyalty_tier: newTier },
    });
  });
}

// ── US-113: Expire stale points (called by cron) ─────────────
// Finds expired unused earn-points, subtracts from balances.

export async function expireOldPoints(db: PrismaClient): Promise<number> {
  const now = new Date();

  const expired = await db.loyaltyPoint.findMany({
    where: {
      transaction_type: 'earn',
      expires_at:       { lte: now },
      points:           { gt: 0 },
      // Proxy "not already expired" — check if a paired expiry entry exists
      // Simplification: mark by setting points to 0 after processing below
    },
    select: { id: true, user_id: true, points: true },
  });

  if (expired.length === 0) return 0;

  let processed = 0;
  for (const row of expired) {
    await db.$transaction(async (tx) => {
      // Zero out the original earn row to prevent double-expiry
      await tx.loyaltyPoint.update({
        where: { id: row.id },
        data:  { points: 0 },
      });

      // Record expiry transaction
      await tx.loyaltyPoint.create({
        data: {
          user_id:          row.user_id,
          points:           -row.points,
          transaction_type: 'expire',
          description_ar:   `انتهت صلاحية ${row.points} نقطة`,
        },
      });

      const updated = await tx.user.update({
        where: { id: row.user_id },
        data:  { loyalty_balance: { decrement: row.points } },
        select: { loyalty_balance: true },
      });

      const newBalance = Math.max(0, updated.loyalty_balance);
      const newTier    = resolveTier(newBalance);
      await tx.user.update({
        where: { id: row.user_id },
        data:  { loyalty_balance: newBalance, loyalty_tier: newTier },
      });
    });
    processed++;
  }

  return processed;
}

// ── Loyalty summary (for API + dashboard) ────────────────────

export function buildLoyaltySummary(user: {
  loyalty_balance: number;
  loyalty_tier: LoyaltyTier;
}) {
  const tier    = resolveTier(user.loyalty_balance);
  const next    = nextTier(tier);
  const toNext  = pointsToNextTier(user.loyalty_balance);

  return {
    balance:             user.loyalty_balance,
    tier,
    next_tier:           next,
    points_to_next_tier: toNext,
    progress_pct: next
      ? Math.round(
          ((user.loyalty_balance - TIER_THRESHOLDS[tier]) /
            (TIER_THRESHOLDS[next] - TIER_THRESHOLDS[tier])) *
            100
        )
      : 100,
    redemption_value_egp: Math.floor(user.loyalty_balance / MIN_REDEEM_POINTS) * (MIN_REDEEM_POINTS * POINTS_TO_EGP),
    tier_thresholds: TIER_THRESHOLDS,
  };
}
