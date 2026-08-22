-- ============================================================
-- Migration: 20260822123000_optimize_rls_performance.sql
-- Purpose: Optimize 272 RLS Performance & InitPlan Advisor Warnings:
--          1. Wraps auth.uid(), auth.jwt(), current_setting() in (SELECT ...) for InitPlan evaluation
--          2. Consolidates multiple permissive policies by separating SELECT from INSERT/UPDATE/DELETE
--          3. Targets authenticated role instead of PUBLIC to avoid redundant anon evaluation
-- ============================================================

BEGIN;


-- Table: lead_stage_history
DROP POLICY IF EXISTS "lead_stage_history_tenant_isolation" ON public.lead_stage_history;
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

-- Table: provider_events
DROP POLICY IF EXISTS "provider_events_tenant_isolation" ON public.provider_events;
CREATE POLICY "provider_events_tenant_isolation" ON public.provider_events
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

-- Table: idempotency_keys
DROP POLICY IF EXISTS "idempotency_keys_tenant_isolation" ON public.idempotency_keys;
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

-- Table: followup_sequences
DROP POLICY IF EXISTS "followup_sequences_tenant_isolation" ON public.followup_sequences;
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

-- Table: followup_steps
DROP POLICY IF EXISTS "followup_steps_tenant_isolation" ON public.followup_steps;
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

-- Table: followup_enrollments
DROP POLICY IF EXISTS "followup_enrollments_tenant_isolation" ON public.followup_enrollments;
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

-- Table: followup_jobs
DROP POLICY IF EXISTS "followup_jobs_tenant_isolation" ON public.followup_jobs;
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

-- Table: clinic_integrations
DROP POLICY IF EXISTS "clinic_integrations_tenant_isolation" ON public.clinic_integrations;
CREATE POLICY "clinic_integrations_tenant_isolation" ON public.clinic_integrations
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

-- Table: contact_channels
DROP POLICY IF EXISTS "contact_channels_tenant_isolation" ON public.contact_channels;
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

-- Table: communication_consents
DROP POLICY IF EXISTS "communication_consents_tenant_isolation" ON public.communication_consents;
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

-- Table: calls
DROP POLICY IF EXISTS "calls_tenant_isolation" ON public.calls;
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

-- Table: call_events
DROP POLICY IF EXISTS "call_events_tenant_isolation" ON public.call_events;
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

-- Table: calendly_connections
DROP POLICY IF EXISTS "calendly_connections_tenant_isolation" ON public.calendly_connections;
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

-- Table: calendly_event_types
DROP POLICY IF EXISTS "calendly_event_types_tenant_isolation" ON public.calendly_event_types;
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

-- Table: service_event_type_mappings
DROP POLICY IF EXISTS "service_event_type_mappings_tenant_isolation" ON public.service_event_type_mappings;
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

-- Table: audit_logs
DROP POLICY IF EXISTS "audit_logs_tenant_select" ON public.audit_logs;
CREATE POLICY "audit_logs_tenant_select" ON public.audit_logs
  FOR SELECT TO authenticated, service_role
  USING (
    (account_id = (SELECT (((auth.jwt() -> 'app_metadata'::text) ->> 'account_id'::text))::uuid))
    OR ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );

DROP POLICY IF EXISTS "audit_logs_service_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_service_insert" ON public.audit_logs
  FOR INSERT TO authenticated, service_role
  WITH CHECK (
    ((SELECT current_setting('role'::text, true)) = 'service_role'::text)
    OR ((SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text)
  );

-- Table: profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR is_account_member(account_id)
  );

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Table: hospital_followups
DROP POLICY IF EXISTS "Enable all operations for account members" ON public.hospital_followups;
CREATE POLICY "hospital_followups_member_isolation" ON public.hospital_followups
  FOR ALL TO authenticated
  USING (account_id IN (SELECT profiles.account_id FROM profiles WHERE profiles.user_id = (SELECT auth.uid())))
  WITH CHECK (account_id IN (SELECT profiles.account_id FROM profiles WHERE profiles.user_id = (SELECT auth.uid())));

-- Table: platform_payments
DROP POLICY IF EXISTS "Tenant members can view own account payments" ON public.platform_payments;
DROP POLICY IF EXISTS "Service role and Super Admins manage platform payments" ON public.platform_payments;

