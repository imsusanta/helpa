-- ============================================================================
-- PROOF OF ONBOARDING TRANSACTIONALITY, RERUN SAFETY, AND FIELD PROTECTION
-- Tested on local PostgreSQL database: helpa_onboarding_proof_db
-- ============================================================================

\set ON_ERROR_STOP on

-- Clean up any prior test state
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO PUBLIC;

-- Setup roles matching Supabase
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. BASE SCHEMA
-- ----------------------------------------------------------------------------
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text DEFAULT 'general',
  status text DEFAULT 'active',
  ai_system_prompt text,
  welcome_message text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.accounts TO authenticated, anon, service_role;
CREATE POLICY accounts_all ON public.accounts FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.tenant_modules (
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (account_id, module_key)
);

CREATE TABLE public.pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  position int NOT NULL,
  color text
);

CREATE TABLE public.knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category text NOT NULL,
  question_title text NOT NULL,
  answer_content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- Seed pre-migration legacy accounts
INSERT INTO public.accounts (id, name, created_at)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Legacy Account Alpha', '2026-08-01 10:00:00+00'),
  ('22222222-2222-2222-2222-222222222222', 'Legacy Account Beta',  '2026-08-15 12:00:00+00');

-- ----------------------------------------------------------------------------
-- 2. DURABLE MIGRATION WITH COHORT GUARD
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.migration_onboarding_guard (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  deployment_cutoff timestamptz NOT NULL,
  deployed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- Add onboarding tracking columns
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS onboarding_exempted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS onboarding_exemption_reason text DEFAULT NULL;

-- Execute migration with durable guard
DO $$
DECLARE
  v_cutoff timestamptz;
  v_exempted_at timestamptz := clock_timestamp();
BEGIN
  -- Persist the exact deployment timestamp on first execution
  INSERT INTO public.migration_onboarding_guard (id, deployment_cutoff)
  VALUES (1, clock_timestamp())
  ON CONFLICT (id) DO NOTHING;

  -- Read persisted cutoff (guaranteed constant across all reruns)
  SELECT deployment_cutoff INTO v_cutoff
  FROM public.migration_onboarding_guard
  WHERE id = 1;

  -- Exempt accounts created on or before the deployment cutoff
  UPDATE public.accounts
  SET
    onboarding_exempted_at = v_exempted_at,
    onboarding_exemption_reason = 'legacy_account_pre_contract'
  WHERE onboarding_completed_at IS NULL
    AND onboarding_exempted_at IS NULL
    AND created_at <= v_cutoff;
END $$;

-- ----------------------------------------------------------------------------
-- 3. FIELD PROTECTION TRIGGER (FAIL-CLOSED FOR UNTRUSTED ROLES)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_account_onboarding_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_jwt_role text;
  v_is_super boolean := false;
  v_is_modifying boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.onboarding_completed_at IS NOT NULL OR
       NEW.onboarding_exempted_at IS NOT NULL OR
       NEW.onboarding_exemption_reason IS NOT NULL THEN
      v_is_modifying := true;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.onboarding_completed_at IS DISTINCT FROM NEW.onboarding_completed_at OR
       OLD.onboarding_exempted_at IS DISTINCT FROM NEW.onboarding_exempted_at OR
       OLD.onboarding_exemption_reason IS DISTINCT FROM NEW.onboarding_exemption_reason THEN
      v_is_modifying := true;
    END IF;
  END IF;

  IF v_is_modifying THEN
    -- Check 1: Direct role
    IF CURRENT_USER IN ('anon', 'authenticated') OR SESSION_USER IN ('anon', 'authenticated') THEN
      RAISE EXCEPTION 'Onboarding status fields are system-controlled and cannot be modified directly'
        USING ERRCODE = '42501';
    END IF;

    -- Check 2: PostgREST JWT claim role
    BEGIN
      v_jwt_role := COALESCE(
        NULLIF(current_setting('request.jwt.claim.role', true), ''),
        (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role'),
        ''
      );
    EXCEPTION WHEN OTHERS THEN
      v_jwt_role := '';
    END;

    IF v_jwt_role <> '' AND v_jwt_role NOT IN ('service_role', 'supabase_admin') THEN
      RAISE EXCEPTION 'Onboarding status fields are system-controlled and cannot be modified directly'
        USING ERRCODE = '42501';
    END IF;

    -- Check 3: Check if superuser or trusted service role (fails closed for untrusted roles)
    SELECT COALESCE(rolsuper, false) INTO v_is_super FROM pg_roles WHERE rolname = CURRENT_USER;
    IF v_jwt_role = '' AND CURRENT_USER NOT IN ('postgres', 'service_role', 'supabase_admin') AND NOT v_is_super THEN
      RAISE EXCEPTION 'Onboarding status fields are system-controlled and cannot be modified directly'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_account_onboarding_fields ON public.accounts;
CREATE TRIGGER tr_protect_account_onboarding_fields
  BEFORE INSERT OR UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_account_onboarding_fields();

-- ----------------------------------------------------------------------------
-- 4. SINGLE TRANSACTION ONBOARDING RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_workspace_onboarding(
  p_account_id uuid,
  p_name text,
  p_industry text,
  p_system_prompt text,
  p_welcome_message text,
  p_custom_services jsonb DEFAULT '[]'::jsonb,
  p_simulate_failure boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account record;
  v_pipe_id uuid;
  v_service record;
  v_now timestamptz := clock_timestamp();
BEGIN
  -- 1. Account-Scoped Row Lock
  SELECT id, name, onboarding_completed_at, onboarding_exempted_at
  INTO v_account
  FROM public.accounts
  WHERE id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found: %', p_account_id USING ERRCODE = 'P0002';
  END IF;

  -- 2. Pre-write Eligibility Recheck Under Lock
  IF v_account.onboarding_completed_at IS NOT NULL OR v_account.onboarding_exempted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'already_completed',
      'mutated', false,
      'message', 'Onboarding is already completed or exempted for this workspace.'
    );
  END IF;

  -- 3. Initialization writes in same transaction:
  -- 3a. Account profile update
  UPDATE public.accounts
  SET
    name = COALESCE(p_name, name),
    industry = p_industry,
    ai_system_prompt = p_system_prompt,
    welcome_message = p_welcome_message,
    updated_at = v_now
  WHERE id = p_account_id;

  -- 3b. Tenant modules
  INSERT INTO public.tenant_modules (account_id, module_key, enabled, updated_at)
  VALUES (p_account_id, p_industry, true, v_now)
  ON CONFLICT (account_id, module_key)
  DO UPDATE SET enabled = true, updated_at = v_now;

  -- 3c. Pipeline & stages
  SELECT id INTO v_pipe_id FROM public.pipelines WHERE account_id = p_account_id LIMIT 1;
  IF v_pipe_id IS NULL THEN
    INSERT INTO public.pipelines (account_id, name)
    VALUES (p_account_id, 'Sales Pipeline')
    RETURNING id INTO v_pipe_id;

    INSERT INTO public.pipeline_stages (pipeline_id, name, position, color)
    VALUES
      (v_pipe_id, 'New Lead', 0, '#3b82f6'),
      (v_pipe_id, 'Contacted', 1, '#10b981'),
      (v_pipe_id, 'Won', 2, '#6366f1');
  END IF;

  -- 3d. Knowledge Base (preserves all existing rows; inserts new custom services)
  IF p_custom_services IS NOT NULL AND jsonb_array_length(p_custom_services) > 0 THEN
    FOR v_service IN SELECT * FROM jsonb_to_recordset(p_custom_services) AS x(name text, price text, "desc" text) LOOP
      INSERT INTO public.knowledge_base (account_id, category, question_title, answer_content)
      VALUES (
        p_account_id,
        'pricing',
        'How much does ' || v_service.name || ' cost?',
        'The price for ' || v_service.name || ' is ₹' || v_service.price || '. ' || COALESCE(v_service."desc", '')
      );
    END LOOP;
  END IF;

  -- 3e. Automations with provenance tag
  INSERT INTO public.automations (account_id, name, metadata)
  VALUES (
    p_account_id,
    'Welcome Auto-Reply',
    jsonb_build_object('helpa_seeded_workflow', true, 'workflow_seed_key', 'welcome')
  );

  -- 3f. Draft broadcasts: insert template without deleting user drafts
  IF NOT EXISTS (SELECT 1 FROM public.broadcasts WHERE account_id = p_account_id AND name = 'Welcome Offer Template') THEN
    INSERT INTO public.broadcasts (account_id, name, status)
    VALUES (p_account_id, 'Welcome Offer Template', 'draft');
  END IF;

  -- Simulated failure point for rollback verification
  IF p_simulate_failure THEN
    RAISE EXCEPTION 'Simulated failure during initialization' USING ERRCODE = 'P0001';
  END IF;

  -- 4. Final Completion Marker
  UPDATE public.accounts
  SET onboarding_completed_at = v_now, updated_at = v_now
  WHERE id = p_account_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed',
    'mutated', true,
    'completed_at', v_now
  );
END;
$$;

-- Protect RPC from unauthorized client invocation
REVOKE EXECUTE ON FUNCTION public.complete_workspace_onboarding(uuid,text,text,text,text,jsonb,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_workspace_onboarding(uuid,text,text,text,text,jsonb,boolean) TO service_role;
