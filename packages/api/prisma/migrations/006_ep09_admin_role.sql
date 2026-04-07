-- EP-09: Admin Console — Add UserRole enum and role column to users
-- Allows OTP-verified admin/super_admin users to access the admin console.

CREATE TYPE "UserRole" AS ENUM ('consumer', 'business_owner', 'admin', 'super_admin');

ALTER TABLE "users"
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'consumer';

CREATE INDEX "users_role_idx" ON "users"("role");
