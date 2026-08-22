-- ============================================================
-- Migration: 20260822120500_fix_account_members_security_invoker.sql
-- Purpose: Fix Supabase Lint: "Security Definer View" on public.account_members.
--          Enforces security_invoker = true so querying users are bound by profiles RLS.
-- ============================================================

begin;

-- If public.account_members is a VIEW, set security_invoker to true
do $$
begin
  if exists (
    select 1
    from pg_views
    where schemaname = 'public' and viewname = 'account_members'
  ) then
    execute 'alter view public.account_members set (security_invoker = true)';
  end if;
end $$;

commit;
