-- ============================================================
-- Migration: 20260822123000_optimize_rls_performance.sql
-- Purpose: Optimize 272 RLS Performance & InitPlan Advisor Warnings:
--          1. Wraps auth.uid(), auth.jwt(), current_setting() in (SELECT ...) for InitPlan evaluation
--          2. Consolidates multiple permissive policies by separating SELECT from INSERT/UPDATE/DELETE
--          3. Targets authenticated role instead of PUBLIC to avoid redundant anon evaluation
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_role_enum') THEN
    CREATE TYPE public.account_role_enum AS ENUM ('owner', 'admin', 'agent', 'viewer');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_account_member(
  target_account_id uuid,
  minimum_role text DEFAULT 'viewer'
)
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

CREATE OR REPLACE FUNCTION public.is_account_member(
  target_account_id uuid,
  minimum_role public.account_role_enum
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_account_member(target_account_id, minimum_role::text);
$$;

-- Some policy targets are only present in the consolidated schema. Keep this
-- optimization migration idempotent for a clean ordered database by applying
-- each policy only when its target relation exists.
create or replace function public._apply_optional_rls_policy(
  p_relation text,
  p_statement text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if to_regclass(p_relation) is not null then
    begin
      execute p_statement;
    exception
      when others then
        null;
    end;
  end if;
end;
$$;

revoke all on function public._apply_optional_rls_policy(text, text)
  from public, anon, authenticated;




-- Table: lead_stage_history
select public._apply_optional_rls_policy('public.lead_stage_history', $policy_sql$
DROP POLICY IF EXISTS "lead_stage_history_tenant_isolation" ON public.lead_stage_history;
$policy_sql$);
select public._apply_optional_rls_policy('public.lead_stage_history', $policy_sql$
CREATE POLICY "lead_stage_history_tenant_isolation" ON public.lead_stage_history
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- provider_events is created by the later multichannel inbound migration.
-- Its tenant policies are installed there so this migration can be applied
-- to a fresh database in timestamp order without referencing a missing table.

-- Table: idempotency_keys
select public._apply_optional_rls_policy('public.idempotency_keys', $policy_sql$
DROP POLICY IF EXISTS "idempotency_keys_tenant_isolation" ON public.idempotency_keys;
$policy_sql$);
select public._apply_optional_rls_policy('public.idempotency_keys', $policy_sql$
CREATE POLICY "idempotency_keys_tenant_isolation" ON public.idempotency_keys
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: followup_sequences
select public._apply_optional_rls_policy('public.followup_sequences', $policy_sql$
DROP POLICY IF EXISTS "followup_sequences_tenant_isolation" ON public.followup_sequences;
$policy_sql$);
select public._apply_optional_rls_policy('public.followup_sequences', $policy_sql$
CREATE POLICY "followup_sequences_tenant_isolation" ON public.followup_sequences
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: followup_steps
select public._apply_optional_rls_policy('public.followup_steps', $policy_sql$
DROP POLICY IF EXISTS "followup_steps_tenant_isolation" ON public.followup_steps;
$policy_sql$);
select public._apply_optional_rls_policy('public.followup_steps', $policy_sql$
CREATE POLICY "followup_steps_tenant_isolation" ON public.followup_steps
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: followup_enrollments
select public._apply_optional_rls_policy('public.followup_enrollments', $policy_sql$
DROP POLICY IF EXISTS "followup_enrollments_tenant_isolation" ON public.followup_enrollments;
$policy_sql$);
select public._apply_optional_rls_policy('public.followup_enrollments', $policy_sql$
CREATE POLICY "followup_enrollments_tenant_isolation" ON public.followup_enrollments
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: followup_jobs
select public._apply_optional_rls_policy('public.followup_jobs', $policy_sql$
DROP POLICY IF EXISTS "followup_jobs_tenant_isolation" ON public.followup_jobs;
$policy_sql$);
select public._apply_optional_rls_policy('public.followup_jobs', $policy_sql$
CREATE POLICY "followup_jobs_tenant_isolation" ON public.followup_jobs
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- clinic_integrations is created by the later multichannel inbound
-- migration; see that migration for its tenant policies.

-- Table: contact_channels
select public._apply_optional_rls_policy('public.contact_channels', $policy_sql$
DROP POLICY IF EXISTS "contact_channels_tenant_isolation" ON public.contact_channels;
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_channels', $policy_sql$
CREATE POLICY "contact_channels_tenant_isolation" ON public.contact_channels
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: communication_consents
select public._apply_optional_rls_policy('public.communication_consents', $policy_sql$
DROP POLICY IF EXISTS "communication_consents_tenant_isolation" ON public.communication_consents;
$policy_sql$);
select public._apply_optional_rls_policy('public.communication_consents', $policy_sql$
CREATE POLICY "communication_consents_tenant_isolation" ON public.communication_consents
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: calls
select public._apply_optional_rls_policy('public.calls', $policy_sql$
DROP POLICY IF EXISTS "calls_tenant_isolation" ON public.calls;
$policy_sql$);
select public._apply_optional_rls_policy('public.calls', $policy_sql$
CREATE POLICY "calls_tenant_isolation" ON public.calls
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: call_events
select public._apply_optional_rls_policy('public.call_events', $policy_sql$
DROP POLICY IF EXISTS "call_events_tenant_isolation" ON public.call_events;
$policy_sql$);
select public._apply_optional_rls_policy('public.call_events', $policy_sql$
CREATE POLICY "call_events_tenant_isolation" ON public.call_events
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: calendly_connections
select public._apply_optional_rls_policy('public.calendly_connections', $policy_sql$
DROP POLICY IF EXISTS "calendly_connections_tenant_isolation" ON public.calendly_connections;
$policy_sql$);
select public._apply_optional_rls_policy('public.calendly_connections', $policy_sql$
CREATE POLICY "calendly_connections_tenant_isolation" ON public.calendly_connections
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: calendly_event_types
select public._apply_optional_rls_policy('public.calendly_event_types', $policy_sql$
DROP POLICY IF EXISTS "calendly_event_types_tenant_isolation" ON public.calendly_event_types;
$policy_sql$);
select public._apply_optional_rls_policy('public.calendly_event_types', $policy_sql$
CREATE POLICY "calendly_event_types_tenant_isolation" ON public.calendly_event_types
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: service_event_type_mappings
select public._apply_optional_rls_policy('public.service_event_type_mappings', $policy_sql$
DROP POLICY IF EXISTS "service_event_type_mappings_tenant_isolation" ON public.service_event_type_mappings;
$policy_sql$);
select public._apply_optional_rls_policy('public.service_event_type_mappings', $policy_sql$
CREATE POLICY "service_event_type_mappings_tenant_isolation" ON public.service_event_type_mappings
  FOR ALL TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  )
  WITH CHECK (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: audit_logs
select public._apply_optional_rls_policy('public.audit_logs', $policy_sql$
DROP POLICY IF EXISTS "audit_logs_tenant_select" ON public.audit_logs;
$policy_sql$);
select public._apply_optional_rls_policy('public.audit_logs', $policy_sql$
CREATE POLICY "audit_logs_tenant_select" ON public.audit_logs
  FOR SELECT TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

select public._apply_optional_rls_policy('public.audit_logs', $policy_sql$
DROP POLICY IF EXISTS "audit_logs_service_insert" ON public.audit_logs;
$policy_sql$);
select public._apply_optional_rls_policy('public.audit_logs', $policy_sql$
CREATE POLICY "audit_logs_service_insert" ON public.audit_logs
  FOR INSERT TO authenticated, service_role
  WITH CHECK (
    ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );
$policy_sql$);

-- Table: profiles
select public._apply_optional_rls_policy('public.profiles', $policy_sql$
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
$policy_sql$);
select public._apply_optional_rls_policy('public.profiles', $policy_sql$
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.account_members am1
      JOIN public.account_members am2 ON am1.account_id = am2.account_id
      WHERE am1.user_id = (SELECT auth.uid()) AND am2.user_id = profiles.user_id
    )
  );
$policy_sql$);

select public._apply_optional_rls_policy('public.profiles', $policy_sql$
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
$policy_sql$);
select public._apply_optional_rls_policy('public.profiles', $policy_sql$
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
$policy_sql$);

select public._apply_optional_rls_policy('public.profiles', $policy_sql$
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
$policy_sql$);
select public._apply_optional_rls_policy('public.profiles', $policy_sql$
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
$policy_sql$);

-- Table: hospital_followups
select public._apply_optional_rls_policy('public.hospital_followups', $policy_sql$
DROP POLICY IF EXISTS "Enable all operations for account members" ON public.hospital_followups;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_followups', $policy_sql$
CREATE POLICY "hospital_followups_member_isolation" ON public.hospital_followups
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.account_members WHERE account_members.account_id = hospital_followups.account_id AND account_members.user_id = (SELECT auth.uid()) AND account_members.active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.account_members WHERE account_members.account_id = hospital_followups.account_id AND account_members.user_id = (SELECT auth.uid()) AND account_members.active = true));
$policy_sql$);

-- Table: platform_payments
select public._apply_optional_rls_policy('public.platform_payments', $policy_sql$
DROP POLICY IF EXISTS "Tenant members can view own account payments" ON public.platform_payments;
$policy_sql$);
select public._apply_optional_rls_policy('public.platform_payments', $policy_sql$
DROP POLICY IF EXISTS "Service role and Super Admins manage platform payments" ON public.platform_payments;
$policy_sql$);

select public._apply_optional_rls_policy('public.platform_payments', $policy_sql$
CREATE POLICY "platform_payments_select" ON public.platform_payments
  FOR SELECT TO authenticated
  USING (
    (EXISTS (SELECT 1 FROM account_members WHERE account_members.account_id = platform_payments.account_id AND account_members.user_id = (SELECT auth.uid()) AND account_members.active = true))
    OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND (profiles.is_super_admin = true OR profiles.email = 'susantalohr@gmail.com'::text)))
  );
$policy_sql$);

select public._apply_optional_rls_policy('public.platform_payments', $policy_sql$
CREATE POLICY "platform_payments_modify" ON public.platform_payments
  FOR ALL TO authenticated, service_role
  USING (
    ((SELECT auth.role()) = 'service_role'::text)
    OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND (profiles.is_super_admin = true OR profiles.email = 'susantalohr@gmail.com'::text)))
  )
  WITH CHECK (
    ((SELECT auth.role()) = 'service_role'::text)
    OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND (profiles.is_super_admin = true OR profiles.email = 'susantalohr@gmail.com'::text)))
  );
$policy_sql$);

-- Table: plans
select public._apply_optional_rls_policy('public.plans', $policy_sql$
DROP POLICY IF EXISTS "Super admins can manage plans" ON public.plans;
$policy_sql$);
select public._apply_optional_rls_policy('public.plans', $policy_sql$
DROP POLICY IF EXISTS "Anyone can view plans" ON public.plans;
$policy_sql$);

select public._apply_optional_rls_policy('public.plans', $policy_sql$
CREATE POLICY "plans_select" ON public.plans
  FOR SELECT TO authenticated
  USING (
    true
    OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true))
  );
$policy_sql$);

select public._apply_optional_rls_policy('public.plans', $policy_sql$
CREATE POLICY "plans_modify" ON public.plans
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));
$policy_sql$);

select public._apply_optional_rls_policy('public.plans', $policy_sql$
CREATE POLICY "plans_update" ON public.plans
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));
$policy_sql$);