CREATE POLICY "platform_payments_select" ON public.platform_payments
  FOR SELECT TO authenticated
  USING (
    (EXISTS (SELECT 1 FROM account_members WHERE account_members.account_id = platform_payments.account_id AND account_members.user_id = (SELECT auth.uid()) AND account_members.active = true))
    OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND (profiles.is_super_admin = true OR profiles.email = 'susantalohr@gmail.com'::text)))
  );

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

-- Table: plans
DROP POLICY IF EXISTS "Super admins can manage plans" ON public.plans;
DROP POLICY IF EXISTS "Anyone can view plans" ON public.plans;

CREATE POLICY "plans_select" ON public.plans
  FOR SELECT TO authenticated
  USING (
    true
    OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true))
  );

CREATE POLICY "plans_modify" ON public.plans
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));

CREATE POLICY "plans_update" ON public.plans
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));

CREATE POLICY "plans_delete" ON public.plans
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));

-- Table: subscriptions
DROP POLICY IF EXISTS "Super admins can manage subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view their account subscription" ON public.subscriptions;

CREATE POLICY "subscriptions_select" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    is_account_member(account_id, 'viewer'::account_role_enum)
    OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true))
  );

CREATE POLICY "subscriptions_modify" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));

CREATE POLICY "subscriptions_update" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));

CREATE POLICY "subscriptions_delete" ON public.subscriptions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));

-- Table: usage_tracking
DROP POLICY IF EXISTS "Super admins can manage usage tracking" ON public.usage_tracking;
DROP POLICY IF EXISTS "Users can view their account usage" ON public.usage_tracking;

CREATE POLICY "usage_tracking_select" ON public.usage_tracking
  FOR SELECT TO authenticated
  USING (
    is_account_member(account_id, 'viewer'::account_role_enum)
    OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true))
  );

CREATE POLICY "usage_tracking_modify" ON public.usage_tracking
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));

CREATE POLICY "usage_tracking_update" ON public.usage_tracking
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));

CREATE POLICY "usage_tracking_delete" ON public.usage_tracking
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND profiles.is_super_admin = true));


-- ── 7. CONSOLIDATE MULTIPLE PERMISSIVE POLICIES ON FEATURE TABLES ──

-- Table: account_invitations
DROP POLICY IF EXISTS "account_invitations_modify" ON public.account_invitations;
DROP POLICY IF EXISTS "account_invitations_select" ON public.account_invitations;
CREATE POLICY "account_invitations_select" ON public.account_invitations
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "account_invitations_insert" ON public.account_invitations
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "account_invitations_update" ON public.account_invitations
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "account_invitations_delete" ON public.account_invitations
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));

-- Table: appointments
DROP POLICY IF EXISTS "Agents can manage appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can view appointments" ON public.appointments;
CREATE POLICY "appointments_select" ON public.appointments
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "appointments_insert" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "appointments_update" ON public.appointments
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "appointments_delete" ON public.appointments
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));

-- Table: appointments_feedback
DROP POLICY IF EXISTS "Agents can manage feedback" ON public.appointments_feedback;
DROP POLICY IF EXISTS "Users can view feedback" ON public.appointments_feedback;
CREATE POLICY "appointments_feedback_select" ON public.appointments_feedback
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "appointments_feedback_insert" ON public.appointments_feedback
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "appointments_feedback_update" ON public.appointments_feedback
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "appointments_feedback_delete" ON public.appointments_feedback
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));

-- Table: automation_steps
DROP POLICY IF EXISTS "automation_steps_modify" ON public.automation_steps;
DROP POLICY IF EXISTS "automation_steps_select" ON public.automation_steps;
CREATE POLICY "automation_steps_select" ON public.automation_steps
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM automations a
  WHERE ((a.id = automation_steps.automation_id) AND is_account_member(a.account_id)))));
CREATE POLICY "automation_steps_insert" ON public.automation_steps
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM automations a
  WHERE ((a.id = automation_steps.automation_id) AND is_account_member(a.account_id, 'agent'::account_role_enum)))));
CREATE POLICY "automation_steps_update" ON public.automation_steps
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM automations a
  WHERE ((a.id = automation_steps.automation_id) AND is_account_member(a.account_id, 'agent'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM automations a
  WHERE ((a.id = automation_steps.automation_id) AND is_account_member(a.account_id, 'agent'::account_role_enum)))));
