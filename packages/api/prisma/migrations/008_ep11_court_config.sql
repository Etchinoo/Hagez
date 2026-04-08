-- ============================================================
-- Migration 008 — EP-11: Sports Court Booking
-- Adds: court_configs table, sport_type + equipment_rental
--       columns on bookings
-- ============================================================

-- TABLE: court_configs (US-087)
CREATE TABLE court_configs (
  id                              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id                     UUID        NOT NULL UNIQUE,
  sport_types                     TEXT[]      NOT NULL DEFAULT '{}',
  court_type                      VARCHAR(20) NOT NULL DEFAULT 'outdoor',
  surface_type                    VARCHAR(30),
  has_lighting                    BOOLEAN     NOT NULL DEFAULT FALSE,
  equipment_available             TEXT[]      NOT NULL DEFAULT '{}',
  slot_duration_options           INTEGER[]   NOT NULL DEFAULT '{60}',
  default_slot_duration_minutes   SMALLINT    NOT NULL DEFAULT 60,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_court_config_business
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- INDEX: fast lookup by business
CREATE INDEX idx_court_configs_business ON court_configs(business_id);

-- TRIGGER: keep updated_at current
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_court_configs_updated_at
  BEFORE UPDATE ON court_configs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- COLUMNS: court-specific booking metadata (US-082, US-084)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS sport_type       VARCHAR(30),
  ADD COLUMN IF NOT EXISTS equipment_rental TEXT[]  NOT NULL DEFAULT '{}';
