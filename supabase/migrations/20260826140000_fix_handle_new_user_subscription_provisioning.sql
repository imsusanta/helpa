-- ============================================================
-- Fix handle_new_user: subscription provisioning matched a schema
-- that does not exist, orphaning every new auth user.
--
-- The deployed trigger function inserted into public.subscriptions
-- using a column named current_period_end and a status value of
-- 'trialing'. The real table has end_date (NOT NULL) and a
-- subscription_status_enum of ('trial','active','expired',
-- 'cancelled'). The insert raised 42703, and because the function's
-- single EXCEPTION block covers the whole body, PL/pgSQL rolled back
-- the already-completed account, profile, and account_members
-- inserts too. Signup itself still returned success (the handler
-- swallows the error with RAISE WARNING), so every new production
-- signup produced an auth.users row with no workspace at all.
--
-- Two changes:
--   1. The subscriptions insert uses the real columns and enum
--      label: (account_id, plan_id, status, end_date) with 'trial'
--      and a 14-day window.
--   2. Subscription provisioning is isolated in its own nested
--      BEGIN/EXCEPTION block, so any future billing-schema drift can
--      degrade only the trial subscription, never the core
--      account/profile/membership bootstrap.
--
-- Idempotent: CREATE OR REPLACE, safe to run repeatedly.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_full_name TEXT;
  v_industry TEXT;
  v_account_id UUID;
  v_plan_id UUID;
BEGIN
  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    split_part(COALESCE(NEW.email, 'user'), '@', 1)
  );
  v_industry := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'industry'), ''),
    'hospital_clinic'
  );

  -- Create Default Account
  INSERT INTO public.accounts (name, owner_user_id, industry)
  VALUES (COALESCE(v_full_name || ' Workspace', 'My Workspace'), NEW.id, v_industry)
  RETURNING id INTO v_account_id;

  -- Create Profile
  INSERT INTO public.profiles (user_id, full_name, email, account_id, role, account_role, is_super_admin)
  VALUES (NEW.id, v_full_name, COALESCE(NEW.email, ''), v_account_id, 'owner', 'owner', false)
  ON CONFLICT (user_id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      account_id = COALESCE(public.profiles.account_id, EXCLUDED.account_id),
      role = COALESCE(public.profiles.role, EXCLUDED.role),
      account_role = COALESCE(public.profiles.account_role, EXCLUDED.account_role);

  -- Create Account Member as owner
  INSERT INTO public.account_members (account_id, user_id, role, active)
  VALUES (v_account_id, NEW.id, 'owner', true)
  ON CONFLICT (account_id, user_id) DO NOTHING;

  -- Provision Default Free Trial Subscription. Isolated in its own
  -- block: subscriptions schema drift must never roll back the core
  -- account/profile/membership bootstrap above.
  BEGIN
    SELECT id INTO v_plan_id FROM public.plans WHERE name = 'Free Trial' LIMIT 1;
    IF v_plan_id IS NOT NULL THEN
      INSERT INTO public.subscriptions (account_id, plan_id, status, end_date)
      VALUES (v_account_id, v_plan_id, 'trial', NOW() + INTERVAL '14 days')
      ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user subscription provisioning failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user bootstrap failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Recreate the trigger idempotently (matches the deployed definition).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
