-- ============================================================
-- EP-04: Payment & Escrow — Schema Migration
-- Run via: psql $DATABASE_URL -f 001_ep04_payment_escrow.sql
-- ============================================================

-- US-031: Card-on-file token (Paymob PCI-compliant token)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS paymob_card_token VARCHAR(200);

-- US-033: Business deposit policy config
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS policy_deposit_type VARCHAR(10) NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS policy_deposit_value DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS policy_cancellation_window_hours SMALLINT NOT NULL DEFAULT 24;

-- US-036: Business payout preferences
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS payout_method VARCHAR(30) NOT NULL DEFAULT 'paymob_wallet',
  ADD COLUMN IF NOT EXISTS payout_threshold_egp DECIMAL(10,2) NOT NULL DEFAULT 50.00;

-- Booking status audit log (referenced by booking-engine.ts from EP-03)
CREATE TABLE IF NOT EXISTS booking_status_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID NOT NULL REFERENCES bookings(id),
  from_status  VARCHAR(40) NOT NULL,
  to_status    VARCHAR(40) NOT NULL,
  actor        VARCHAR(20) NOT NULL,
  reason       VARCHAR(200),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_status_logs_booking
  ON booking_status_logs(booking_id);

-- Constraint: policy_deposit_type must be valid
ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS chk_policy_deposit_type;
ALTER TABLE businesses
  ADD CONSTRAINT chk_policy_deposit_type CHECK (policy_deposit_type IN ('fixed', 'percentage'));

-- Constraint: cancellation window must be positive
ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS chk_cancellation_window;
ALTER TABLE businesses
  ADD CONSTRAINT chk_cancellation_window CHECK (policy_cancellation_window_hours >= 0);