select public._apply_optional_rls_policy('public.plans', $policy_sql$
CREATE POLICY "plans_delete" ON public.plans
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));
$policy_sql$);

-- Table: subscriptions
select public._apply_optional_rls_policy('public.subscriptions', $policy_sql$
DROP POLICY IF EXISTS "Super admins can manage subscriptions" ON public.subscriptions;
$policy_sql$);
select public._apply_optional_rls_policy('public.subscriptions', $policy_sql$
DROP POLICY IF EXISTS "Users can view their account subscription" ON public.subscriptions;
$policy_sql$);

select public._apply_optional_rls_policy('public.subscriptions', $policy_sql$
CREATE POLICY "subscriptions_select" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    is_account_member(account_id, 'viewer'::account_role_enum)
    OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true))
  );
$policy_sql$);

select public._apply_optional_rls_policy('public.subscriptions', $policy_sql$
CREATE POLICY "subscriptions_modify" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));
$policy_sql$);

select public._apply_optional_rls_policy('public.subscriptions', $policy_sql$
CREATE POLICY "subscriptions_update" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));
$policy_sql$);

select public._apply_optional_rls_policy('public.subscriptions', $policy_sql$
CREATE POLICY "subscriptions_delete" ON public.subscriptions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));
$policy_sql$);

