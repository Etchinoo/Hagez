-- ============================================================
-- EP-13: Car Wash Booking
-- Adds CarWashConfig table + car-wash booking fields on bookings
-- ============================================================

-- CarWashConfig (one per car_wash business)
CREATE TABLE car_wash_configs (
  id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                   UUID        NOT NULL UNIQUE REFERENCES businesses(id),
  vehicle_types                 TEXT[]      NOT NULL DEFAULT '{}',
  service_packages              JSONB       NOT NULL DEFAULT '[]',
  allows_drop_off               BOOLEAN     NOT NULL DEFAULT TRUE,
  allows_wait                   BOOLEAN     NOT NULL DEFAULT TRUE,
  estimated_duration_minutes    SMALLINT    NOT NULL DEFAULT 30,
  slot_duration_options         INTEGER[]   NOT NULL DEFAULT '{}',
  default_slot_duration_minutes SMALLINT    NOT NULL DEFAULT 30,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_car_wash_configs_business ON car_wash_configs (business_id);

-- Add car-wash booking fields
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS vehicle_type    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS service_package VARCHAR(30),
  ADD COLUMN IF NOT EXISTS drop_off        BOOLEAN;

COMMENT ON COLUMN bookings.vehicle_type    IS 'Car wash: sedan|suv|truck|motorcycle';
COMMENT ON COLUMN bookings.service_package IS 'Car wash: basic|premium|detailing';
COMMENT ON COLUMN bookings.drop_off        IS 'Car wash: true=drop-off, false=wait on-site';
