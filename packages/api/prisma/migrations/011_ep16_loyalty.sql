-- ============================================================
-- EP-16: Multi-Category Loyalty Program
-- US-107: Tiers enum, expiry + description on loyalty_points,
--         redemption fields on bookings
-- ============================================================

-- 1. Extend LoyaltyTransactionType enum
ALTER TYPE "LoyaltyTransactionType" ADD VALUE IF NOT EXISTS 'expire';

-- 2. Add LoyaltyTier enum
DO $$ BEGIN
  CREATE TYPE "LoyaltyTier" AS ENUM ('bronze', 'silver', 'gold', 'platinum');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. User: add loyalty_tier column
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS loyalty_tier "LoyaltyTier" NOT NULL DEFAULT 'bronze';

-- 4. Loyalty points: allow nullable booking_id, add expiry + description
ALTER TABLE loyalty_points
  ALTER COLUMN booking_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS description_ar  VARCHAR(200),
  ADD COLUMN IF NOT EXISTS expires_at      TIMESTAMPTZ;

-- 5. Index for expiry cron job
CREATE INDEX IF NOT EXISTS idx_loyalty_points_expires_at
  ON loyalty_points (expires_at)
  WHERE expires_at IS NOT NULL;

-- 6. Bookings: loyalty redemption tracking
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS redeemed_points     INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_discount_egp NUMERIC(10,2) NOT NULL DEFAULT 0;
