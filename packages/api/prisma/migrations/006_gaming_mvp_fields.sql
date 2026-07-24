-- ============================================================
-- Migration 006: Gaming MVP fields
-- Adds GamingConfig table + gaming-specific Booking fields
-- ============================================================

-- TABLE: gaming_configs
CREATE TABLE IF NOT EXISTS "gaming_configs" (
  "id"                        UUID          NOT NULL DEFAULT gen_random_uuid(),
  "business_id"               UUID          NOT NULL UNIQUE,
  "station_types"             TEXT[]        NOT NULL DEFAULT '{}',
  "has_group_rooms"           BOOLEAN       NOT NULL DEFAULT false,
  "group_room_capacity"       SMALLINT      NOT NULL DEFAULT 4,
  "min_players_group_room"    SMALLINT      NOT NULL DEFAULT 1,
  "genre_options"             TEXT[]        NOT NULL DEFAULT '{}',
  "slot_duration_options"     INTEGER[]     NOT NULL DEFAULT '{60,120,180}',
  "default_slot_duration_min" SMALLINT      NOT NULL DEFAULT 60,
  "created_at"                TIMESTAMPTZ   NOT NULL DEFAULT now(),
  "updated_at"                TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT "gaming_configs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "gaming_configs_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE
);

-- Gaming-specific fields on bookings
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "station_type"           VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "genre_preference"       VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "session_duration_min"   SMALLINT,
  ADD COLUMN IF NOT EXISTS "is_group_room"          BOOLEAN NOT NULL DEFAULT false;

-- Index for gaming analytics queries
CREATE INDEX IF NOT EXISTS "bookings_business_station_type_idx"
  ON "bookings"("business_id", "station_type");