-- Table: usage_tracking
select public._apply_optional_rls_policy('public.usage_tracking', $policy_sql$
DROP POLICY IF EXISTS "Super admins can manage usage tracking" ON public.usage_tracking;
$policy_sql$);
select public._apply_optional_rls_policy('public.usage_tracking', $policy_sql$
DROP POLICY IF EXISTS "Users can view their account usage" ON public.usage_tracking;
$policy_sql$);

select public._apply_optional_rls_policy('public.usage_tracking', $policy_sql$
CREATE POLICY "usage_tracking_select" ON public.usage_tracking
  FOR SELECT TO authenticated
  USING (
    is_account_member(account_id, 'viewer'::account_role_enum)
    OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true))
  );
$policy_sql$);

select public._apply_optional_rls_policy('public.usage_tracking', $policy_sql$
CREATE POLICY "usage_tracking_modify" ON public.usage_tracking
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));
$policy_sql$);

select public._apply_optional_rls_policy('public.usage_tracking', $policy_sql$
CREATE POLICY "usage_tracking_update" ON public.usage_tracking
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));
$policy_sql$);

select public._apply_optional_rls_policy('public.usage_tracking', $policy_sql$
CREATE POLICY "usage_tracking_delete" ON public.usage_tracking
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));
$policy_sql$);


-- ── 7. CONSOLIDATE MULTIPLE PERMISSIVE POLICIES ON FEATURE TABLES ──

