-- Migration: 20260825130000_auth_account_columns_and_triggers.sql
-- Purpose: Complete accounts/profiles columns and auth bootstrap trigger.

BEGIN;

-- 1. Accounts columns
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS industry TEXT DEFAULT 'hospital_clinic',
  ADD COLUMN IF NOT EXISTS logo TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS ai_system_prompt TEXT;

-- 2. Profiles columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS account_role TEXT DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- 3. Trigger Function on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_full_name TEXT;
  v_industry TEXT;
  v_account_id UUID;
  v_plan_id UUID;
BEGIN
  v_full_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''), split_part(COALESCE(NEW.email, 'user'), '@', 1));
  v_industry := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'industry'), ''), 'hospital_clinic');

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

  -- Provision Default Free Trial Subscription
  SELECT id INTO v_plan_id FROM public.plans WHERE name = 'Free Trial' LIMIT 1;
  IF v_plan_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (account_id, plan_id, status, current_period_end)
    VALUES (v_account_id, v_plan_id, 'trialing', NOW() + INTERVAL '14 days')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user bootstrap failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMIT
