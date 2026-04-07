-- EP-06: Notification Preferences
-- US-046: Consumer opt-out fields on users
-- US-049: Business push notification preferences on businesses

-- Consumer notification opt-outs
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notify_whatsapp BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_push     BOOLEAN NOT NULL DEFAULT true;

-- Business notification preferences
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS notify_new_booking_push    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_cancellation_push   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_payout_whatsapp     BOOLEAN NOT NULL DEFAULT true;

-- Index: worker polls for queued/scheduled notifications
CREATE INDEX IF NOT EXISTS idx_notifications_worker
  ON notifications (status, scheduled_at)
  WHERE status IN ('queued', 'failed');
