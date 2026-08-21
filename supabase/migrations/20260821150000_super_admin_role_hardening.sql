-- Remove email-based platform authorization and protect the super-admin flag.
begin;

alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

-- Authenticated users may edit safe profile fields, but never elevate their own
-- platform role. Service-role operations retain full access.
revoke update on table public.profiles from authenticated;
grant update (full_name, updated_at) on table public.profiles to authenticated;

create or replace function public.is_platform_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and is_super_admin = true
  );
$$;

revoke all on function public.is_platform_super_admin() from public;
grant execute on function public.is_platform_super_admin() to authenticated;
grant execute on function public.is_platform_super_admin() to service_role;

-- Replace policies that previously accepted a hardcoded email address.
drop policy if exists "Tenant members can view own account payments"
  on public.platform_payments;
create policy "Tenant members can view own account payments"
  on public.platform_payments
  for select
  using (
    public.is_active_account_member(account_id)
    or public.is_platform_super_admin()
  );

drop policy if exists "Service role and Super Admins manage platform payments"
  on public.platform_payments;
create policy "Service role and Super Admins manage platform payments"
  on public.platform_payments
  for all
  using (
    auth.role() = 'service_role'
    or public.is_platform_super_admin()
  )
  with check (
    auth.role() = 'service_role'
    or public.is_platform_super_admin()
  );

commit;