CREATE POLICY "automation_steps_delete" ON public.automation_steps
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM automations a
  WHERE ((a.id = automation_steps.automation_id) AND is_account_member(a.account_id, 'agent'::account_role_enum)))));

-- Table: billing_invoices
DROP POLICY IF EXISTS "Agents can manage invoices" ON public.billing_invoices;
DROP POLICY IF EXISTS "Users can view invoices" ON public.billing_invoices;
CREATE POLICY "billing_invoices_select" ON public.billing_invoices
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "billing_invoices_insert" ON public.billing_invoices
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "billing_invoices_update" ON public.billing_invoices
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "billing_invoices_delete" ON public.billing_invoices
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));

-- Table: broadcast_recipients
DROP POLICY IF EXISTS "broadcast_recipients_modify" ON public.broadcast_recipients;
DROP POLICY IF EXISTS "broadcast_recipients_select" ON public.broadcast_recipients;
CREATE POLICY "broadcast_recipients_select" ON public.broadcast_recipients
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM broadcasts b
  WHERE ((b.id = broadcast_recipients.broadcast_id) AND is_account_member(b.account_id)))));
CREATE POLICY "broadcast_recipients_insert" ON public.broadcast_recipients
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM broadcasts b
  WHERE ((b.id = broadcast_recipients.broadcast_id) AND is_account_member(b.account_id, 'agent'::account_role_enum)))));
CREATE POLICY "broadcast_recipients_update" ON public.broadcast_recipients
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM broadcasts b
  WHERE ((b.id = broadcast_recipients.broadcast_id) AND is_account_member(b.account_id, 'agent'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM broadcasts b
  WHERE ((b.id = broadcast_recipients.broadcast_id) AND is_account_member(b.account_id, 'agent'::account_role_enum)))));
CREATE POLICY "broadcast_recipients_delete" ON public.broadcast_recipients
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM broadcasts b
  WHERE ((b.id = broadcast_recipients.broadcast_id) AND is_account_member(b.account_id, 'agent'::account_role_enum)))));

-- Table: coaching_admissions
DROP POLICY IF EXISTS "Agents can manage coaching admissions" ON public.coaching_admissions;
DROP POLICY IF EXISTS "Users can view coaching admissions" ON public.coaching_admissions;
CREATE POLICY "coaching_admissions_select" ON public.coaching_admissions
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "coaching_admissions_insert" ON public.coaching_admissions
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "coaching_admissions_update" ON public.coaching_admissions
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "coaching_admissions_delete" ON public.coaching_admissions
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));

-- Table: coaching_batches
DROP POLICY IF EXISTS "Agents can manage coaching batches" ON public.coaching_batches;
DROP POLICY IF EXISTS "Users can view coaching batches" ON public.coaching_batches;
CREATE POLICY "coaching_batches_select" ON public.coaching_batches
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "coaching_batches_insert" ON public.coaching_batches
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "coaching_batches_update" ON public.coaching_batches
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "coaching_batches_delete" ON public.coaching_batches
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));

-- Table: coaching_courses
DROP POLICY IF EXISTS "Agents can manage coaching courses" ON public.coaching_courses;
DROP POLICY IF EXISTS "Users can view coaching courses" ON public.coaching_courses;
CREATE POLICY "coaching_courses_select" ON public.coaching_courses
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "coaching_courses_insert" ON public.coaching_courses
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "coaching_courses_update" ON public.coaching_courses
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "coaching_courses_delete" ON public.coaching_courses
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));

-- Table: coaching_students
DROP POLICY IF EXISTS "Agents can manage coaching students" ON public.coaching_students;
DROP POLICY IF EXISTS "Users can view coaching students" ON public.coaching_students;
CREATE POLICY "coaching_students_select" ON public.coaching_students
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "coaching_students_insert" ON public.coaching_students
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "coaching_students_update" ON public.coaching_students
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "coaching_students_delete" ON public.coaching_students
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));

-- Table: contact_custom_values
DROP POLICY IF EXISTS "contact_custom_values_modify" ON public.contact_custom_values;
DROP POLICY IF EXISTS "contact_custom_values_select" ON public.contact_custom_values;
CREATE POLICY "contact_custom_values_select" ON public.contact_custom_values
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_custom_values.contact_id) AND is_account_member(c.account_id)))));
CREATE POLICY "contact_custom_values_insert" ON public.contact_custom_values
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_custom_values.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
CREATE POLICY "contact_custom_values_update" ON public.contact_custom_values
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_custom_values.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_custom_values.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
CREATE POLICY "contact_custom_values_delete" ON public.contact_custom_values
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_custom_values.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));

