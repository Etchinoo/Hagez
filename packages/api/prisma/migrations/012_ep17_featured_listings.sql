-- ============================================================
-- EP-17: Featured Listings & Marketplace
-- US-115: FeaturedPlan + FeaturedListingStatus enums,
--         featured_listings table, index on businesses
-- ============================================================

-- 1. FeaturedPlan enum
DO $$ BEGIN
  CREATE TYPE "FeaturedPlan" AS ENUM ('starter_7', 'growth_14', 'pro_30');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. FeaturedListingStatus enum
DO $$ BEGIN
  CREATE TYPE "FeaturedListingStatus" AS ENUM (
    'pending_payment', 'active', 'expired', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. featured_listings table
CREATE TABLE IF NOT EXISTS featured_listings (
  id                     UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id            UUID        NOT NULL REFERENCES businesses(id),
  plan                   "FeaturedPlan"        NOT NULL,
  status                 "FeaturedListingStatus" NOT NULL DEFAULT 'pending_payment',
  price_egp              NUMERIC(10,2)         NOT NULL,
  starts_at              TIMESTAMPTZ,
  ends_at                TIMESTAMPTZ,
  paymob_order_id        VARCHAR(100),
  paymob_transaction_id  VARCHAR(100),
  approved_by_admin_id   UUID,
  notes                  VARCHAR(500),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_featured_listings_business_id
  ON featured_listings (business_id);

CREATE INDEX IF NOT EXISTS idx_featured_listings_status_ends_at
  ON featured_listings (status, ends_at)
  WHERE status = 'active';

-- 4. Composite index on businesses for featured queries
CREATE INDEX IF NOT EXISTS idx_businesses_featured
  ON businesses (is_featured, featured_until)
  WHERE is_featured = TRUE;
