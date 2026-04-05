-- ============================================================
-- SUPER RESERVATION PLATFORM — Seed SQL
-- Additional constraints & indexes not expressible in Prisma schema
-- Run automatically by Docker Compose on first start
-- ============================================================

-- Rating range constraint on reviews
ALTER TABLE reviews ADD CONSTRAINT chk_rating_range CHECK (rating >= 1 AND rating <= 5);

-- Booking ref format constraint
ALTER TABLE bookings ADD CONSTRAINT chk_booking_ref_format CHECK (booking_ref ~ '^BK-[0-9]{8}-[A-Z0-9]{5}$');

-- Slot: end_time must be after start_time
ALTER TABLE slots ADD CONSTRAINT chk_slot_time_order CHECK (end_time > start_time);

-- Slot: booked_count cannot exceed capacity
ALTER TABLE slots ADD CONSTRAINT chk_slot_capacity CHECK (booked_count <= capacity);

-- Language preference must be 'ar' or 'en'
ALTER TABLE users ADD CONSTRAINT chk_language_pref CHECK (language_pref IN ('ar', 'en'));

-- Geospatial index for proximity search
CREATE INDEX IF NOT EXISTS idx_businesses_location
  ON businesses USING GIST(ST_MakePoint(lng::float8, lat::float8));

-- No-show detection job index: confirmed bookings only
CREATE INDEX IF NOT EXISTS idx_bookings_noshow_detection
  ON bookings(status, slot_id)
  WHERE status = 'confirmed';

-- Notification delivery index: queued notifications by scheduled time
CREATE INDEX IF NOT EXISTS idx_notifications_delivery
  ON notifications(status, scheduled_at)
  WHERE status = 'queued';
