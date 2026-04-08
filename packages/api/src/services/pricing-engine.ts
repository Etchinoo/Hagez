// ============================================================
// SUPER RESERVATION PLATFORM — Dynamic Pricing Engine (EP-14)
// US-102: Applies surge, last-minute, and demand-based rules
//         to compute an effective price multiplier for a slot.
//
// Call order in booking-engine.ts:
//   1. applyPricingRules(db, businessId, slot) → { multiplier, ruleId }
//   2. effectiveDeposit = slot.deposit_amount × multiplier
//   3. Store pricing_rule_id + effective_multiplier on booking
// ============================================================

import type { PrismaClient, PricingRule } from '@prisma/client';

export interface PricingResult {
  multiplier: number;          // 1.0 = no change, 1.5 = 50% surge, 0.8 = 20% off
  effective_deposit: number;   // base × multiplier (rounded to 2 dp)
  pricing_rule_id: string | null;
  rule_type: string | null;
  badge: 'surge' | 'discount' | 'demand' | null;
  badge_ar: string | null;
}

// ── US-102: Main pricing resolver ───────────────────────────

export async function applyPricingRules(
  db: PrismaClient,
  businessId: string,
  slotStartTime: Date,
  baseDeposit: number,
  slotBookedCount: number,
  slotCapacity: number
): Promise<PricingResult> {
  const rules = await db.pricingRule.findMany({
    where: { business_id: businessId, is_active: true },
    orderBy: { created_at: 'asc' },
  });

  if (rules.length === 0) {
    return noChange(baseDeposit);
  }

  const cairoNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  const slotCairo = new Date(slotStartTime.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  const minutesUntilSlot = Math.floor((slotStartTime.getTime() - Date.now()) / 60_000);
  const fillRate = slotCapacity > 0 ? Math.round((slotBookedCount / slotCapacity) * 100) : 0;
  const slotDayOfWeek = slotCairo.getDay(); // 0=Sun
  const slotHour = slotCairo.getHours();

  // Priority: surge > last_minute > demand
  // Surge takes precedence if multiple rules match; pick highest multiplier.

  let bestSurge: { rule: PricingRule; multiplier: number } | null = null;
  let bestDiscount: { rule: PricingRule; discountPct: number } | null = null;
  let bestDemand: { rule: PricingRule; multiplier: number } | null = null;

  for (const rule of rules) {
    if (rule.rule_type === 'surge') {
      // Check day-of-week and hour window
      const dayMatch =
        rule.days_of_week.length === 0 ||
        rule.days_of_week.includes(slotDayOfWeek);
      const hourStart = rule.hour_start ?? 0;
      const hourEnd = rule.hour_end ?? 24;
      const hourMatch = slotHour >= hourStart && slotHour < hourEnd;

      if (dayMatch && hourMatch && rule.multiplier !== null) {
        const m = Number(rule.multiplier);
        if (!bestSurge || m > bestSurge.multiplier) {
          bestSurge = { rule, multiplier: m };
        }
      }
    } else if (rule.rule_type === 'last_minute') {
      // Only if slot is in the future
      if (minutesUntilSlot > 0 &&
          rule.minutes_before !== null &&
          minutesUntilSlot <= rule.minutes_before &&
          rule.discount_pct !== null) {
        const pct = Number(rule.discount_pct);
        if (!bestDiscount || pct > bestDiscount.discountPct) {
          bestDiscount = { rule, discountPct: pct };
        }
      }
    } else if (rule.rule_type === 'demand') {
      // US-105: demand-based auto-pricing
      const threshold = rule.fill_rate_pct ?? 70;
      if (fillRate >= threshold && rule.multiplier !== null) {
        const raw = Number(rule.multiplier);
        const cap = rule.max_multiplier !== null ? Number(rule.max_multiplier) : raw;
        // Scale: linearly between threshold and 100% → multiplier..cap
        const scaledMultiplier = fillRate >= 90
          ? cap
          : raw + ((cap - raw) * (fillRate - threshold)) / (100 - threshold);
        const m = Math.min(Math.round(scaledMultiplier * 100) / 100, cap);
        if (!bestDemand || m > bestDemand.multiplier) {
          bestDemand = { rule, multiplier: m };
        }
      }
    }
  }

  // Resolution: surge > demand > last_minute (highest surcharge wins)
  // If surge applies, skip discounts.
  if (bestSurge) {
    const m = bestSurge.multiplier;
    return {
      multiplier: m,
      effective_deposit: round2(baseDeposit * m),
      pricing_rule_id: bestSurge.rule.id,
      rule_type: 'surge',
      badge: 'surge',
      badge_ar: 'سعر الذروة 🔴',
    };
  }

  if (bestDemand) {
    const m = bestDemand.multiplier;
    return {
      multiplier: m,
      effective_deposit: round2(baseDeposit * m),
      pricing_rule_id: bestDemand.rule.id,
      rule_type: 'demand',
      badge: 'demand',
      badge_ar: `طلب مرتفع — ${Math.round((m - 1) * 100)}%+ 📈`,
    };
  }

  if (bestDiscount) {
    const m = round2(1 - bestDiscount.discountPct / 100);
    return {
      multiplier: m,
      effective_deposit: round2(baseDeposit * m),
      pricing_rule_id: bestDiscount.rule.id,
      rule_type: 'last_minute',
      badge: 'discount',
      badge_ar: `خصم اللحظة الأخيرة ${bestDiscount.discountPct}%‏ 🟢`,
    };
  }

  return noChange(baseDeposit);
}

// ── US-105: Batch apply demand rules to multiple slots ───────
// Called from slot listing endpoint to annotate each slot's price.

export async function annotateSlotPrices(
  db: PrismaClient,
  businessId: string,
  slots: Array<{
    id: string;
    start_time: Date;
    deposit_amount: unknown;
    booked_count: number;
    capacity: number;
  }>
): Promise<Map<string, PricingResult>> {
  // Load rules once, apply per slot
  const rules = await db.pricingRule.findMany({
    where: { business_id: businessId, is_active: true },
  });

  if (rules.length === 0) {
    const map = new Map<string, PricingResult>();
    for (const s of slots) {
      map.set(s.id, noChange(Number(s.deposit_amount)));
    }
    return map;
  }

  const map = new Map<string, PricingResult>();
  for (const slot of slots) {
    const result = await applyPricingRules(
      db,
      businessId,
      slot.start_time,
      Number(slot.deposit_amount),
      slot.booked_count,
      slot.capacity
    );
    map.set(slot.id, result);
  }
  return map;
}

// ── US-106: Pricing analytics helpers ───────────────────────

export async function getPricingAnalytics(
  db: PrismaClient,
  businessId: string,
  since: Date
) {
  const pricedBookings = await db.booking.findMany({
    where: {
      business_id: businessId,
      created_at: { gte: since },
      pricing_rule_id: { not: null },
      status: { notIn: ['expired', 'pending_payment', 'cancelled_by_consumer', 'cancelled_by_business'] },
    },
    select: {
      deposit_amount: true,
      effective_multiplier: true,
      pricing_rule: { select: { rule_type: true, name_ar: true } },
    },
  });

  const total = pricedBookings.length;
  const surgeBookings = pricedBookings.filter((b) => b.pricing_rule?.rule_type === 'surge');
  const discountBookings = pricedBookings.filter((b) => b.pricing_rule?.rule_type === 'last_minute');
  const demandBookings = pricedBookings.filter((b) => b.pricing_rule?.rule_type === 'demand');

  const avgMultiplier = total > 0
    ? round2(pricedBookings.reduce((s, b) => s + Number(b.effective_multiplier ?? 1), 0) / total)
    : 1;

  // Revenue uplift = Σ (effective_deposit - base_deposit) for surges
  const revenueUplift = surgeBookings.reduce((sum, b) => {
    const base = Number(b.deposit_amount);
    const mult = Number(b.effective_multiplier ?? 1);
    return sum + (base * mult - base);
  }, 0);

  // Discount-driven bookings (last-minute)
  const discountRevenue = discountBookings.reduce(
    (s, b) => s + Number(b.deposit_amount) * Number(b.effective_multiplier ?? 1),
    0
  );

  return {
    total_priced_bookings: total,
    surge_bookings: surgeBookings.length,
    discount_bookings: discountBookings.length,
    demand_bookings: demandBookings.length,
    avg_multiplier: avgMultiplier,
    revenue_uplift_egp: round2(revenueUplift),
    discount_revenue_egp: round2(discountRevenue),
  };
}

// ── Helpers ──────────────────────────────────────────────────

function noChange(baseDeposit: number): PricingResult {
  return {
    multiplier: 1.0,
    effective_deposit: baseDeposit,
    pricing_rule_id: null,
    rule_type: null,
    badge: null,
    badge_ar: null,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
