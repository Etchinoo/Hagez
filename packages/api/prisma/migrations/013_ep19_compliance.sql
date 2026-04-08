-- ============================================================
-- EP-19: Compliance & Privacy (PDPL 2020)
-- US-081: privacy_policy_acceptances + user consent fields
-- US-083: data_export_requests + DataExportStatus enum
-- US-084: audit_logs table
-- ============================================================

-- 1. User: PDPL consent tracking fields
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS privacy_accepted_version VARCHAR(20),
  ADD COLUMN IF NOT EXISTS privacy_accepted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_requested_at    TIMESTAMPTZ;

-- 2. Privacy policy acceptances (immutable consent log)
CREATE TABLE IF NOT EXISTS privacy_policy_acceptances (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES users(id),
  policy_version VARCHAR(20) NOT NULL,
  accepted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address     VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_privacy_acceptances_user_id
  ON privacy_policy_acceptances (user_id);

-- 3. DataExportStatus enum
DO $$ BEGIN
  CREATE TYPE "DataExportStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Data export requests (PDPL Art.16)
CREATE TABLE IF NOT EXISTS data_export_requests (
  id            UUID                NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID                NOT NULL REFERENCES users(id),
  status        "DataExportStatus"  NOT NULL DEFAULT 'pending',
  s3_key        VARCHAR(500),
  download_url  VARCHAR(1000),
  expires_at    TIMESTAMPTZ,
  error_message VARCHAR(500),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_data_export_requests_user_id
  ON data_export_requests (user_id, created_at DESC);

-- 5. Audit logs (immutable — no updates/deletes ever)
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id    UUID,                         -- null for system jobs
  actor_type  VARCHAR(30) NOT NULL,         -- "admin" | "super_admin" | "system"
  action      VARCHAR(100) NOT NULL,        -- e.g. "pii_purge", "account_deleted"
  target_type VARCHAR(50),                  -- e.g. "booking", "user"
  target_id   VARCHAR(100),
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id
  ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON audit_logs (action, created_at DESC);
