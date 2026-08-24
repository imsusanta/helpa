-- ============================================================
-- Migration: 20260822124500_add_missing_rls_policies.sql
-- Purpose: Add RLS tenant policies for automation_pending_executions,
--          inbound_webhook_events, and outbound_outbox to resolve
--          rls_enabled_no_policy advisors.
-- ============================================================

begin;

-- These tables are present in the consolidated/legacy schema, but are not
-- created by the ordered migration directory. Apply the hardening when a
-- deployment already has a table, while allowing a clean ordered database to
-- continue to the migrations that provision the inbound tables later.
do $$
begin
  if to_regclass('public.automation_pending_executions') is not null then
    execute $automation$
      alter table public.automation_pending_executions enable row level security;
      drop policy if exists "automation_pending_executions_select" on public.automation_pending_executions;
      drop policy if exists "automation_pending_executions_insert" on public.automation_pending_executions;
      drop policy if exists "automation_pending_executions_update" on public.automation_pending_executions;
      drop policy if exists "automation_pending_executions_delete" on public.automation_pending_executions;

      create policy "automation_pending_executions_select" on public.automation_pending_executions
        for select to authenticated
        using (is_account_member(account_id, 'viewer'::account_role_enum) or (select auth.role()) = 'service_role');

      create policy "automation_pending_executions_insert" on public.automation_pending_executions
        for insert to authenticated, service_role
        with check (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');

      create policy "automation_pending_executions_update" on public.automation_pending_executions
        for update to authenticated, service_role
        using (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role')
        with check (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');

      create policy "automation_pending_executions_delete" on public.automation_pending_executions
        for delete to authenticated, service_role
        using (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');
    $automation$;
  end if;

  if to_regclass('public.outbound_outbox') is not null then
    execute $outbox$
      alter table public.outbound_outbox enable row level security;
      drop policy if exists "outbound_outbox_select" on public.outbound_outbox;
      drop policy if exists "outbound_outbox_insert" on public.outbound_outbox;
      drop policy if exists "outbound_outbox_update" on public.outbound_outbox;
      drop policy if exists "outbound_outbox_delete" on public.outbound_outbox;

      create policy "outbound_outbox_select" on public.outbound_outbox
        for select to authenticated
        using (is_account_member(account_id, 'viewer'::account_role_enum) or (select auth.role()) = 'service_role');

      create policy "outbound_outbox_insert" on public.outbound_outbox
        for insert to authenticated, service_role
        with check (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');

      create policy "outbound_outbox_update" on public.outbound_outbox
        for update to authenticated, service_role
        using (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role')
        with check (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');

      create policy "outbound_outbox_delete" on public.outbound_outbox
        for delete to authenticated, service_role
        using (is_account_member(account_id, 'admin'::account_role_enum) or (select auth.role()) = 'service_role');
    $outbox$;
  end if;
end $$;

commit;
