-- ============================================================
-- EP-21: Vehicle Type Data Model (US-089)
-- Phase 2 — additive changes only; zero impact on Phase 1 bookings.
-- ============================================================

-- ── VehicleSizeClass enum ─────────────────────────────────────

CREATE TYPE "VehicleSizeClass" AS ENUM ('sedan', 'suv', 'pickup', 'van');

-- ── vehicle_types table ───────────────────────────────────────

CREATE TABLE vehicle_types (
  id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar     VARCHAR(50)      NOT NULL,
  name_en     VARCHAR(50)      NOT NULL,
  size_class  "VehicleSizeClass" NOT NULL,
  created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- ── Seed: 4 canonical vehicle types ──────────────────────────

INSERT INTO vehicle_types (name_ar, name_en, size_class) VALUES
  ('سيدان',    'Sedan',  'sedan'),
  ('دفع رباعي', 'SUV',   'suv'),
  ('بيك أب',   'Pickup', 'pickup'),
  ('ميكروباص', 'Van',    'van');

-- ── Extend car_wash_configs: per-vehicle pricing ──────────────
-- price_by_vehicle:    { sedan: 80, suv: 120, pickup: 130, van: 110 }
-- duration_by_vehicle: { sedan: 30, suv: 45,  pickup: 45,  van: 40  }

ALTER TABLE car_wash_configs
  ADD COLUMN IF NOT EXISTS price_by_vehicle    JSONB,
  ADD COLUMN IF NOT EXISTS duration_by_vehicle JSONB;

COMMENT ON COLUMN car_wash_configs.price_by_vehicle    IS 'Per-vehicle pricing override: {sedan, suv, pickup, van} → EGP';
COMMENT ON COLUMN car_wash_configs.duration_by_vehicle IS 'Per-vehicle duration override: {sedan, suv, pickup, van} → minutes';

-- ── bookings: add vehicle_type_id FK (nullable, Phase 2 only) ─

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS vehicle_type_id UUID REFERENCES vehicle_types(id) ON DELETE SET NULL;

CREATE INDEX idx_bookings_vehicle_type
  ON bookings (vehicle_type_id)
  WHERE vehicle_type_id IS NOT NULL;

COMMENT ON COLUMN bookings.vehicle_type_id IS 'Car wash only: FK → vehicle_types.id; NULL for all other categories';

-- ── resources: bay assignment logic ───────────────────────────
-- Wide bays (supports_large_vehicles = true) required for SUV, Pickup, Van.

ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS supports_large_vehicles BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN resources.supports_large_vehicles IS 'Car wash bay: true = wide bay, accepts SUV/Pickup/Van';
