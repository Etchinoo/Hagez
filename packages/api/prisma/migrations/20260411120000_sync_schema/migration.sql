-- CreateEnum
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('earn', 'redeem', 'expire');

-- CreateEnum
CREATE TYPE "LoyaltyTier" AS ENUM ('bronze', 'silver', 'gold', 'platinum');

-- CreateEnum
CREATE TYPE "FeaturedPlan" AS ENUM ('starter_7', 'growth_14', 'pro_30');

-- CreateEnum
CREATE TYPE "FeaturedListingStatus" AS ENUM ('pending_payment', 'active', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('consumer', 'business_owner', 'admin', 'super_admin');

-- CreateEnum
CREATE TYPE "VehicleSizeClass" AS ENUM ('sedan', 'suv', 'pickup', 'van');

-- CreateEnum
CREATE TYPE "PricingRuleType" AS ENUM ('surge', 'last_minute', 'demand');

-- CreateEnum
CREATE TYPE "DataExportStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "dispute_reason" VARCHAR(500),
ADD COLUMN     "dispute_submitted_at" TIMESTAMPTZ,
ADD COLUMN     "drop_off" BOOLEAN,
ADD COLUMN     "effective_multiplier" DECIMAL(4,2),
ADD COLUMN     "equipment_rental" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "genre_preference" VARCHAR(20),
ADD COLUMN     "internal_notes" VARCHAR(1000),
ADD COLUMN     "points_discount_egp" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "pricing_rule_id" UUID,
ADD COLUMN     "redeemed_points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "service_package" VARCHAR(30),
ADD COLUMN     "sport_type" VARCHAR(30),
ADD COLUMN     "station_type" VARCHAR(20),
ADD COLUMN     "vehicle_type" VARCHAR(20),
ADD COLUMN     "vehicle_type_id" UUID;

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "notify_cancellation_push" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_new_booking_push" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_payout_whatsapp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "payout_method" VARCHAR(30) NOT NULL DEFAULT 'paymob_wallet',
ADD COLUMN     "payout_threshold_egp" DECIMAL(10,2) NOT NULL DEFAULT 50.00,
ADD COLUMN     "policy_cancellation_window_hours" SMALLINT NOT NULL DEFAULT 24,
ADD COLUMN     "policy_deposit_type" VARCHAR(10) NOT NULL DEFAULT 'fixed',
ADD COLUMN     "policy_deposit_value" DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "supports_large_vehicles" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "fcm_token",
ADD COLUMN     "deletion_requested_at" TIMESTAMPTZ,
ADD COLUMN     "expo_push_token" TEXT,
ADD COLUMN     "loyalty_balance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loyalty_tier" "LoyaltyTier" NOT NULL DEFAULT 'bronze',
ADD COLUMN     "notify_push" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_whatsapp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "paymob_card_token" VARCHAR(200),
ADD COLUMN     "privacy_accepted_at" TIMESTAMPTZ,
ADD COLUMN     "privacy_accepted_version" VARCHAR(20),
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'consumer',
ADD COLUMN     "social_id" VARCHAR(255),
ADD COLUMN     "social_provider" VARCHAR(20);

-- CreateTable
CREATE TABLE "vehicle_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name_ar" VARCHAR(50) NOT NULL,
    "name_en" VARCHAR(50) NOT NULL,
    "size_class" "VehicleSizeClass" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "rule_type" "PricingRuleType" NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "multiplier" DECIMAL(4,2),
    "max_multiplier" DECIMAL(4,2),
    "days_of_week" INTEGER[],
    "hour_start" SMALLINT,
    "hour_end" SMALLINT,
    "minutes_before" SMALLINT,
    "discount_pct" DECIMAL(5,2),
    "fill_rate_pct" SMALLINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "name_ar" VARCHAR(200) NOT NULL,
    "name_en" VARCHAR(200),
    "price_egp" DECIMAL(10,2) NOT NULL,
    "duration_min" SMALLINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_sections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100),
    "capacity" SMALLINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "sport_types" TEXT[],
    "court_type" VARCHAR(20) NOT NULL DEFAULT 'outdoor',
    "surface_type" VARCHAR(30),
    "has_lighting" BOOLEAN NOT NULL DEFAULT false,
    "equipment_available" TEXT[],
    "slot_duration_options" INTEGER[],
    "default_slot_duration_minutes" SMALLINT NOT NULL DEFAULT 60,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "court_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gaming_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "station_types" TEXT[],
    "has_group_rooms" BOOLEAN NOT NULL DEFAULT false,
    "group_room_capacity" SMALLINT NOT NULL DEFAULT 6,
    "genre_options" TEXT[],
    "slot_duration_options" INTEGER[],
    "default_slot_duration_minutes" SMALLINT NOT NULL DEFAULT 60,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "gaming_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "car_wash_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "vehicle_types" TEXT[],
    "service_packages" JSONB NOT NULL,
    "allows_drop_off" BOOLEAN NOT NULL DEFAULT true,
    "allows_wait" BOOLEAN NOT NULL DEFAULT true,
    "estimated_duration_minutes" SMALLINT NOT NULL DEFAULT 30,
    "slot_duration_options" INTEGER[],
    "default_slot_duration_minutes" SMALLINT NOT NULL DEFAULT 30,
    "price_by_vehicle" JSONB,
    "duration_by_vehicle" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "car_wash_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "from_status" VARCHAR(40) NOT NULL,
    "to_status" VARCHAR(40) NOT NULL,
    "actor" VARCHAR(20) NOT NULL,
    "reason" VARCHAR(200),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_points" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "booking_id" UUID,
    "points" INTEGER NOT NULL,
    "transaction_type" "LoyaltyTransactionType" NOT NULL,
    "description_ar" VARCHAR(200),
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "featured_listings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "plan" "FeaturedPlan" NOT NULL,
    "status" "FeaturedListingStatus" NOT NULL DEFAULT 'pending_payment',
    "price_egp" DECIMAL(10,2) NOT NULL,
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "paymob_order_id" VARCHAR(100),
    "paymob_transaction_id" VARCHAR(100),
    "approved_by_admin_id" UUID,
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "featured_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_policy_acceptances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "policy_version" VARCHAR(20) NOT NULL,
    "accepted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),

    CONSTRAINT "privacy_policy_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_export_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "status" "DataExportStatus" NOT NULL DEFAULT 'pending',
    "s3_key" VARCHAR(500),
    "download_url" VARCHAR(1000),
    "expires_at" TIMESTAMPTZ,
    "error_message" VARCHAR(500),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "data_export_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_catalog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category" "BusinessCategory" NOT NULL,
    "name_ar" VARCHAR(200) NOT NULL,
    "name_en" VARCHAR(200),
    "typical_duration_min" SMALLINT NOT NULL DEFAULT 30,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "service_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "actor_type" VARCHAR(30) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(50),
    "target_id" VARCHAR(100),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pricing_rules_business_id_is_active_idx" ON "pricing_rules"("business_id", "is_active");