-- Table: contact_tags
DROP POLICY IF EXISTS "contact_tags_modify" ON public.contact_tags;
DROP POLICY IF EXISTS "contact_tags_select" ON public.contact_tags;
CREATE POLICY "contact_tags_select" ON public.contact_tags
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_tags.contact_id) AND is_account_member(c.account_id)))));
CREATE POLICY "contact_tags_insert" ON public.contact_tags
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_tags.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
CREATE POLICY "contact_tags_update" ON public.contact_tags
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_tags.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_tags.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
CREATE POLICY "contact_tags_delete" ON public.contact_tags
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_tags.contact_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));

-- Table: flow_nodes
DROP POLICY IF EXISTS "flow_nodes_modify" ON public.flow_nodes;
DROP POLICY IF EXISTS "flow_nodes_select" ON public.flow_nodes;
CREATE POLICY "flow_nodes_select" ON public.flow_nodes
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM flows f
  WHERE ((f.id = flow_nodes.flow_id) AND is_account_member(f.account_id)))));
CREATE POLICY "flow_nodes_insert" ON public.flow_nodes
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM flows f
  WHERE ((f.id = flow_nodes.flow_id) AND is_account_member(f.account_id, 'agent'::account_role_enum)))));
CREATE POLICY "flow_nodes_update" ON public.flow_nodes
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM flows f
  WHERE ((f.id = flow_nodes.flow_id) AND is_account_member(f.account_id, 'agent'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM flows f
  WHERE ((f.id = flow_nodes.flow_id) AND is_account_member(f.account_id, 'agent'::account_role_enum)))));
CREATE POLICY "flow_nodes_delete" ON public.flow_nodes
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM flows f
  WHERE ((f.id = flow_nodes.flow_id) AND is_account_member(f.account_id, 'agent'::account_role_enum)))));

-- Table: hospital_bills
DROP POLICY IF EXISTS "Admins can manage bills" ON public.hospital_bills;
DROP POLICY IF EXISTS "Users can view bills" ON public.hospital_bills;
CREATE POLICY "hospital_bills_select" ON public.hospital_bills
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "hospital_bills_insert" ON public.hospital_bills
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "hospital_bills_update" ON public.hospital_bills
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "hospital_bills_delete" ON public.hospital_bills
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));

-- Table: hospital_branch_staff
DROP POLICY IF EXISTS "Admins can manage branch staff" ON public.hospital_branch_staff;
DROP POLICY IF EXISTS "Users can view branch staff" ON public.hospital_branch_staff;
CREATE POLICY "hospital_branch_staff_select" ON public.hospital_branch_staff
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "hospital_branch_staff_insert" ON public.hospital_branch_staff
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "hospital_branch_staff_update" ON public.hospital_branch_staff
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "hospital_branch_staff_delete" ON public.hospital_branch_staff
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));

-- Table: hospital_branches
DROP POLICY IF EXISTS "Admins can manage hospital branches" ON public.hospital_branches;
DROP POLICY IF EXISTS "Users can view hospital branches" ON public.hospital_branches;
CREATE POLICY "hospital_branches_select" ON public.hospital_branches
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "hospital_branches_insert" ON public.hospital_branches
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "hospital_branches_update" ON public.hospital_branches
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "hospital_branches_delete" ON public.hospital_branches
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));

-- Table: hospital_doctors
DROP POLICY IF EXISTS "Admins can manage doctors" ON public.hospital_doctors;
DROP POLICY IF EXISTS "Users can view doctors" ON public.hospital_doctors;
CREATE POLICY "hospital_doctors_select" ON public.hospital_doctors
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "hospital_doctors_insert" ON public.hospital_doctors
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "hospital_doctors_update" ON public.hospital_doctors
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "hospital_doctors_delete" ON public.hospital_doctors
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));

-- Table: hospital_insurance
DROP POLICY IF EXISTS "Admins can manage insurance" ON public.hospital_insurance;
DROP POLICY IF EXISTS "Users can view insurance" ON public.hospital_insurance;
CREATE POLICY "hospital_insurance_select" ON public.hospital_insurance
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "hospital_insurance_insert" ON public.hospital_insurance
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "hospital_insurance_update" ON public.hospital_insurance
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "hospital_insurance_delete" ON public.hospital_insurance
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));

