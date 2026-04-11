-- Add booking.section_preference (US-023 restaurant section preference)
-- Add booking.rescheduled_at (timestamp of most recent reschedule)
ALTER TABLE "bookings"
  ADD COLUMN "section_preference" VARCHAR(50),
  ADD COLUMN "rescheduled_at" TIMESTAMPTZ;
