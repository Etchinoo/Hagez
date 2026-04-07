-- EP-10: Reviews & Loyalty (Phase 1 Foundation)
-- Adds loyalty_points table and user.loyalty_balance column.
-- Reviews infrastructure (Review model) was already present from init migration.

CREATE TYPE "LoyaltyTransactionType" AS ENUM ('earn', 'redeem');

ALTER TABLE "users"
  ADD COLUMN "loyalty_balance" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "loyalty_points" (
  "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"          UUID        NOT NULL,
  "booking_id"       UUID        NOT NULL,
  "points"           INTEGER     NOT NULL,
  "transaction_type" "LoyaltyTransactionType" NOT NULL,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "loyalty_points_pkey"       PRIMARY KEY ("id"),
  CONSTRAINT "loyalty_points_user_fk"    FOREIGN KEY ("user_id")    REFERENCES "users"("id"),
  CONSTRAINT "loyalty_points_booking_fk" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
);

CREATE INDEX "loyalty_points_user_idx" ON "loyalty_points"("user_id");