-- Table: hospital_lab_reports
DROP POLICY IF EXISTS "Agents can manage reports" ON public.hospital_lab_reports;
DROP POLICY IF EXISTS "Admins can manage reports" ON public.hospital_lab_reports;
DROP POLICY IF EXISTS "Users can view reports" ON public.hospital_lab_reports;
CREATE POLICY "hospital_lab_reports_select" ON public.hospital_lab_reports
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "hospital_lab_reports_insert" ON public.hospital_lab_reports
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "hospital_lab_reports_update" ON public.hospital_lab_reports
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "hospital_lab_reports_delete" ON public.hospital_lab_reports
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));

-- Table: knowledge_base
DROP POLICY IF EXISTS "Agents can manage knowledge base" ON public.knowledge_base;
DROP POLICY IF EXISTS "Users can read their account knowledge base" ON public.knowledge_base;
CREATE POLICY "knowledge_base_select" ON public.knowledge_base
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "knowledge_base_insert" ON public.knowledge_base
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "knowledge_base_update" ON public.knowledge_base
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "knowledge_base_delete" ON public.knowledge_base
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));

-- Table: lab_reports
DROP POLICY IF EXISTS "Agents can manage lab reports" ON public.lab_reports;
DROP POLICY IF EXISTS "Users can view lab reports" ON public.lab_reports;
CREATE POLICY "lab_reports_select" ON public.lab_reports
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "lab_reports_insert" ON public.lab_reports
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "lab_reports_update" ON public.lab_reports
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "lab_reports_delete" ON public.lab_reports
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));

-- Table: message_reactions
DROP POLICY IF EXISTS "message_reactions_modify" ON public.message_reactions;
DROP POLICY IF EXISTS "message_reactions_select" ON public.message_reactions;
CREATE POLICY "message_reactions_select" ON public.message_reactions
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (messages m
     JOIN conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_reactions.message_id) AND is_account_member(c.account_id)))));
CREATE POLICY "message_reactions_insert" ON public.message_reactions
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (messages m
     JOIN conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_reactions.message_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
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
CREATE POLICY "message_reactions_delete" ON public.message_reactions
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (messages m
     JOIN conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_reactions.message_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));

-- Table: messages
DROP POLICY IF EXISTS "messages_modify" ON public.messages;
DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND is_account_member(c.account_id)))));
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));
CREATE POLICY "messages_delete" ON public.messages
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND is_account_member(c.account_id, 'agent'::account_role_enum)))));

-- Table: patients
DROP POLICY IF EXISTS "Agents can manage patients" ON public.patients;
DROP POLICY IF EXISTS "Users can view patients" ON public.patients;
CREATE POLICY "patients_select" ON public.patients
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "patients_insert" ON public.patients
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "patients_update" ON public.patients
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "patients_delete" ON public.patients
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));

-- Table: pipeline_stages
DROP POLICY IF EXISTS "pipeline_stages_modify" ON public.pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages_select" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_select" ON public.pipeline_stages
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM pipelines p
  WHERE ((p.id = pipeline_stages.pipeline_id) AND is_account_member(p.account_id)))));
CREATE POLICY "pipeline_stages_insert" ON public.pipeline_stages
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM pipelines p
  WHERE ((p.id = pipeline_stages.pipeline_id) AND is_account_member(p.account_id, 'admin'::account_role_enum)))));
CREATE POLICY "pipeline_stages_update" ON public.pipeline_stages
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM pipelines p
  WHERE ((p.id = pipeline_stages.pipeline_id) AND is_account_member(p.account_id, 'admin'::account_role_enum)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM pipelines p
  WHERE ((p.id = pipeline_stages.pipeline_id) AND is_account_member(p.account_id, 'admin'::account_role_enum)))));
CREATE POLICY "pipeline_stages_delete" ON public.pipeline_stages
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM pipelines p
  WHERE ((p.id = pipeline_stages.pipeline_id) AND is_account_member(p.account_id, 'admin'::account_role_enum)))));

-- Table: real_estate_properties
DROP POLICY IF EXISTS "Admins can manage properties" ON public.real_estate_properties;
DROP POLICY IF EXISTS "Users can view properties" ON public.real_estate_properties;
CREATE POLICY "real_estate_properties_select" ON public.real_estate_properties
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "real_estate_properties_insert" ON public.real_estate_properties
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "real_estate_properties_update" ON public.real_estate_properties
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "real_estate_properties_delete" ON public.real_estate_properties
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));

