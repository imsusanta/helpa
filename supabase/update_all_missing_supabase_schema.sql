-- ============================================================================
-- HELPA SAAS & SALES CRM — CONSOLIDATED IDEMPOTENT SUPABASE MIGRATION
-- Run this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/tmqlzsyqlprioeoowmtk/sql/new
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. CORE HELPER FUNCTIONS (REQUIRED FOR RLS POLICIES)
CREATE OR REPLACE FUNCTION public.is_active_account_member(target_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = target_account_id AND user_id = auth.uid() AND active
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_account_member(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_active_account_member(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_account_role(target_account_id uuid, minimum_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = target_account_id AND user_id = auth.uid() AND active
      AND CASE role WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'agent' THEN 2 ELSE 1 END
        >= CASE minimum_role WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'agent' THEN 2 ELSE 1 END
  );
$$;
REVOKE ALL ON FUNCTION public.has_account_role(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.has_account_role(uuid, text) TO authenticated, service_role;

-- Profiles super admin flag & helper
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND is_super_admin = true
  );
$$;
REVOKE ALL ON FUNCTION public.is_platform_super_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_platform_super_admin() TO authenticated, service_role;

-- 2. WHATSAPP OUTBOX TABLE & INDEXES
CREATE TABLE IF NOT EXISTS public.whatsapp_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'retrying', 'dead_letter', 'unknown')),
  attempt_count integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  provider_result jsonb,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS whatsapp_outbox_claim_idx 
  ON public.whatsapp_outbox (status, available_at) 
  WHERE status IN ('pending', 'retrying');

ALTER TABLE public.whatsapp_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_outbox_select ON public.whatsapp_outbox;
CREATE POLICY whatsapp_outbox_select ON public.whatsapp_outbox
  FOR SELECT TO authenticated
  USING (public.is_active_account_member(account_id));

-- 3. WEBHOOK EVENTS TABLE & INDEXES
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'processed', 'retrying', 'dead_letter')),
  payload_file_id text,
  payload_hash text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS webhook_events_account_status_idx 
  ON public.webhook_events (account_id, status, received_at);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_events_select ON public.webhook_events;
CREATE POLICY webhook_events_select ON public.webhook_events
  FOR SELECT TO authenticated
  USING (public.is_active_account_member(account_id));

-- 4. REMINDER JOBS TABLE & INDEXES
CREATE TABLE IF NOT EXISTS public.reminder_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  run_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS reminder_jobs_run_idx 
  ON public.reminder_jobs (status, run_at) 
  WHERE status = 'pending';

ALTER TABLE public.reminder_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reminder_jobs_select ON public.reminder_jobs;
CREATE POLICY reminder_jobs_select ON public.reminder_jobs
  FOR SELECT TO authenticated
  USING (public.is_active_account_member(account_id));

-- 5. MIGRATION IDENTITY MAP TABLE
CREATE TABLE IF NOT EXISTS public.migration_identity_map (
  source_provider text NOT NULL,
  source_id text NOT NULL,
  destination_table text NOT NULL,
  destination_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_provider, source_id, destination_table),
  UNIQUE (destination_table, destination_id)
);

ALTER TABLE public.migration_identity_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS migration_identity_map_select ON public.migration_identity_map;
CREATE POLICY migration_identity_map_select ON public.migration_identity_map
  FOR SELECT TO authenticated
  USING (public.has_account_role(destination_id, 'admin'::text));

