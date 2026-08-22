-- Restore authorization invariants after the broad function and RLS advisor migrations.
-- This migration is intentionally narrow: only policy helper functions regain
-- authenticated execution, and platform administration remains persisted-role-only.
begin;

-- RLS evaluates these security-definer helpers for authenticated requests.
-- Grant every existing overload by catalog identity so this remains idempotent
-- across environments with slightly different migration histories.
do $$
declare
  helper regprocedure;
begin
  for helper in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'is_active_account_member',
        'has_account_role',
        'is_account_member',
        'is_platform_super_admin'
      )
  loop
    execute format(
      'grant execute on function %s to authenticated',
      helper
    );
  end loop;
end $$;

-- Remove both legacy and advisor-generated policy names before rebuilding the
-- effective policies. Email identity is deliberately not an authorization path.
drop policy if exists "Tenant members can view own account payments"
  on public.platform_payments;
drop policy if exists "Service role and Super Admins manage platform payments"
  on public.platform_payments;
drop policy if exists "platform_payments_select"
  on public.platform_payments;
drop policy if exists "platform_payments_modify"
  on public.platform_payments;

create policy "platform_payments_select"
  on public.platform_payments
  for select
  to authenticated
  using (
    public.is_active_account_member(account_id)
    or public.is_platform_super_admin()
  );

create policy "platform_payments_modify"
  on public.platform_payments
  for all
  to authenticated, service_role
  using (
    (select auth.role()) = 'service_role'
    or public.is_platform_super_admin()
  )
  with check (
    (select auth.role()) = 'service_role'
    or public.is_platform_super_admin()
  );

commit;
