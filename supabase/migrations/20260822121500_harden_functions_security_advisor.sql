-- ============================================================
-- Migration: 20260822121500_harden_functions_security_advisor.sql
-- Purpose: Resolve all 50 database security advisor warnings:
--          1. Enforces immutable search_path (search_path = public, pg_temp)
--          2. Revokes public/anon/authenticated execution on internal functions
--          3. Grants execute exclusively to service_role and postgres
-- ============================================================

begin;

do $$
declare
  r record;
begin
  for r in (
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  ) loop
    -- 1. Fix mutable search_path
    execute format('alter function public.%I(%s) set search_path = public, pg_temp', r.proname, r.args);
    
    -- 2. Revoke public/anon/authenticated execution
    execute format('revoke execute on function public.%I(%s) from anon', r.proname, r.args);
    execute format('revoke execute on function public.%I(%s) from authenticated', r.proname, r.args);
    execute format('revoke execute on function public.%I(%s) from public', r.proname, r.args);
    
    -- 3. Grant exclusively to service_role and postgres
    execute format('grant execute on function public.%I(%s) to service_role', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to postgres', r.proname, r.args);
  end loop;
end $$;

commit;
