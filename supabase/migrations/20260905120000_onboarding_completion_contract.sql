-- ============================================================================
-- 20260905120000_onboarding_completion_contract.sql
-- Onboarding completion contract, durable cohort guard, fail-closed field protection,
-- and single-transaction initialization RPC.
-- ============================================================================

-- 1. Durable Migration Guard Table
-- Captures the exact deployment timestamp on first execution.
CREATE TABLE IF NOT EXISTS public.migration_onboarding_guard (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  deployment_cutoff timestamptz NOT NULL,
  deployed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.migration_onboarding_guard ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.migration_onboarding_guard FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.migration_onboarding_guard TO service_role;

-- 2. Add Onboarding Tracking Columns to Accounts
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS onboarding_exempted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS onboarding_exemption_reason text DEFAULT NULL;

-- 3. One-Time Legacy Cohort Exemption with Durable Guard
DO $$
DECLARE
  v_cutoff timestamptz;
  v_exempted_at timestamptz := clock_timestamp();
BEGIN
  -- Capture deployment cutoff timestamp once on first run
  INSERT INTO public.migration_onboarding_guard (id, deployment_cutoff)
  VALUES (1, clock_timestamp())
  ON CONFLICT (id) DO NOTHING;

  -- Read persisted cutoff timestamp (guaranteed immutable on reruns)
  SELECT deployment_cutoff INTO v_cutoff
  FROM public.migration_onboarding_guard
  WHERE id = 1;

  -- Exempt legacy accounts created on or before the deployment cutoff
  UPDATE public.accounts
  SET
    onboarding_exempted_at = v_exempted_at,
    onboarding_exemption_reason = 'legacy_account_pre_contract'
  WHERE onboarding_completed_at IS NULL
    AND onboarding_exempted_at IS NULL
    AND created_at <= v_cutoff;
END $$;

-- 4. Fail-Closed Field Protection Trigger (BEFORE INSERT OR UPDATE)
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
    -- Check 1: Direct SQL connection role
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

    -- Check 3: Check if superuser or trusted backend service role (fails closed for untrusted roles)
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

-- 5. Single-Transaction Atomic Onboarding RPC
DROP FUNCTION IF EXISTS public.complete_workspace_onboarding(uuid,uuid,text,text,text,text,text,text[],jsonb,jsonb,jsonb,jsonb);
CREATE OR REPLACE FUNCTION public.complete_workspace_onboarding(
  p_account_id uuid,
  p_user_id uuid,
  p_industry text,
  p_workspace_name text DEFAULT NULL,
  p_logo text DEFAULT NULL,
  p_ai_system_prompt text DEFAULT NULL,
  p_welcome_message text DEFAULT NULL,
  p_all_known_modules text[] DEFAULT ARRAY['hospital_clinic', 'real_estate', 'travel', 'coaching', 'restaurant', 'gym', 'solo_teacher', 'salon']::text[],
  p_pipeline_stages jsonb DEFAULT '[]'::jsonb,
  p_kb_items jsonb DEFAULT '[]'::jsonb,
  p_campaigns jsonb DEFAULT '[]'::jsonb,
  p_workflows jsonb DEFAULT '[]'::jsonb,
  p_reconfigure boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account record;
  v_now timestamptz := clock_timestamp();
  v_pipe_id uuid;
  v_mod text;
  v_item record;
  v_wf record;
  v_step record;
  v_auto_id uuid;
  v_seeded_auto_ids uuid[];
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
    IF NOT p_reconfigure THEN
      RETURN jsonb_build_object(
        'success', true,
        'status', 'already_completed',
        'mutated', false,
        'industry', p_industry,
        'message', 'Onboarding is already completed or exempted for this workspace.'
      );
    END IF;
  END IF;

  -- 3. Update Account profile (Preserves operational/billing status untouched)
  UPDATE public.accounts
  SET
    name = COALESCE(NULLIF(p_workspace_name, ''), name),
    logo = COALESCE(NULLIF(p_logo, ''), logo),
    industry = p_industry,
    ai_system_prompt = COALESCE(p_ai_system_prompt, ai_system_prompt),
    welcome_message = COALESCE(p_welcome_message, welcome_message),
    updated_at = v_now
  WHERE id = p_account_id;

  -- 4. Upsert Tenant Modules
  IF p_all_known_modules IS NOT NULL AND array_length(p_all_known_modules, 1) > 0 THEN
    FOREACH v_mod IN ARRAY p_all_known_modules LOOP
      INSERT INTO public.tenant_modules (account_id, module_key, enabled, settings, updated_at)
      VALUES (p_account_id, v_mod, (v_mod = p_industry), '{}'::jsonb, v_now)
      ON CONFLICT (account_id, module_key)
      DO UPDATE SET
        enabled = (v_mod = p_industry),
        updated_at = v_now;
    END LOOP;
  END IF;

  -- 5. Primary Pipeline and Stages
  SELECT id INTO v_pipe_id
  FROM public.pipelines
  WHERE account_id = p_account_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_pipe_id IS NULL THEN
    INSERT INTO public.pipelines (account_id, user_id, name)
    VALUES (p_account_id, p_user_id, 'Sales Pipeline')
    RETURNING id INTO v_pipe_id;
  END IF;

  -- Insert stages if pipeline has no stages yet
  IF NOT EXISTS (SELECT 1 FROM public.pipeline_stages WHERE pipeline_id = v_pipe_id) THEN
    IF p_pipeline_stages IS NOT NULL AND jsonb_array_length(p_pipeline_stages) > 0 THEN
      FOR v_item IN SELECT * FROM jsonb_to_recordset(p_pipeline_stages) AS x(name text, position int, color text) LOOP
        INSERT INTO public.pipeline_stages (pipeline_id, name, position, color)
        VALUES (v_pipe_id, v_item.name, COALESCE(v_item.position, 0), COALESCE(v_item.color, '#3b82f6'));
      END LOOP;
    ELSE
      INSERT INTO public.pipeline_stages (pipeline_id, name, position, color)
      VALUES
        (v_pipe_id, 'New Lead', 0, '#3b82f6'),
        (v_pipe_id, 'Contacted', 1, '#10b981'),
        (v_pipe_id, 'Won', 2, '#6366f1');
    END IF;
  END IF;

  -- 6. Knowledge Base: insert items without colliding with existing titles
  IF p_kb_items IS NOT NULL AND jsonb_array_length(p_kb_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_kb_items) AS x(category text, question_title text, answer_content text) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.knowledge_base
        WHERE account_id = p_account_id AND question_title = v_item.question_title
      ) THEN
        INSERT INTO public.knowledge_base (account_id, category, question_title, answer_content, created_at, updated_at)
        VALUES (p_account_id, v_item.category, v_item.question_title, v_item.answer_content, v_now, v_now);
      END IF;
    END LOOP;
  END IF;

  -- 7. Campaign Templates: insert without overwriting or deleting user draft broadcasts
  IF p_campaigns IS NOT NULL AND jsonb_array_length(p_campaigns) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_campaigns) AS x(
      name text, category text, message_body text, cta_type text, cta_text text, cta_url text, attachment_url text, attachment_type text
    ) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.broadcasts
        WHERE account_id = p_account_id AND name = v_item.name
      ) THEN
        INSERT INTO public.broadcasts (
          account_id, user_id, name, template_name, template_language, status,
          category, message_body, cta_type, cta_text, cta_url, attachment_url, attachment_type,
          created_at, updated_at
        )
        VALUES (
          p_account_id, p_user_id, v_item.name, 'custom_campaign', 'en_US', 'draft',
          v_item.category, v_item.message_body, COALESCE(v_item.cta_type, 'none'), v_item.cta_text, v_item.cta_url,
          v_item.attachment_url, v_item.attachment_type, v_now, v_now
        );
      END IF;
    END LOOP;
  END IF;

  -- 8. Workflow Automations:
  -- Only clean up previously seeded workflows for this account (never user-created)
  SELECT array_agg(id) INTO v_seeded_auto_ids
  FROM public.automations
  WHERE account_id = p_account_id
    AND metadata->>'helpa_seeded_workflow' = 'true';

  IF v_seeded_auto_ids IS NOT NULL AND array_length(v_seeded_auto_ids, 1) > 0 THEN
    DELETE FROM public.automation_steps WHERE automation_id = ANY(v_seeded_auto_ids);
    DELETE FROM public.automations WHERE id = ANY(v_seeded_auto_ids);
  END IF;

  -- Insert new workflows and steps
  IF p_workflows IS NOT NULL AND jsonb_array_length(p_workflows) > 0 THEN
    FOR v_wf IN SELECT * FROM jsonb_to_recordset(p_workflows) AS x(
      name text, description text, trigger_type text, trigger_config jsonb, is_active boolean, seed_key text, steps jsonb
    ) LOOP
      INSERT INTO public.automations (
        account_id, user_id, name, description, trigger_type, trigger_config, is_active, metadata, created_at, updated_at
      )
      VALUES (
        p_account_id, p_user_id, v_wf.name, v_wf.description, v_wf.trigger_type,
        COALESCE(v_wf.trigger_config, '{}'::jsonb), COALESCE(v_wf.is_active, false),
        jsonb_build_object(
          'helpa_seeded_workflow', true,
          'workflow_seed_key', v_wf.seed_key,
          'workflow_industry', p_industry
        ),
        v_now, v_now
      )
      RETURNING id INTO v_auto_id;

      IF v_wf.steps IS NOT NULL AND jsonb_array_length(v_wf.steps) > 0 THEN
        FOR v_step IN SELECT * FROM jsonb_to_recordset(v_wf.steps) AS s(
          id uuid, parent_step_id uuid, branch text, step_type text, step_config jsonb, position int
        ) LOOP
          INSERT INTO public.automation_steps (
            id, automation_id, parent_step_id, branch, step_type, step_config, position, created_at
          )
          VALUES (
            COALESCE(v_step.id, gen_random_uuid()),
            v_auto_id,
            v_step.parent_step_id,
            v_step.branch,
            v_step.step_type,
            COALESCE(v_step.step_config, '{}'::jsonb),
            COALESCE(v_step.position, 0),
            v_now
          );
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- 9. Final Completion Marker (preserves historical timestamp if already completed)
  UPDATE public.accounts
  SET
    onboarding_completed_at = COALESCE(onboarding_completed_at, v_now),
    updated_at = v_now
  WHERE id = p_account_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', CASE WHEN p_reconfigure THEN 'reconfigured' ELSE 'completed' END,
    'mutated', true,
    'industry', p_industry,
    'completed_at', COALESCE(v_account.onboarding_completed_at, v_now)
  );
END;
$$;

-- Protect RPC from unauthorized client invocation
REVOKE EXECUTE ON FUNCTION public.complete_workspace_onboarding(uuid,uuid,text,text,text,text,text,text[],jsonb,jsonb,jsonb,jsonb,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_workspace_onboarding(uuid,uuid,text,text,text,text,text,text[],jsonb,jsonb,jsonb,jsonb,boolean) TO service_role;
