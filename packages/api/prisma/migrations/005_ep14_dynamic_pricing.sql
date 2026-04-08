-- EP-14: Dynamic Pricing Engine
-- US-101: Pricing rules schema
-- US-102: Booking pricing fields

CREATE TYPE "PricingRuleType" AS ENUM ('surge', 'last_minute', 'demand');

CREATE TABLE IF NOT EXISTS pricing_rules (
  id             UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID            NOT NULL REFERENCES businesses(id),
  rule_type      "PricingRuleType" NOT NULL,
  name_ar        VARCHAR(100)    NOT NULL,
  -- surge / demand
  multiplier     NUMERIC(4,2),           -- e.g. 1.50
  max_multiplier NUMERIC(4,2),           -- demand cap
  -- time-of-week (surge)
  days_of_week   INT[]           NOT NULL DEFAULT '{}',
  hour_start     SMALLINT,               -- 0–23
  hour_end       SMALLINT,               -- 0–23 exclusive
  -- last-minute
  minutes_before SMALLINT,               -- discount if slot within N min
  discount_pct   NUMERIC(5,2),           -- e.g. 20.00 = 20% off
  -- demand opt-in
  fill_rate_pct  SMALLINT,               -- trigger at X% full (70|90)
  is_active      BOOLEAN         NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_biz ON pricing_rules (business_id, is_active);

-- EP-14: attach pricing audit columns to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS pricing_rule_id      UUID REFERENCES pricing_rules(id),
  ADD COLUMN IF NOT EXISTS effective_multiplier  NUMERIC(4,2);

CREATE INDEX IF NOT EXISTS idx_bookings_pricing ON bookings (pricing_rule_id) WHERE pricing_rule_id IS NOT NULL;
