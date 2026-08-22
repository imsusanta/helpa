-- ============================================================
-- Migration: 20260822120000_fix_whatsapp_configs_security_invoker.sql
-- Purpose: Fix Supabase Lint: "Security Definer View" on public.whatsapp_configs.
--          Enforces security_invoker = true so querying users are bound by RLS.
-- ============================================================

begin;

-- If public.whatsapp_configs is a VIEW, set security_invoker to true
do $$
begin
  if exists (
    select 1
    from pg_views
    where schemaname = 'public' and viewname = 'whatsapp_configs'
  ) then
    execute 'alter view public.whatsapp_configs set (security_invoker = true)';
  end if;
end $$;

commit;
