-- ============================================================
-- Widen outbound_outbox.status CHECK to include the two terminal
-- statuses the application actually writes.
--
-- OutboxService marks rows 'reconciliation_required' (Meta accepted
-- the send but local persistence failed) and 'dead_letter' (Meta
-- permanently rejected the send). The original CHECK only allowed
-- ('pending','processing','sent','failed'), so both updates violated
-- the constraint, the error was swallowed, and rows stayed
-- 'processing' forever:
--   * reconcilePendingMessages() never found anything to repair, and
--   * retries of a failed send returned 202 "in progress" forever
--     instead of a terminal outcome.
--
-- Idempotent: drops and recreates the constraint.
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.outbound_outbox') IS NOT NULL THEN
    ALTER TABLE public.outbound_outbox
      DROP CONSTRAINT IF EXISTS outbound_outbox_status_check;
    ALTER TABLE public.outbound_outbox
      ADD CONSTRAINT outbound_outbox_status_check
      CHECK (status IN (
        'pending',
        'processing',
        'sent',
        'failed',
        'reconciliation_required',
        'dead_letter'
      ));
  END IF;
END $$;
