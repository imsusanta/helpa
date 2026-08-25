-- ============================================================
-- Migration: 20260822140000_harden_storage_and_invoker_functions.sql
-- Purpose: Fix remaining security advisors:
--          1. Converts helper functions to SECURITY INVOKER
--          2. Scopes public storage bucket SELECT policies to prevent unauthorized file listing
-- ============================================================

begin;

-- 1. Helper functions as SECURITY INVOKER
create or replace function public.is_platform_super_admin()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and is_super_admin = true
  );
$$;

create or replace function public.is_active_account_member(target_account_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.account_members
    where account_id = target_account_id and user_id = (select auth.uid()) and active
  );
$$;

create or replace function public.is_account_member(target_account_id uuid, minimum_role account_role_enum default 'viewer'::account_role_enum)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.account_members am
    where am.user_id = (select auth.uid())
      and am.account_id = target_account_id
      and am.active = true
      and case am.role
            when 'owner'  then 4
            when 'admin'  then 3
            when 'agent'  then 2
            when 'viewer' then 1
          end
        >=
          case minimum_role::text
            when 'owner'  then 4
            when 'admin'  then 3
            when 'agent'  then 2
            when 'viewer' then 1
          end
  );
$$;

-- 2. Public storage bucket listing policies
drop policy if exists "Avatars are publicly readable" on storage.objects;
drop policy if exists "Chat media is publicly readable" on storage.objects;
drop policy if exists "Flow media is publicly readable" on storage.objects;

drop policy if exists "Users can read their own avatars" on storage.objects;
create policy "Users can read their own avatars" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "Members can read chat media" on storage.objects;
create policy "Members can read chat media" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-media'
    and exists (
      select 1 from public.account_members am
      where am.user_id = (select auth.uid())
        and ('account-' || am.account_id::text) = (storage.foldername(objects.name))[1]
    )
  );

drop policy if exists "Members can read flow media" on storage.objects;
create policy "Members can read flow media" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'flow-media'
    and (
      exists (
        select 1 from public.account_members am
        where am.user_id = (select auth.uid())
          and ('account-' || am.account_id::text) = (storage.foldername(objects.name))[1]
      )
      or (select auth.uid())::text = (storage.foldername(name))[1]
    )
  );

commit;
