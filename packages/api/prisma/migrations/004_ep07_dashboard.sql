-- EP-07: Business Dashboard
-- US-055: internal notes on bookings
-- US-057: staff management (uses existing resources table — no new table)
-- US-058: service menu
-- US-060: sections config

-- US-055: internal notes per booking (business-only, not shown to consumer)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS internal_notes VARCHAR(1000);

-- US-058: service menu
CREATE TABLE IF NOT EXISTS business_services (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID        NOT NULL REFERENCES businesses(id),
  name_ar      VARCHAR(200) NOT NULL,
  name_en      VARCHAR(200),
  price_egp    NUMERIC(10,2) NOT NULL,
  duration_min SMALLINT    NOT NULL,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_business_services_biz ON business_services (business_id, is_active);

-- US-060: sections config (restaurant indoor/outdoor/private)
CREATE TABLE IF NOT EXISTS business_sections (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID        NOT NULL REFERENCES businesses(id),
  name_ar      VARCHAR(100) NOT NULL,
  name_en      VARCHAR(100),
  capacity     SMALLINT    NOT NULL,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_business_sections_biz ON business_sections (business_id, is_active);