-- CreateIndex
CREATE INDEX "business_services_business_id_is_active_idx" ON "business_services"("business_id", "is_active");

-- CreateIndex
CREATE INDEX "business_sections_business_id_is_active_idx" ON "business_sections"("business_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "court_configs_business_id_key" ON "court_configs"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "gaming_configs_business_id_key" ON "gaming_configs"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "car_wash_configs_business_id_key" ON "car_wash_configs"("business_id");

-- CreateIndex
CREATE INDEX "booking_status_logs_booking_id_idx" ON "booking_status_logs"("booking_id");

-- CreateIndex
CREATE INDEX "loyalty_points_user_id_idx" ON "loyalty_points"("user_id");

-- CreateIndex
CREATE INDEX "loyalty_points_expires_at_idx" ON "loyalty_points"("expires_at");

-- CreateIndex
CREATE INDEX "featured_listings_business_id_idx" ON "featured_listings"("business_id");

-- CreateIndex
CREATE INDEX "featured_listings_status_ends_at_idx" ON "featured_listings"("status", "ends_at");

-- CreateIndex
CREATE INDEX "privacy_policy_acceptances_user_id_idx" ON "privacy_policy_acceptances"("user_id");

-- CreateIndex
CREATE INDEX "data_export_requests_user_id_created_at_idx" ON "data_export_requests"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "service_catalog_category_is_active_idx" ON "service_catalog"("category", "is_active");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "businesses_is_featured_featured_until_idx" ON "businesses"("is_featured", "featured_until");

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_services" ADD CONSTRAINT "business_services_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_sections" ADD CONSTRAINT "business_sections_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_configs" ADD CONSTRAINT "court_configs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gaming_configs" ADD CONSTRAINT "gaming_configs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "car_wash_configs" ADD CONSTRAINT "car_wash_configs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pricing_rule_id_fkey" FOREIGN KEY ("pricing_rule_id") REFERENCES "pricing_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_logs" ADD CONSTRAINT "booking_status_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_points" ADD CONSTRAINT "loyalty_points_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_points" ADD CONSTRAINT "loyalty_points_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_listings" ADD CONSTRAINT "featured_listings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privacy_policy_acceptances" ADD CONSTRAINT "privacy_policy_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

