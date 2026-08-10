-- ============================================================
-- 028_saas_multi_tenant
--
-- Create plans, subscriptions, knowledge_base, and usage_tracking tables.
-- Establish RLS policies and utility helper functions.
-- ============================================================

-- 1. Create SaaS Plans Table
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  monthly_price INT NOT NULL DEFAULT 0, -- in cents
  yearly_price INT NOT NULL DEFAULT 0,  -- in cents
  max_users INT NOT NULL DEFAULT 5,
  max_contacts INT NOT NULL DEFAULT 500,
  max_whatsapp_numbers INT NOT NULL DEFAULT 1,
  max_ai_requests INT NOT NULL DEFAULT 100,
  features JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create Subscriptions Table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status_enum') THEN
    CREATE TYPE subscription_status_enum AS ENUM ('trial', 'active', 'expired', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE UNIQUE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  status subscription_status_enum NOT NULL DEFAULT 'trial',
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Extend Profiles Table for Super Admin access
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. Create Knowledge Base Table for Tenant context
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('faq', 'service', 'pricing', 'policy', 'company')),
  question_title TEXT NOT NULL,
  answer_content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast tenant context lookups
CREATE INDEX IF NOT EXISTS idx_kb_account_category ON knowledge_base(account_id, category);

-- 5. Create Usage Tracking Table
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  month DATE NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE)::DATE,
  ai_requests INT NOT NULL DEFAULT 0,
  ai_tokens INT NOT NULL DEFAULT 0,
  whatsapp_messages INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, month)
);

-- 6. Create PL/pgSQL function to increment metrics atomically
CREATE OR REPLACE FUNCTION increment_usage_metric(
  p_account_id UUID,
  p_month DATE,
  p_metric TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO usage_tracking (account_id, month, ai_requests, whatsapp_messages)
  VALUES (p_account_id, p_month, 
    CASE WHEN p_metric = 'ai_requests' THEN 1 ELSE 0 END,
    CASE WHEN p_metric = 'whatsapp_messages' THEN 1 ELSE 0 END
  )
  ON CONFLICT (account_id, month) DO UPDATE
  SET 
    ai_requests = usage_tracking.ai_requests + CASE WHEN p_metric = 'ai_requests' THEN 1 ELSE 0 END,
    whatsapp_messages = usage_tracking.whatsapp_messages + CASE WHEN p_metric = 'whatsapp_messages' THEN 1 ELSE 0 END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Enable RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- 8. Plans policies
DROP POLICY IF EXISTS "Anyone can view plans" ON plans;
CREATE POLICY "Anyone can view plans"
  ON plans FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Super admins can manage plans" ON plans;
CREATE POLICY "Super admins can manage plans"
  ON plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_super_admin = true
    )
  );

-- 9. Subscriptions policies
DROP POLICY IF EXISTS "Users can view their account subscription" ON subscriptions;
CREATE POLICY "Users can view their account subscription"
  ON subscriptions FOR SELECT
  USING (is_account_member(account_id, 'viewer'));

DROP POLICY IF EXISTS "Super admins can manage subscriptions" ON subscriptions;
CREATE POLICY "Super admins can manage subscriptions"
  ON subscriptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_super_admin = true
    )
  );

-- 10. Knowledge Base policies
DROP POLICY IF EXISTS "Users can read their account knowledge base" ON knowledge_base;
CREATE POLICY "Users can read their account knowledge base"
  ON knowledge_base FOR SELECT
  USING (is_account_member(account_id, 'viewer'));

DROP POLICY IF EXISTS "Agents can manage knowledge base" ON knowledge_base;
CREATE POLICY "Agents can manage knowledge base"
  ON knowledge_base FOR ALL
  USING (is_account_member(account_id, 'agent'));

-- 11. Usage Tracking policies
DROP POLICY IF EXISTS "Users can view their account usage" ON usage_tracking;
CREATE POLICY "Users can view their account usage"
  ON usage_tracking FOR SELECT
  USING (is_account_member(account_id, 'viewer'));

DROP POLICY IF EXISTS "Super admins can manage usage tracking" ON usage_tracking;
CREATE POLICY "Super admins can manage usage tracking"
  ON usage_tracking FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_super_admin = true
    )
  );
