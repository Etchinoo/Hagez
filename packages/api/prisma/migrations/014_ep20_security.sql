-- ============================================================
-- EP-20: Security Hardening
-- US-085: OTP throttle — pure Redis, no schema change needed.
-- US-086: Immutable audit_log enforcement at DB level.
-- US-087: provider_transaction_id UNIQUE already exists on payments.
-- ============================================================

-- ── US-086: Prevent UPDATE and DELETE on audit_logs ──────────
-- Enforced at PostgreSQL trigger level. Any attempt to mutate
-- an existing row raises a SQLSTATE 42501 (insufficient privilege).

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs rows are immutable: UPDATE and DELETE are not permitted'
    USING ERRCODE = '42501';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

-- ── US-087: Confirm provider_transaction_id UNIQUE (already exists) ──
-- The UNIQUE constraint on payments.paymob_transaction_id was added in
-- migration 003 via the Prisma schema. No additional change needed.
-- This comment serves as the EP-20 sign-off record.

-- ── Indexes for audit log queries (Super Admin view) ──────────
-- actor + time for "show me what admin X did"
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_time
  ON audit_logs (actor_id, created_at DESC);

-- action type + time for "show all business_approved events"
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_time
  ON audit_logs (action, created_at DESC);
