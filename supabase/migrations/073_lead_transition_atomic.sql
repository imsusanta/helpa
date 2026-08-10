-- Migration: 073_lead_transition_atomic.sql
-- Description: Referential integrity constraints and atomic lead stage transition RPC function.

-- 1. Add Foreign Keys to ensure referential integrity with deals table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_lead_stage_history_deals'
  ) THEN
    ALTER TABLE public.lead_stage_history
      ADD CONSTRAINT fk_lead_stage_history_deals
      FOREIGN KEY (lead_id) REFERENCES public.deals(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_calls_deals'
  ) THEN
    ALTER TABLE public.calls
      ADD CONSTRAINT fk_calls_deals
      FOREIGN KEY (lead_id) REFERENCES public.deals(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_followup_enrollments_deals'
  ) THEN
    ALTER TABLE public.followup_enrollments
      ADD CONSTRAINT fk_followup_enrollments_deals
      FOREIGN KEY (lead_id) REFERENCES public.deals(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_followup_jobs_deals'
  ) THEN
    ALTER TABLE public.followup_jobs
      ADD CONSTRAINT fk_followup_jobs_deals
      FOREIGN KEY (lead_id) REFERENCES public.deals(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Add Unique Constraint on call_events to prevent duplicate webhook inserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'uq_call_events_external_event'
  ) THEN
    ALTER TABLE public.call_events
      ADD CONSTRAINT uq_call_events_external_event UNIQUE (account_id, external_event_id);
  END IF;
END $$;