-- 6. DROP EXISTING FUNCTIONS FIRST TO AVOID 42P13 PARAMETER DEFAULT ERRORS
DROP FUNCTION IF EXISTS public.convert_quotation_to_invoice(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.convert_quotation_to_invoice;
DROP FUNCTION IF EXISTS public.record_invoice_payment(uuid, uuid, numeric, text, text, uuid);
DROP FUNCTION IF EXISTS public.record_invoice_payment;
DROP FUNCTION IF EXISTS public.generate_next_quotation_number(uuid);
DROP FUNCTION IF EXISTS public.generate_next_quotation_number;
DROP FUNCTION IF EXISTS public.generate_next_invoice_number(uuid);
DROP FUNCTION IF EXISTS public.generate_next_invoice_number;

-- 7. RECREATE ATOMIC SALES CRM ACCOUNTING RPCs

-- Sequence generator for quotation numbers
CREATE OR REPLACE FUNCTION public.generate_next_quotation_number(p_account_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next_val bigint;
  v_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.accounts WHERE id = p_account_id) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(max(
    CASE 
      WHEN quotation_number ~ '^QT-[0-9]+$' THEN substr(quotation_number, 4)::bigint
      ELSE 0
    END
  ), 0) + 1
  INTO v_next_val
  FROM public.quotations
  WHERE account_id = p_account_id;

  RETURN 'QT-' || lpad(v_next_val::text, 5, '0');
END;
$$;

-- Sequence generator for invoice numbers
CREATE OR REPLACE FUNCTION public.generate_next_invoice_number(p_account_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next_val bigint;
  v_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.accounts WHERE id = p_account_id) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(max(
    CASE 
      WHEN invoice_number ~ '^INV-[0-9]+$' THEN substr(invoice_number, 5)::bigint
      ELSE 0
    END
  ), 0) + 1
  INTO v_next_val
  FROM public.invoices
  WHERE account_id = p_account_id;

  RETURN 'INV-' || lpad(v_next_val::text, 5, '0');
END;
$$;

-- Convert quotation to invoice atomically
CREATE OR REPLACE FUNCTION public.convert_quotation_to_invoice(
  p_account_id uuid,
  p_quotation_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quotation public.quotations%ROWTYPE;
  v_invoice_id uuid;
  v_invoice_number text;
  v_has_member boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.account_members 
    WHERE account_id = p_account_id AND user_id = p_user_id AND role IN ('owner', 'admin', 'agent')
  ) INTO v_has_member;
  IF NOT v_has_member THEN
    RAISE EXCEPTION 'INSUFFICIENT_PERMISSIONS' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_quotation
  FROM public.quotations
  WHERE id = p_quotation_id AND account_id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUOTATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_quotation.status = 'converted' THEN
    RAISE EXCEPTION 'ALREADY_CONVERTED' USING ERRCODE = '23505';
  END IF;

  v_invoice_number := public.generate_next_invoice_number(p_account_id);
  v_invoice_id := gen_random_uuid();

  INSERT INTO public.invoices (
    id, account_id, quotation_id, contact_id, invoice_number,
    issue_date, due_date, status, subtotal, discount_amount,
    tax_amount, total, amount_paid, balance_due, currency,
    notes, created_by, created_at, updated_at
  ) VALUES (
    v_invoice_id, p_account_id, v_quotation.id, v_quotation.contact_id, v_invoice_number,
    CURRENT_DATE, CURRENT_DATE + interval '30 days', 'draft', v_quotation.subtotal, v_quotation.discount_amount,
    v_quotation.tax_amount, v_quotation.total, 0, v_quotation.total, v_quotation.currency,
    v_quotation.notes, p_user_id, now(), now()
  );

  INSERT INTO public.invoice_items (
    id, invoice_id, account_id, description, quantity,
    unit_price, discount, tax_rate, total, created_at
  )
  SELECT 
    gen_random_uuid(), v_invoice_id, p_account_id, description, quantity,
    unit_price, discount, tax_rate, total, now()
  FROM public.quotation_items
  WHERE quotation_id = v_quotation.id AND account_id = p_account_id;

  UPDATE public.quotations
  SET status = 'converted', updated_at = now()
  WHERE id = v_quotation.id AND account_id = p_account_id;

  RETURN jsonb_build_object(
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'total', v_quotation.total,
    'currency', v_quotation.currency
  );
END;
$$;

-- Record invoice payment atomically
CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  p_account_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_reference_note text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_payment_id uuid;
  v_new_paid numeric;
  v_new_balance numeric;
  v_new_status text;
  v_has_member boolean;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT' USING ERRCODE = '22003';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.account_members 
    WHERE account_id = p_account_id AND user_id = p_user_id AND role IN ('owner', 'admin', 'agent')
  ) INTO v_has_member;
  IF NOT v_has_member THEN
    RAISE EXCEPTION 'INSUFFICIENT_PERMISSIONS' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id AND account_id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_invoice.status = 'void' THEN
    RAISE EXCEPTION 'INVOICE_VOID' USING ERRCODE = '22000';
  END IF;

  IF v_invoice.balance_due <= 0 THEN
    RAISE EXCEPTION 'INVOICE_ALREADY_PAID' USING ERRCODE = '22000';
  END IF;

  IF p_amount > v_invoice.balance_due THEN
    RAISE EXCEPTION 'OVERPAYMENT_NOT_ALLOWED' USING ERRCODE = '22000';
  END IF;

  v_new_paid := v_invoice.amount_paid + p_amount;
  v_new_balance := v_invoice.total - v_new_paid;

  IF v_new_balance = 0 THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partially_paid';
  END IF;

  v_payment_id := gen_random_uuid();

  INSERT INTO public.invoice_payments (
    id, invoice_id, account_id, amount, payment_date,
    payment_method, reference_note, created_by, created_at
  ) VALUES (
    v_payment_id, v_invoice.id, p_account_id, p_amount, CURRENT_DATE,
    p_payment_method, p_reference_note, p_user_id, now()
  );

  UPDATE public.invoices
  SET 
    amount_paid = v_new_paid,
    balance_due = v_new_balance,
    status = v_new_status,
    updated_at = now()
  WHERE id = v_invoice.id AND account_id = p_account_id;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'invoice_id', v_invoice.id,
    'amount_paid', v_new_paid,
    'balance_due', v_new_balance,
    'status', v_new_status,
    'currency', v_invoice.currency
  );
END;
$$;

-- 8. GRANT SERVICE ROLE ACCESS & REVOKE PUBLIC EXECUTE
REVOKE ALL ON FUNCTION public.generate_next_quotation_number(uuid) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_next_quotation_number(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.generate_next_invoice_number(uuid) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_next_invoice_number(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.convert_quotation_to_invoice(uuid, uuid, uuid) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.convert_quotation_to_invoice(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.record_invoice_payment(uuid, uuid, numeric, text, text, uuid) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment(uuid, uuid, numeric, text, text, uuid) TO service_role;

COMMIT;