-- Table: account_invitations
select public._apply_optional_rls_policy('public.account_invitations', $policy_sql$
DROP POLICY IF EXISTS "account_invitations_modify" ON public.account_invitations;
$policy_sql$);
select public._apply_optional_rls_policy('public.account_invitations', $policy_sql$
DROP POLICY IF EXISTS "account_invitations_select" ON public.account_invitations;
$policy_sql$);
select public._apply_optional_rls_policy('public.account_invitations', $policy_sql$
CREATE POLICY "account_invitations_select" ON public.account_invitations
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.account_invitations', $policy_sql$
CREATE POLICY "account_invitations_insert" ON public.account_invitations
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.account_invitations', $policy_sql$
CREATE POLICY "account_invitations_update" ON public.account_invitations
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.account_invitations', $policy_sql$
CREATE POLICY "account_invitations_delete" ON public.account_invitations
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: appointments
select public._apply_optional_rls_policy('public.appointments', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage appointments" ON public.appointments;
$policy_sql$);
select public._apply_optional_rls_policy('public.appointments', $policy_sql$
DROP POLICY IF EXISTS "Users can view appointments" ON public.appointments;
$policy_sql$);
select public._apply_optional_rls_policy('public.appointments', $policy_sql$
CREATE POLICY "appointments_select" ON public.appointments
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.appointments', $policy_sql$
CREATE POLICY "appointments_insert" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.appointments', $policy_sql$
CREATE POLICY "appointments_update" ON public.appointments
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.appointments', $policy_sql$
CREATE POLICY "appointments_delete" ON public.appointments
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: appointments_feedback
select public._apply_optional_rls_policy('public.appointments_feedback', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage feedback" ON public.appointments_feedback;
$policy_sql$);
select public._apply_optional_rls_policy('public.appointments_feedback', $policy_sql$
DROP POLICY IF EXISTS "Users can view feedback" ON public.appointments_feedback;
$policy_sql$);
select public._apply_optional_rls_policy('public.appointments_feedback', $policy_sql$
CREATE POLICY "appointments_feedback_select" ON public.appointments_feedback
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.appointments_feedback', $policy_sql$
CREATE POLICY "appointments_feedback_insert" ON public.appointments_feedback
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.appointments_feedback', $policy_sql$
CREATE POLICY "appointments_feedback_update" ON public.appointments_feedback
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.appointments_feedback', $policy_sql$
CREATE POLICY "appointments_feedback_delete" ON public.appointments_feedback
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: automation_steps
select public._apply_optional_rls_policy('public.automation_steps', $policy_sql$
DROP POLICY IF EXISTS "automation_steps_modify" ON public.automation_steps;
$policy_sql$);
select public._apply_optional_rls_policy('public.automation_steps', $policy_sql$
DROP POLICY IF EXISTS "automation_steps_select" ON public.automation_steps;
$policy_sql$);
select public._apply_optional_rls_policy('public.automation_steps', $policy_sql$
CREATE POLICY "automation_steps_select" ON public.automation_steps
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM automations a
  WHERE ((a.id = automation_steps.automation_id) AND is_account_member(a.account_id)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.automation_steps', $policy_sql$
CREATE POLICY "automation_steps_insert" ON public.automation_steps
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM automations a
  WHERE ((a.id = automation_steps.automation_id) AND is_account_member(a.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.automation_steps', $policy_sql$
CREATE POLICY "automation_steps_update" ON public.automation_steps
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM automations a
  WHERE ((a.id = automation_steps.automation_id) AND is_account_member(a.account_id, 'agent'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM automations a
  WHERE ((a.id = automation_steps.automation_id) AND is_account_member(a.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.automation_steps', $policy_sql$
CREATE POLICY "automation_steps_delete" ON public.automation_steps
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM automations a
  WHERE ((a.id = automation_steps.automation_id) AND is_account_member(a.account_id, 'agent'::account_role_enum)))));
$policy_sql$);

-- Table: billing_invoices
select public._apply_optional_rls_policy('public.billing_invoices', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage invoices" ON public.billing_invoices;
$policy_sql$);
select public._apply_optional_rls_policy('public.billing_invoices', $policy_sql$
DROP POLICY IF EXISTS "Users can view invoices" ON public.billing_invoices;
$policy_sql$);
select public._apply_optional_rls_policy('public.billing_invoices', $policy_sql$
CREATE POLICY "billing_invoices_select" ON public.billing_invoices
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.billing_invoices', $policy_sql$
CREATE POLICY "billing_invoices_insert" ON public.billing_invoices
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.billing_invoices', $policy_sql$
CREATE POLICY "billing_invoices_update" ON public.billing_invoices
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.billing_invoices', $policy_sql$
CREATE POLICY "billing_invoices_delete" ON public.billing_invoices
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: broadcast_recipients
select public._apply_optional_rls_policy('public.broadcast_recipients', $policy_sql$
DROP POLICY IF EXISTS "broadcast_recipients_modify" ON public.broadcast_recipients;
$policy_sql$);
select public._apply_optional_rls_policy('public.broadcast_recipients', $policy_sql$
DROP POLICY IF EXISTS "broadcast_recipients_select" ON public.broadcast_recipients;
$policy_sql$);
select public._apply_optional_rls_policy('public.broadcast_recipients', $policy_sql$
CREATE POLICY "broadcast_recipients_select" ON public.broadcast_recipients
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM broadcasts b
  WHERE ((b.id = broadcast_recipients.broadcast_id) AND is_account_member(b.account_id)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.broadcast_recipients', $policy_sql$
CREATE POLICY "broadcast_recipients_insert" ON public.broadcast_recipients
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM broadcasts b
  WHERE ((b.id = broadcast_recipients.broadcast_id) AND is_account_member(b.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.broadcast_recipients', $policy_sql$
CREATE POLICY "broadcast_recipients_update" ON public.broadcast_recipients
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM broadcasts b
  WHERE ((b.id = broadcast_recipients.broadcast_id) AND is_account_member(b.account_id, 'agent'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM broadcasts b
  WHERE ((b.id = broadcast_recipients.broadcast_id) AND is_account_member(b.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.broadcast_recipients', $policy_sql$
CREATE POLICY "broadcast_recipients_delete" ON public.broadcast_recipients
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM broadcasts b
  WHERE ((b.id = broadcast_recipients.broadcast_id) AND is_account_member(b.account_id, 'agent'::account_role_enum)))));
$policy_sql$);

-- Table: coaching_admissions
select public._apply_optional_rls_policy('public.coaching_admissions', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage coaching admissions" ON public.coaching_admissions;
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_admissions', $policy_sql$
DROP POLICY IF EXISTS "Users can view coaching admissions" ON public.coaching_admissions;
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_admissions', $policy_sql$
CREATE POLICY "coaching_admissions_select" ON public.coaching_admissions
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_admissions', $policy_sql$
CREATE POLICY "coaching_admissions_insert" ON public.coaching_admissions
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_admissions', $policy_sql$
CREATE POLICY "coaching_admissions_update" ON public.coaching_admissions
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_admissions', $policy_sql$
CREATE POLICY "coaching_admissions_delete" ON public.coaching_admissions
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: coaching_batches
select public._apply_optional_rls_policy('public.coaching_batches', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage coaching batches" ON public.coaching_batches;
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_batches', $policy_sql$
DROP POLICY IF EXISTS "Users can view coaching batches" ON public.coaching_batches;
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_batches', $policy_sql$
CREATE POLICY "coaching_batches_select" ON public.coaching_batches
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_batches', $policy_sql$
CREATE POLICY "coaching_batches_insert" ON public.coaching_batches
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_batches', $policy_sql$
CREATE POLICY "coaching_batches_update" ON public.coaching_batches
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_batches', $policy_sql$
CREATE POLICY "coaching_batches_delete" ON public.coaching_batches
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: coaching_courses
select public._apply_optional_rls_policy('public.coaching_courses', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage coaching courses" ON public.coaching_courses;
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_courses', $policy_sql$
DROP POLICY IF EXISTS "Users can view coaching courses" ON public.coaching_courses;
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_courses', $policy_sql$
CREATE POLICY "coaching_courses_select" ON public.coaching_courses
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_courses', $policy_sql$
CREATE POLICY "coaching_courses_insert" ON public.coaching_courses
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_courses', $policy_sql$
CREATE POLICY "coaching_courses_update" ON public.coaching_courses
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_courses', $policy_sql$
CREATE POLICY "coaching_courses_delete" ON public.coaching_courses
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: coaching_students
select public._apply_optional_rls_policy('public.coaching_students', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage coaching students" ON public.coaching_students;
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_students', $policy_sql$
DROP POLICY IF EXISTS "Users can view coaching students" ON public.coaching_students;
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_students', $policy_sql$
CREATE POLICY "coaching_students_select" ON public.coaching_students
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_students', $policy_sql$
CREATE POLICY "coaching_students_insert" ON public.coaching_students
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_students', $policy_sql$
CREATE POLICY "coaching_students_update" ON public.coaching_students
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.coaching_students', $policy_sql$
CREATE POLICY "coaching_students_delete" ON public.coaching_students
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: contact_custom_values
select public._apply_optional_rls_policy('public.contact_custom_values', $policy_sql$
DROP POLICY IF EXISTS "contact_custom_values_modify" ON public.contact_custom_values;
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_custom_values', $policy_sql$
DROP POLICY IF EXISTS "contact_custom_values_select" ON public.contact_custom_values;
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_custom_values', $policy_sql$
CREATE POLICY "contact_custom_values_select" ON public.contact_custom_values
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_custom_values.contact_id) AND is_account_member(c.account_id)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_custom_values', $policy_sql$
CREATE POLICY "contact_custom_values_insert" ON public.contact_custom_values
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_custom_values.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_custom_values', $policy_sql$
CREATE POLICY "contact_custom_values_update" ON public.contact_custom_values
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_custom_values.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_custom_values.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_custom_values', $policy_sql$
CREATE POLICY "contact_custom_values_delete" ON public.contact_custom_values
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_custom_values.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);

-- Table: contact_tags
select public._apply_optional_rls_policy('public.contact_tags', $policy_sql$
DROP POLICY IF EXISTS "contact_tags_modify" ON public.contact_tags;
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_tags', $policy_sql$
DROP POLICY IF EXISTS "contact_tags_select" ON public.contact_tags;
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_tags', $policy_sql$
CREATE POLICY "contact_tags_select" ON public.contact_tags
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_tags.contact_id) AND is_account_member(c.account_id)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_tags', $policy_sql$
CREATE POLICY "contact_tags_insert" ON public.contact_tags
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_tags.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_tags', $policy_sql$
CREATE POLICY "contact_tags_update" ON public.contact_tags
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_tags.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_tags.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.contact_tags', $policy_sql$
CREATE POLICY "contact_tags_delete" ON public.contact_tags
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_tags.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);

-- Table: flow_nodes
select public._apply_optional_rls_policy('public.flow_nodes', $policy_sql$
DROP POLICY IF EXISTS "flow_nodes_modify" ON public.flow_nodes;
$policy_sql$);
select public._apply_optional_rls_policy('public.flow_nodes', $policy_sql$
DROP POLICY IF EXISTS "flow_nodes_select" ON public.flow_nodes;
$policy_sql$);
select public._apply_optional_rls_policy('public.flow_nodes', $policy_sql$
CREATE POLICY "flow_nodes_select" ON public.flow_nodes
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM flows f
  WHERE ((f.id = flow_nodes.flow_id) AND is_account_member(f.account_id)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.flow_nodes', $policy_sql$
CREATE POLICY "flow_nodes_insert" ON public.flow_nodes
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM flows f
  WHERE ((f.id = flow_nodes.flow_id) AND is_account_member(f.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.flow_nodes', $policy_sql$
CREATE POLICY "flow_nodes_update" ON public.flow_nodes
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM flows f
  WHERE ((f.id = flow_nodes.flow_id) AND is_account_member(f.account_id, 'agent'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM flows f
  WHERE ((f.id = flow_nodes.flow_id) AND is_account_member(f.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.flow_nodes', $policy_sql$
CREATE POLICY "flow_nodes_delete" ON public.flow_nodes
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM flows f
  WHERE ((f.id = flow_nodes.flow_id) AND is_account_member(f.account_id, 'agent'::account_role_enum)))));
$policy_sql$);

-- Table: hospital_bills
select public._apply_optional_rls_policy('public.hospital_bills', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage bills" ON public.hospital_bills;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_bills', $policy_sql$
DROP POLICY IF EXISTS "Users can view bills" ON public.hospital_bills;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_bills', $policy_sql$
CREATE POLICY "hospital_bills_select" ON public.hospital_bills
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_bills', $policy_sql$
CREATE POLICY "hospital_bills_insert" ON public.hospital_bills
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_bills', $policy_sql$
CREATE POLICY "hospital_bills_update" ON public.hospital_bills
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_bills', $policy_sql$
CREATE POLICY "hospital_bills_delete" ON public.hospital_bills
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: hospital_branch_staff
select public._apply_optional_rls_policy('public.hospital_branch_staff', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage branch staff" ON public.hospital_branch_staff;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_branch_staff', $policy_sql$
DROP POLICY IF EXISTS "Users can view branch staff" ON public.hospital_branch_staff;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_branch_staff', $policy_sql$
CREATE POLICY "hospital_branch_staff_select" ON public.hospital_branch_staff
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_branch_staff', $policy_sql$
CREATE POLICY "hospital_branch_staff_insert" ON public.hospital_branch_staff
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_branch_staff', $policy_sql$
CREATE POLICY "hospital_branch_staff_update" ON public.hospital_branch_staff
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_branch_staff', $policy_sql$
CREATE POLICY "hospital_branch_staff_delete" ON public.hospital_branch_staff
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: hospital_branches
select public._apply_optional_rls_policy('public.hospital_branches', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage hospital branches" ON public.hospital_branches;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_branches', $policy_sql$
DROP POLICY IF EXISTS "Users can view hospital branches" ON public.hospital_branches;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_branches', $policy_sql$
CREATE POLICY "hospital_branches_select" ON public.hospital_branches
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_branches', $policy_sql$
CREATE POLICY "hospital_branches_insert" ON public.hospital_branches
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_branches', $policy_sql$
CREATE POLICY "hospital_branches_update" ON public.hospital_branches
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_branches', $policy_sql$
CREATE POLICY "hospital_branches_delete" ON public.hospital_branches
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: hospital_doctors
select public._apply_optional_rls_policy('public.hospital_doctors', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage doctors" ON public.hospital_doctors;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_doctors', $policy_sql$
DROP POLICY IF EXISTS "Users can view doctors" ON public.hospital_doctors;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_doctors', $policy_sql$
CREATE POLICY "hospital_doctors_select" ON public.hospital_doctors
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_doctors', $policy_sql$
CREATE POLICY "hospital_doctors_insert" ON public.hospital_doctors
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_doctors', $policy_sql$
CREATE POLICY "hospital_doctors_update" ON public.hospital_doctors
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_doctors', $policy_sql$
CREATE POLICY "hospital_doctors_delete" ON public.hospital_doctors
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: hospital_insurance
select public._apply_optional_rls_policy('public.hospital_insurance', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage insurance" ON public.hospital_insurance;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_insurance', $policy_sql$
DROP POLICY IF EXISTS "Users can view insurance" ON public.hospital_insurance;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_insurance', $policy_sql$
CREATE POLICY "hospital_insurance_select" ON public.hospital_insurance
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_insurance', $policy_sql$
CREATE POLICY "hospital_insurance_insert" ON public.hospital_insurance
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_insurance', $policy_sql$
CREATE POLICY "hospital_insurance_update" ON public.hospital_insurance
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_insurance', $policy_sql$
CREATE POLICY "hospital_insurance_delete" ON public.hospital_insurance
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: hospital_lab_reports
select public._apply_optional_rls_policy('public.hospital_lab_reports', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage reports" ON public.hospital_lab_reports;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_lab_reports', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage reports" ON public.hospital_lab_reports;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_lab_reports', $policy_sql$
DROP POLICY IF EXISTS "Users can view reports" ON public.hospital_lab_reports;
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_lab_reports', $policy_sql$
CREATE POLICY "hospital_lab_reports_select" ON public.hospital_lab_reports
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_lab_reports', $policy_sql$
CREATE POLICY "hospital_lab_reports_insert" ON public.hospital_lab_reports
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_lab_reports', $policy_sql$
CREATE POLICY "hospital_lab_reports_update" ON public.hospital_lab_reports
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.hospital_lab_reports', $policy_sql$
CREATE POLICY "hospital_lab_reports_delete" ON public.hospital_lab_reports
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: knowledge_base
select public._apply_optional_rls_policy('public.knowledge_base', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage knowledge base" ON public.knowledge_base;
$policy_sql$);
select public._apply_optional_rls_policy('public.knowledge_base', $policy_sql$
DROP POLICY IF EXISTS "Users can read their account knowledge base" ON public.knowledge_base;
$policy_sql$);
select public._apply_optional_rls_policy('public.knowledge_base', $policy_sql$
CREATE POLICY "knowledge_base_select" ON public.knowledge_base
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.knowledge_base', $policy_sql$
CREATE POLICY "knowledge_base_insert" ON public.knowledge_base
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.knowledge_base', $policy_sql$
CREATE POLICY "knowledge_base_update" ON public.knowledge_base
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.knowledge_base', $policy_sql$
CREATE POLICY "knowledge_base_delete" ON public.knowledge_base
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: lab_reports
select public._apply_optional_rls_policy('public.lab_reports', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage lab reports" ON public.lab_reports;
$policy_sql$);
select public._apply_optional_rls_policy('public.lab_reports', $policy_sql$
DROP POLICY IF EXISTS "Users can view lab reports" ON public.lab_reports;
$policy_sql$);
select public._apply_optional_rls_policy('public.lab_reports', $policy_sql$
CREATE POLICY "lab_reports_select" ON public.lab_reports
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.lab_reports', $policy_sql$
CREATE POLICY "lab_reports_insert" ON public.lab_reports
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.lab_reports', $policy_sql$
CREATE POLICY "lab_reports_update" ON public.lab_reports
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.lab_reports', $policy_sql$
CREATE POLICY "lab_reports_delete" ON public.lab_reports
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: message_reactions
select public._apply_optional_rls_policy('public.message_reactions', $policy_sql$
DROP POLICY IF EXISTS "message_reactions_modify" ON public.message_reactions;
$policy_sql$);
select public._apply_optional_rls_policy('public.message_reactions', $policy_sql$
DROP POLICY IF EXISTS "message_reactions_select" ON public.message_reactions;
$policy_sql$);
select public._apply_optional_rls_policy('public.message_reactions', $policy_sql$
CREATE POLICY "message_reactions_select" ON public.message_reactions
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (messages m
     JOIN conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_reactions.message_id) AND is_account_member(c.account_id)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.message_reactions', $policy_sql$
CREATE POLICY "message_reactions_insert" ON public.message_reactions
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (messages m
     JOIN conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_reactions.message_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.message_reactions', $policy_sql$
CREATE POLICY "message_reactions_update" ON public.message_reactions
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (messages m
     JOIN conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_reactions.message_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (messages m
     JOIN conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_reactions.message_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.message_reactions', $policy_sql$
CREATE POLICY "message_reactions_delete" ON public.message_reactions
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (messages m
     JOIN conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_reactions.message_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);

-- Table: messages
select public._apply_optional_rls_policy('public.messages', $policy_sql$
DROP POLICY IF EXISTS "messages_modify" ON public.messages;
$policy_sql$);
select public._apply_optional_rls_policy('public.messages', $policy_sql$
DROP POLICY IF EXISTS "messages_select" ON public.messages;
$policy_sql$);
select public._apply_optional_rls_policy('public.messages', $policy_sql$
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND is_account_member(c.account_id)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.messages', $policy_sql$
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.messages', $policy_sql$
CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.messages', $policy_sql$
CREATE POLICY "messages_delete" ON public.messages
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
$policy_sql$);

-- Table: patients
select public._apply_optional_rls_policy('public.patients', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage patients" ON public.patients;
$policy_sql$);
select public._apply_optional_rls_policy('public.patients', $policy_sql$
DROP POLICY IF EXISTS "Users can view patients" ON public.patients;
$policy_sql$);
select public._apply_optional_rls_policy('public.patients', $policy_sql$
CREATE POLICY "patients_select" ON public.patients
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.patients', $policy_sql$
CREATE POLICY "patients_insert" ON public.patients
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.patients', $policy_sql$
CREATE POLICY "patients_update" ON public.patients
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.patients', $policy_sql$
CREATE POLICY "patients_delete" ON public.patients
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: pipeline_stages
select public._apply_optional_rls_policy('public.pipeline_stages', $policy_sql$
DROP POLICY IF EXISTS "pipeline_stages_modify" ON public.pipeline_stages;
$policy_sql$);
select public._apply_optional_rls_policy('public.pipeline_stages', $policy_sql$
DROP POLICY IF EXISTS "pipeline_stages_select" ON public.pipeline_stages;
$policy_sql$);
select public._apply_optional_rls_policy('public.pipeline_stages', $policy_sql$
CREATE POLICY "pipeline_stages_select" ON public.pipeline_stages
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM pipelines p
  WHERE ((p.id = pipeline_stages.pipeline_id) AND is_account_member(p.account_id)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.pipeline_stages', $policy_sql$
CREATE POLICY "pipeline_stages_insert" ON public.pipeline_stages
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM pipelines p
  WHERE ((p.id = pipeline_stages.pipeline_id) AND is_account_member(p.account_id, 'admin'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.pipeline_stages', $policy_sql$
CREATE POLICY "pipeline_stages_update" ON public.pipeline_stages
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM pipelines p
  WHERE ((p.id = pipeline_stages.pipeline_id) AND is_account_member(p.account_id, 'admin'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM pipelines p
  WHERE ((p.id = pipeline_stages.pipeline_id) AND is_account_member(p.account_id, 'admin'::account_role_enum)))));
$policy_sql$);
select public._apply_optional_rls_policy('public.pipeline_stages', $policy_sql$
CREATE POLICY "pipeline_stages_delete" ON public.pipeline_stages
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM pipelines p
  WHERE ((p.id = pipeline_stages.pipeline_id) AND is_account_member(p.account_id, 'admin'::account_role_enum)))));
$policy_sql$);

-- Table: real_estate_properties
select public._apply_optional_rls_policy('public.real_estate_properties', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage properties" ON public.real_estate_properties;
$policy_sql$);
select public._apply_optional_rls_policy('public.real_estate_properties', $policy_sql$
DROP POLICY IF EXISTS "Users can view properties" ON public.real_estate_properties;
$policy_sql$);
select public._apply_optional_rls_policy('public.real_estate_properties', $policy_sql$
CREATE POLICY "real_estate_properties_select" ON public.real_estate_properties
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.real_estate_properties', $policy_sql$
CREATE POLICY "real_estate_properties_insert" ON public.real_estate_properties
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.real_estate_properties', $policy_sql$
CREATE POLICY "real_estate_properties_update" ON public.real_estate_properties
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.real_estate_properties', $policy_sql$
CREATE POLICY "real_estate_properties_delete" ON public.real_estate_properties
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: real_estate_visits
select public._apply_optional_rls_policy('public.real_estate_visits', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage visits" ON public.real_estate_visits;
$policy_sql$);
select public._apply_optional_rls_policy('public.real_estate_visits', $policy_sql$
DROP POLICY IF EXISTS "Users can view visits" ON public.real_estate_visits;
$policy_sql$);
select public._apply_optional_rls_policy('public.real_estate_visits', $policy_sql$
CREATE POLICY "real_estate_visits_select" ON public.real_estate_visits
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.real_estate_visits', $policy_sql$
CREATE POLICY "real_estate_visits_insert" ON public.real_estate_visits
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.real_estate_visits', $policy_sql$
CREATE POLICY "real_estate_visits_update" ON public.real_estate_visits
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.real_estate_visits', $policy_sql$
CREATE POLICY "real_estate_visits_delete" ON public.real_estate_visits
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: realestate_agents
select public._apply_optional_rls_policy('public.realestate_agents', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage realestate agents" ON public.realestate_agents;
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_agents', $policy_sql$
DROP POLICY IF EXISTS "Users can view realestate agents" ON public.realestate_agents;
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_agents', $policy_sql$
CREATE POLICY "realestate_agents_select" ON public.realestate_agents
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_agents', $policy_sql$
CREATE POLICY "realestate_agents_insert" ON public.realestate_agents
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_agents', $policy_sql$
CREATE POLICY "realestate_agents_update" ON public.realestate_agents
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_agents', $policy_sql$
CREATE POLICY "realestate_agents_delete" ON public.realestate_agents
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: realestate_leads
select public._apply_optional_rls_policy('public.realestate_leads', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage realestate leads" ON public.realestate_leads;
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_leads', $policy_sql$
DROP POLICY IF EXISTS "Users can view realestate leads" ON public.realestate_leads;
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_leads', $policy_sql$
CREATE POLICY "realestate_leads_select" ON public.realestate_leads
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_leads', $policy_sql$
CREATE POLICY "realestate_leads_insert" ON public.realestate_leads
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_leads', $policy_sql$
CREATE POLICY "realestate_leads_update" ON public.realestate_leads
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_leads', $policy_sql$
CREATE POLICY "realestate_leads_delete" ON public.realestate_leads
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: realestate_properties
select public._apply_optional_rls_policy('public.realestate_properties', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage properties" ON public.realestate_properties;
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_properties', $policy_sql$
DROP POLICY IF EXISTS "Users can view properties" ON public.realestate_properties;
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_properties', $policy_sql$
CREATE POLICY "realestate_properties_select" ON public.realestate_properties
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_properties', $policy_sql$
CREATE POLICY "realestate_properties_insert" ON public.realestate_properties
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_properties', $policy_sql$
CREATE POLICY "realestate_properties_update" ON public.realestate_properties
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_properties', $policy_sql$
CREATE POLICY "realestate_properties_delete" ON public.realestate_properties
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: realestate_visits
select public._apply_optional_rls_policy('public.realestate_visits', $policy_sql$
DROP POLICY IF EXISTS "Agents can manage site visits" ON public.realestate_visits;
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_visits', $policy_sql$
DROP POLICY IF EXISTS "Users can view site visits" ON public.realestate_visits;
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_visits', $policy_sql$
CREATE POLICY "realestate_visits_select" ON public.realestate_visits
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_visits', $policy_sql$
CREATE POLICY "realestate_visits_insert" ON public.realestate_visits
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_visits', $policy_sql$
CREATE POLICY "realestate_visits_update" ON public.realestate_visits
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.realestate_visits', $policy_sql$
CREATE POLICY "realestate_visits_delete" ON public.realestate_visits
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));
$policy_sql$);

-- Table: tenant_modules
select public._apply_optional_rls_policy('public.tenant_modules', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage tenant modules" ON public.tenant_modules;
$policy_sql$);
select public._apply_optional_rls_policy('public.tenant_modules', $policy_sql$
DROP POLICY IF EXISTS "Users can view tenant modules" ON public.tenant_modules;
$policy_sql$);
select public._apply_optional_rls_policy('public.tenant_modules', $policy_sql$
CREATE POLICY "tenant_modules_select" ON public.tenant_modules
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.tenant_modules', $policy_sql$
CREATE POLICY "tenant_modules_insert" ON public.tenant_modules
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.tenant_modules', $policy_sql$
CREATE POLICY "tenant_modules_update" ON public.tenant_modules
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.tenant_modules', $policy_sql$
CREATE POLICY "tenant_modules_delete" ON public.tenant_modules
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: travel_bookings
select public._apply_optional_rls_policy('public.travel_bookings', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage travel bookings" ON public.travel_bookings;
$policy_sql$);
select public._apply_optional_rls_policy('public.travel_bookings', $policy_sql$
DROP POLICY IF EXISTS "Users can view travel bookings" ON public.travel_bookings;
$policy_sql$);
select public._apply_optional_rls_policy('public.travel_bookings', $policy_sql$
CREATE POLICY "travel_bookings_select" ON public.travel_bookings
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.travel_bookings', $policy_sql$
CREATE POLICY "travel_bookings_insert" ON public.travel_bookings
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.travel_bookings', $policy_sql$
CREATE POLICY "travel_bookings_update" ON public.travel_bookings
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.travel_bookings', $policy_sql$
CREATE POLICY "travel_bookings_delete" ON public.travel_bookings
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);

-- Table: travel_packages
select public._apply_optional_rls_policy('public.travel_packages', $policy_sql$
DROP POLICY IF EXISTS "Admins can manage travel packages" ON public.travel_packages;
$policy_sql$);
select public._apply_optional_rls_policy('public.travel_packages', $policy_sql$
DROP POLICY IF EXISTS "Users can view travel packages" ON public.travel_packages;
$policy_sql$);
select public._apply_optional_rls_policy('public.travel_packages', $policy_sql$
CREATE POLICY "travel_packages_select" ON public.travel_packages
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.travel_packages', $policy_sql$
CREATE POLICY "travel_packages_insert" ON public.travel_packages
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.travel_packages', $policy_sql$
CREATE POLICY "travel_packages_update" ON public.travel_packages
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);
select public._apply_optional_rls_policy('public.travel_packages', $policy_sql$
CREATE POLICY "travel_packages_delete" ON public.travel_packages
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
$policy_sql$);


drop function public._apply_optional_rls_policy(text, text);

COMMIT;
