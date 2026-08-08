-- ============================================================
-- 063_secure_webhook_and_outbox_tables.sql
--
-- Hardens outbound_outbox and inbound_webhook_events:
-- 1. Enables Row Level Security (RLS) on both queue tables.
-- 2. Explicitly revokes all direct table access from anon and authenticated
--    client roles to prevent any client-side payload inspection or tampering.
-- 3. Adds nullable account_id to inbound_webhook_events for tenant scoping
--    once a webhook event is resolved to a WhatsApp configuration.
-- 4. Creates covering indexes for event lookups, tenant lookups, and retention cleanup.
-- 5. Documents the sensitivity of raw payload columns.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- 1. Ensure account_id exists on inbound_webhook_events
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'inbound_webhook_events'
          AND column_name = 'account_id'
    ) THEN
        ALTER TABLE inbound_webhook_events
        ADD COLUMN account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Enable Row Level Security (Default-Deny for all client queries)
ALTER TABLE IF EXISTS outbound_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inbound_webhook_events ENABLE ROW LEVEL SECURITY;

-- 3. Explicitly revoke permissions from anon and authenticated roles
-- Queue and webhook tables are strictly accessed via trusted server-side service-role.
REVOKE ALL ON TABLE outbound_outbox FROM anon, authenticated;
REVOKE ALL ON TABLE inbound_webhook_events FROM anon, authenticated;

-- 4. Create optimized indexes for tenant filtering and retention cleanup
CREATE INDEX IF NOT EXISTS idx_inbound_webhook_events_account_status
    ON inbound_webhook_events(account_id, status);

CREATE INDEX IF NOT EXISTS idx_inbound_webhook_events_created_at
    ON inbound_webhook_events(created_at);

CREATE INDEX IF NOT EXISTS idx_outbound_outbox_created_at
    ON outbound_outbox(created_at);

-- 5. Documentation comments on payload security and retention
COMMENT ON TABLE inbound_webhook_events IS 'Stores inbound Meta WhatsApp webhook events for idempotency and durable processing. Contains PHI/PII in raw payloads — restricted strictly to server-side service role.';
COMMENT ON COLUMN inbound_webhook_events.payload IS 'Raw Meta webhook event JSON. Subject to a 7-day retention policy for completed events and 30 days for dead-letter triage.';
COMMENT ON TABLE outbound_outbox IS 'Transactional outbox for queued outbound WhatsApp messages and idempotency enforcement.';
