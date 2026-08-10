-- ============================================================
-- 029_saas_default_plans
--
-- Populates plans table with default SaaS plans and modifies
-- the signup trigger public.handle_new_user() to automatically
-- provision a 14-day Free Trial subscription.
-- ============================================================

-- 1. Populate default plans
INSERT INTO plans (name, monthly_price, yearly_price, max_users, max_contacts, max_whatsapp_numbers, max_ai_requests, features)
VALUES 
  ('Free Trial', 0, 0, 3, 100, 1, 50, '["ai_chat", "pipelines", "automations"]'),
  ('Growth', 2900, 29000, 10, 2000, 3, 1000, '["ai_chat", "pipelines", "automations", "broadcasts"]'),
  ('Enterprise', 9900, 99000, 9999, 999999, 10, 50000, '["ai_chat", "pipelines", "automations", "broadcasts", "flows"]')
ON CONFLICT (name) DO NOTHING;

-- 2. Update public.handle_new_user() trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_account_id UUID;
  v_plan_id UUID;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  -- Create Tenant Account
  INSERT INTO public.accounts (name, owner_user_id)
  VALUES (COALESCE(NULLIF(v_full_name, ''), NEW.email, 'My account'), NEW.id)
  RETURNING id INTO v_account_id;

  -- Create Profile Linked to Account
  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner');

  -- Provision Default Free Trial Subscription
  SELECT id INTO v_plan_id FROM public.plans WHERE name = 'Free Trial' LIMIT 1;
  IF v_plan_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (account_id, plan_id, status, end_date)
    VALUES (v_account_id, v_plan_id, 'trial', NOW() + INTERVAL '14 days');
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account/profile/subscription for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
