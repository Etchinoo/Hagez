-- ============================================================
-- Migration 009 — EP-12: Gaming Cafe Booking
-- Adds: gaming_configs table, station_type + genre_preference
--       columns on bookings
-- ============================================================

-- TABLE: gaming_configs (US-094)
CREATE TABLE gaming_configs (
  id                              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id                     UUID        NOT NULL UNIQUE,
  station_types                   TEXT[]      NOT NULL DEFAULT '{}',
  has_group_rooms                 BOOLEAN     NOT NULL DEFAULT FALSE,
  group_room_capacity             SMALLINT    NOT NULL DEFAULT 6,
  genre_options                   TEXT[]      NOT NULL DEFAULT '{}',
  slot_duration_options           INTEGER[]   NOT NULL DEFAULT '{60}',
  default_slot_duration_minutes   SMALLINT    NOT NULL DEFAULT 60,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_gaming_config_business
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX idx_gaming_configs_business ON gaming_configs(business_id);

CREATE TRIGGER trg_gaming_configs_updated_at
  BEFORE UPDATE ON gaming_configs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- COLUMNS: gaming-specific booking metadata (US-090, US-092)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS station_type     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS genre_preference VARCHAR(20);
