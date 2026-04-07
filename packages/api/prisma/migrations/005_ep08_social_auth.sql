-- EP-08 US-067: Apple Sign-In / Social Login
-- Adds social_id and social_provider to users table

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "social_id"       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "social_provider" VARCHAR(20);

CREATE INDEX IF NOT EXISTS "users_social_id_idx" ON "users"("social_id");