-- Table: real_estate_visits
DROP POLICY IF EXISTS "Admins can manage visits" ON public.real_estate_visits;
DROP POLICY IF EXISTS "Users can view visits" ON public.real_estate_visits;
CREATE POLICY "real_estate_visits_select" ON public.real_estate_visits
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "real_estate_visits_insert" ON public.real_estate_visits
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "real_estate_visits_update" ON public.real_estate_visits
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "real_estate_visits_delete" ON public.real_estate_visits
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));

-- Table: realestate_agents
DROP POLICY IF EXISTS "Admins can manage realestate agents" ON public.realestate_agents;
DROP POLICY IF EXISTS "Users can view realestate agents" ON public.realestate_agents;
CREATE POLICY "realestate_agents_select" ON public.realestate_agents
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "realestate_agents_insert" ON public.realestate_agents
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "realestate_agents_update" ON public.realestate_agents
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "realestate_agents_delete" ON public.realestate_agents
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));

-- Table: realestate_leads
DROP POLICY IF EXISTS "Agents can manage realestate leads" ON public.realestate_leads;
DROP POLICY IF EXISTS "Users can view realestate leads" ON public.realestate_leads;
CREATE POLICY "realestate_leads_select" ON public.realestate_leads
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "realestate_leads_insert" ON public.realestate_leads
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "realestate_leads_update" ON public.realestate_leads
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "realestate_leads_delete" ON public.realestate_leads
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));

-- Table: realestate_properties
DROP POLICY IF EXISTS "Agents can manage properties" ON public.realestate_properties;
DROP POLICY IF EXISTS "Users can view properties" ON public.realestate_properties;
CREATE POLICY "realestate_properties_select" ON public.realestate_properties
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "realestate_properties_insert" ON public.realestate_properties
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "realestate_properties_update" ON public.realestate_properties
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "realestate_properties_delete" ON public.realestate_properties
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));

-- Table: realestate_visits
DROP POLICY IF EXISTS "Agents can manage site visits" ON public.realestate_visits;
DROP POLICY IF EXISTS "Users can view site visits" ON public.realestate_visits;
CREATE POLICY "realestate_visits_select" ON public.realestate_visits
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "realestate_visits_insert" ON public.realestate_visits
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "realestate_visits_update" ON public.realestate_visits
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'agent'::account_role_enum));
CREATE POLICY "realestate_visits_delete" ON public.realestate_visits
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'agent'::account_role_enum));

-- Table: tenant_modules
DROP POLICY IF EXISTS "Admins can manage tenant modules" ON public.tenant_modules;
DROP POLICY IF EXISTS "Users can view tenant modules" ON public.tenant_modules;
CREATE POLICY "tenant_modules_select" ON public.tenant_modules
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "tenant_modules_insert" ON public.tenant_modules
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "tenant_modules_update" ON public.tenant_modules
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "tenant_modules_delete" ON public.tenant_modules
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));

-- Table: travel_bookings
DROP POLICY IF EXISTS "Admins can manage travel bookings" ON public.travel_bookings;
DROP POLICY IF EXISTS "Users can view travel bookings" ON public.travel_bookings;
CREATE POLICY "travel_bookings_select" ON public.travel_bookings
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "travel_bookings_insert" ON public.travel_bookings
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "travel_bookings_update" ON public.travel_bookings
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "travel_bookings_delete" ON public.travel_bookings
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));

-- Table: travel_packages
DROP POLICY IF EXISTS "Admins can manage travel packages" ON public.travel_packages;
DROP POLICY IF EXISTS "Users can view travel packages" ON public.travel_packages;
CREATE POLICY "travel_packages_select" ON public.travel_packages
  FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'viewer'::account_role_enum));
CREATE POLICY "travel_packages_insert" ON public.travel_packages
  FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "travel_packages_update" ON public.travel_packages
  FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum))
  WITH CHECK (is_account_member(account_id, 'admin'::account_role_enum));
CREATE POLICY "travel_packages_delete" ON public.travel_packages
  FOR DELETE TO authenticated
  USING (is_account_member(account_id, 'admin'::account_role_enum));

COMMIT;
