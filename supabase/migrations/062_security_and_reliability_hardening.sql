-- Migration 062: Security & Reliability Hardening
-- Outbound Idempotency, Durable Inbound Events, and Transactional Identifiers

-- 1. Outbound Message Outbox & Idempotency Table
CREATE TABLE IF NOT EXISTS outbound_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    idempotency_key TEXT NOT NULL,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    message_type TEXT NOT NULL DEFAULT 'text',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    meta_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
    error_code TEXT,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT outbound_outbox_account_idempotency_key UNIQUE (account_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_outbound_outbox_account_status ON outbound_outbox(account_id, status);

-- 2. Durable Inbound Webhook Events Table
CREATE TABLE IF NOT EXISTS inbound_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL, -- Meta wamid or change event hash
    entry_id TEXT,
    field TEXT NOT NULL DEFAULT 'messages',
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'completed', 'failed', 'dead_letter')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_log TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_webhook_events_status ON inbound_webhook_events(status, created_at);

-- 3. Ensure Appointment Booking & Ticket Identifiers
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booking_id TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS ticket_serial TEXT;

-- Create index for fast account & date ticket serial lookups
CREATE INDEX IF NOT EXISTS idx_appointments_account_date_token ON appointments(account_id, appointment_date, token_number);
