-- ============================================================
-- 030_saas_usage_triggers
--
-- Adds triggers to automatically enforce subscription limits on:
--   - Contact insertions (max_contacts)
--   - Profile insertions (max_users)
-- And automatically track usage of outgoing WhatsApp messages (whatsapp_messages).
-- ============================================================

-- 1. Enforce Contacts Plan Limit Trigger
CREATE OR REPLACE FUNCTION enforce_contacts_plan_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_limit INT;
  v_count INT;
BEGIN
  -- Get plan limit
  SELECT p.max_contacts INTO v_limit
  FROM subscriptions s
  JOIN plans p ON s.plan_id = p.id
  WHERE s.account_id = NEW.account_id AND s.status = 'active' OR s.status = 'trial';
  
  -- If no subscription is active, default to Trial limit
  IF v_limit IS NULL THEN
    SELECT max_contacts INTO v_limit FROM plans WHERE name = 'Free Trial' LIMIT 1;
  END IF;

  IF v_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM contacts WHERE account_id = NEW.account_id;
    IF v_count >= v_limit THEN
      RAISE EXCEPTION 'Plan contact limit of % exceeded. Please upgrade your subscription.', v_limit;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_contacts_plan_limit ON contacts;
CREATE TRIGGER trg_enforce_contacts_plan_limit
BEFORE INSERT ON contacts
FOR EACH ROW EXECUTE FUNCTION enforce_contacts_plan_limit();


-- 2. Enforce Profiles/Users Plan Limit Trigger
CREATE OR REPLACE FUNCTION enforce_profiles_plan_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_limit INT;
  v_count INT;
BEGIN
  -- Get plan limit
  SELECT p.max_users INTO v_limit
  FROM subscriptions s
  JOIN plans p ON s.plan_id = p.id
  WHERE s.account_id = NEW.account_id AND s.status = 'active' OR s.status = 'trial';
  
  -- If no subscription is active, default to Trial limit
  IF v_limit IS NULL THEN
    SELECT max_users INTO v_limit FROM plans WHERE name = 'Free Trial' LIMIT 1;
  END IF;

  IF v_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM profiles WHERE account_id = NEW.account_id;
    IF v_count >= v_limit THEN
      RAISE EXCEPTION 'Plan team member limit of % exceeded. Please upgrade your subscription.', v_limit;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_profiles_plan_limit ON profiles;
CREATE TRIGGER trg_enforce_profiles_plan_limit
BEFORE INSERT ON profiles
FOR EACH ROW EXECUTE FUNCTION enforce_profiles_plan_limit();


-- 3. Track WhatsApp Message Usage Trigger
CREATE OR REPLACE FUNCTION track_whatsapp_message_usage()
RETURNS TRIGGER AS $$
DECLARE
  v_account_id UUID;
  v_month DATE;
BEGIN
  IF NEW.sender_type IN ('bot', 'agent') THEN
    SELECT account_id INTO v_account_id FROM conversations WHERE id = NEW.conversation_id;
    IF v_account_id IS NOT NULL THEN
      v_month := DATE_TRUNC('month', CURRENT_DATE)::DATE;
      
      INSERT INTO usage_tracking (account_id, month, whatsapp_messages)
      VALUES (v_account_id, v_month, 1)
      ON CONFLICT (account_id, month) DO UPDATE
      SET whatsapp_messages = usage_tracking.whatsapp_messages + 1,
          updated_at = NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_track_whatsapp_message_usage ON messages;
CREATE TRIGGER trg_track_whatsapp_message_usage
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION track_whatsapp_message_usage();
