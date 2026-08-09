-- Migration: 064_audit_immutability_and_consent_defaults.sql
-- Description:
--   1. Makes audit_logs append-only: drops the broad FOR ALL policy,
--      adds explicit SELECT (tenant reads) and INSERT (service-role only) policies,
--      and installs a trigger preventing UPDATE/DELETE on audit rows.
--   2. Changes patient consent default from 'opted_in' to 'pending'.
--   3. Adds atomic consent-update RPC with fixed search_path.
--   4. Adds atomic patient-deletion RPC with fixed search_path.
--
-- This is a corrective forward-only migration; 049 is not modified.

-- ============================================================
-- 1. AUDIT LOG IMMUTABILITY
-- ============================================================

-- Drop the overly broad FOR ALL policy from migration 049
DROP POLICY IF EXISTS "Tenant Audit Log Isolation" ON public.audit_logs;

-- Tenant members may read their own audit logs
CREATE POLICY "audit_logs_tenant_select"
  ON public.audit_logs
  FOR SELECT
  USING (
    account_id = (
      SELECT (auth.jwt() -> 'app_metadata' ->> 'account_id')::uuid
    )
  );

-- Only service-role (supabaseAdmin) may insert audit events.
-- Regular authenticated users cannot insert directly.
CREATE POLICY "audit_logs_service_insert"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (
    (current_setting('role', true) = 'service_role')
    OR
    (auth.jwt() ->> 'role' = 'service_role')
  );

-- Immutability trigger: prevent UPDATE and DELETE on audit_logs
CREATE OR REPLACE FUNCTION public.audit_logs_immutable_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs rows are immutable: % is not permitted', TG_OP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_no_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_logs_immutable_guard();

DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_no_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_logs_immutable_guard();

-- ============================================================
-- 2. CONSENT DEFAULTS: pending instead of opted_in
-- ============================================================

ALTER TABLE public.patients
  ALTER COLUMN consent_status SET DEFAULT 'pending';

-- ============================================================
-- 3. ATOMIC CONSENT UPDATE RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_patient_consent_atomic(
  p_patient_id UUID,
  p_account_id UUID,
  p_actor_id UUID,
  p_consent_status VARCHAR(32),
  p_consent_source VARCHAR(64),
  p_policy_version VARCHAR(32)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_status VARCHAR(32);
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Validate consent_status
  IF p_consent_status NOT IN ('pending', 'opted_in', 'opted_out') THEN
    RAISE EXCEPTION 'Invalid consent_status: %', p_consent_status;
  END IF;

  -- Verify patient exists AND belongs to the specified account
  SELECT consent_status INTO v_previous_status
    FROM public.patients
   WHERE id = p_patient_id
     AND account_id = p_account_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient not found in tenant';
  END IF;

  -- Update consent
  UPDATE public.patients
     SET consent_status = p_consent_status,
         consent_source = p_consent_source,
         consent_updated_at = v_now,
         policy_version = p_policy_version,
         updated_at = v_now
   WHERE id = p_patient_id
     AND account_id = p_account_id;

  -- Insert audit event (same transaction)
  INSERT INTO public.audit_logs (
    account_id, actor_id, action, resource_type, resource_id, metadata
  ) VALUES (
    p_account_id,
    p_actor_id,
    CASE WHEN p_consent_status = 'opted_out'
         THEN 'patient.consent_withdrawn'
         ELSE 'patient.consent_updated'
    END,
    'patients',
    p_patient_id::text,
    jsonb_build_object(
      'previous_status', v_previous_status,
      'new_status', p_consent_status,
      'source', p_consent_source,
      'policy_version', p_policy_version
    )
  );

  RETURN jsonb_build_object('updated_at', v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.update_patient_consent_atomic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_patient_consent_atomic TO service_role;

-- ============================================================
-- 4. ATOMIC PATIENT DELETION RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_patient_atomic(
  p_patient_id UUID,
  p_account_id UUID,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_patient_exists BOOLEAN;
BEGIN
  -- Verify patient exists AND belongs to the specified account
  SELECT EXISTS(
    SELECT 1 FROM public.patients
     WHERE id = p_patient_id
       AND account_id = p_account_id
     FOR UPDATE
  ) INTO v_patient_exists;

  IF NOT v_patient_exists THEN
    RAISE EXCEPTION 'Patient not found in tenant';
  END IF;

  -- Insert audit event BEFORE deletion within the SAME atomic transaction
  INSERT INTO public.audit_logs (
    account_id, actor_id, action, resource_type, resource_id, metadata
  ) VALUES (
    p_account_id,
    p_actor_id,
    'patient.data_deleted',
    'patients',
    p_patient_id::text,
    jsonb_build_object(
      'deleted_at', v_now,
      'deleted_patient_id', p_patient_id::text
    )
  );

  -- Delete patient record (CASCADE will purge related records)
  DELETE FROM public.patients
   WHERE id = p_patient_id
     AND account_id = p_account_id;

  RETURN jsonb_build_object('deleted_at', v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_patient_atomic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_patient_atomic TO service_role;