-- 3. Atomic Lead State Transition RPC Function
CREATE OR REPLACE FUNCTION public.transition_lead_atomic(
  p_account_id UUID,
  p_lead_id UUID,
  p_next_stage VARCHAR(64),
  p_reason TEXT DEFAULT NULL,
  p_source VARCHAR(64) DEFAULT 'system',
  p_actor_type VARCHAR(32) DEFAULT 'system',
  p_actor_id UUID DEFAULT NULL,
  p_idempotency_key VARCHAR(255) DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_stage VARCHAR(64);
  v_contact_id UUID;
  v_result JSONB;
  v_appt_count INT;
  v_is_valid BOOLEAN := FALSE;
BEGIN
  -- Check Idempotency Key if provided
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT response INTO v_result
    FROM public.idempotency_keys
    WHERE account_id = p_account_id
      AND scope = 'lead_transition'
      AND key = p_idempotency_key
      AND status = 'completed';

    IF FOUND THEN
      RETURN v_result;
    END IF;
  END IF;

  -- Lock target deal record for atomic update
  SELECT stage, contact_id INTO v_current_stage, v_contact_id
  FROM public.deals
  WHERE id = p_lead_id AND account_id = p_account_id
  FOR UPDATE;

  IF v_current_stage IS NULL THEN
    RAISE EXCEPTION 'Lead not found in tenant' USING ERRCODE = 'P0002';
  END IF;

  -- If same stage, return early without error
  IF v_current_stage = p_next_stage THEN
    v_result := jsonb_build_object(
      'success', true,
      'lead_id', p_lead_id,
      'previous_stage', v_current_stage,
      'next_stage', p_next_stage,
      'no_op', true
    );
    RETURN v_result;
  END IF;

  -- State Transition Graph Validation
  CASE v_current_stage
    WHEN 'NEW' THEN
      v_is_valid := p_next_stage IN ('CONTACTED', 'QUALIFYING', 'LOST');
    WHEN 'CONTACTED' THEN
      v_is_valid := p_next_stage IN ('QUALIFYING', 'QUALIFIED', 'FOLLOW_UP', 'LOST');
    WHEN 'QUALIFYING' THEN
      v_is_valid := p_next_stage IN ('QUALIFIED', 'FOLLOW_UP', 'LOST');
    WHEN 'QUALIFIED' THEN
      v_is_valid := p_next_stage IN ('APPOINTMENT_OFFERED', 'FOLLOW_UP', 'LOST');
    WHEN 'APPOINTMENT_OFFERED' THEN
      v_is_valid := p_next_stage IN ('BOOKED', 'FOLLOW_UP', 'LOST');
    WHEN 'BOOKED' THEN
      v_is_valid := p_next_stage IN ('CONFIRMED', 'FOLLOW_UP', 'LOST');
    WHEN 'CONFIRMED' THEN
      v_is_valid := p_next_stage IN ('ATTENDED', 'FOLLOW_UP', 'LOST');
    WHEN 'ATTENDED' THEN
      v_is_valid := p_next_stage IN ('CONVERTED', 'FOLLOW_UP', 'LOST');
    WHEN 'FOLLOW_UP' THEN
      v_is_valid := p_next_stage IN ('CONTACTED', 'QUALIFYING', 'QUALIFIED', 'APPOINTMENT_OFFERED', 'BOOKED', 'CONFIRMED', 'ATTENDED', 'CONVERTED', 'LOST');
    WHEN 'LOST' THEN
      v_is_valid := p_next_stage IN ('NEW'); -- Reopen action
    ELSE
      v_is_valid := FALSE;
  END CASE;

  IF NOT v_is_valid THEN
    RAISE EXCEPTION 'Invalid stage transition from % to %', v_current_stage, p_next_stage USING ERRCODE = 'P0001';
  END IF;

  -- Additional Validation Rules
  IF p_next_stage = 'LOST' AND (p_reason IS NULL OR TRIM(p_reason) = '') THEN
    RAISE EXCEPTION 'Transition to LOST requires a valid reason' USING ERRCODE = 'P0003';
  END IF;

  IF p_next_stage = 'BOOKED' THEN
    SELECT COUNT(*) INTO v_appt_count
    FROM public.appointments
    WHERE account_id = p_account_id
      AND (
        patient_name IN (SELECT name FROM public.contacts WHERE id = v_contact_id)
        OR patient_phone IN (SELECT phone FROM public.contacts WHERE id = v_contact_id)
      );
    IF v_appt_count = 0 THEN
      RAISE EXCEPTION 'Transition to BOOKED requires an associated appointment record' USING ERRCODE = 'P0004';
    END IF;
  END IF;

  -- Update Deal Stage
  UPDATE public.deals
  SET stage = p_next_stage,
      updated_at = NOW()
  WHERE id = p_lead_id AND account_id = p_account_id;

  -- Insert Stage History
  INSERT INTO public.lead_stage_history (
    account_id, lead_id, previous_stage, next_stage, reason, source, actor_type, actor_id
  ) VALUES (
    p_account_id, p_lead_id, v_current_stage, p_next_stage, p_reason, p_source, p_actor_type, p_actor_id
  );

  -- Insert Audit Log
  INSERT INTO public.audit_logs (
    account_id, actor_id, action, resource_type, resource_id, metadata
  ) VALUES (
    p_account_id, COALESCE(p_actor_id, p_account_id), 'lead.stage_changed', 'deals', p_lead_id::text,
    jsonb_build_object('previous_stage', v_current_stage, 'next_stage', p_next_stage, 'reason', p_reason, 'source', p_source)
  );

  v_result := jsonb_build_object(
    'success', true,
    'lead_id', p_lead_id,
    'previous_stage', v_current_stage,
    'next_stage', p_next_stage
  );

  -- Record Idempotency Key if provided
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    INSERT INTO public.idempotency_keys (
      account_id, scope, key, status, resource_type, resource_id, response, expires_at
    ) VALUES (
      p_account_id, 'lead_transition', p_idempotency_key, 'completed', 'deals', p_lead_id::text, v_result, NOW() + INTERVAL '24 hours'
    ) ON CONFLICT (account_id, scope, key) DO UPDATE SET response = EXCLUDED.response, status = 'completed';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_lead_atomic TO service_role, authenticated;
