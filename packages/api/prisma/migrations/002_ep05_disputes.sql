-- ============================================================
-- EP-05: No-Show & Cancellation — Dispute Fields Migration
-- ============================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS dispute_reason       VARCHAR(500),
  ADD COLUMN IF NOT EXISTS dispute_submitted_at TIMESTAMPTZ;

-- Index for ops dispute queue (admin console)
CREATE INDEX IF NOT EXISTS idx_bookings_disputed
  ON bookings(status, dispute_submitted_at)
  WHERE status = 'disputed';
