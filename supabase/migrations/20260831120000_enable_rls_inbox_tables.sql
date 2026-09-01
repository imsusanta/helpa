-- ─────────────────────────────────────────────────────────────
-- Enable RLS on inbox-adjacent tables whose policies existed
-- without RLS being enabled.
--
-- Supabase only enforces row level security when the table-level
-- flag is ON. Policies on an RLS-disabled table are inert — every
-- authenticated browser client could read/write cross-tenant rows.
--
-- Both tables are referenced by inbox client code using the
-- anon/publishable key (template picker, thread reactions), so
-- the table-level flag is the actual security boundary for them.
--
-- message_reactions: policies created in 20260822123000 but the
--   ENABLE statement was never issued in any migration. Enabling
--   the flag is safe even on fresh stacks where the table does
--   not exist yet — IF EXISTS keeps this migration idempotent and
--   order-tolerant (the table may be created by a later migration
--   in some environments, e.g. 20260822124500).
-- message_templates: created out-of-band (not migration-managed);
--   this migration is idempotent and only enables the flag plus
--   tenant-isolation policies. The table may not exist in fresh
--   local stacks, so all statements are guarded.
-- ─────────────────────────────────────────────────────────────

-- message_reactions: enable the flag (policies already exist where
-- the table exists). IF EXISTS avoids 42P01 on databases where the
-- table hasn't been created yet.
alter table if exists public.message_reactions enable row level security;

-- message_templates: table may not exist in fresh stacks.
do $$
begin
  if to_regclass('public.message_templates') is not null then
    execute 'alter table public.message_templates enable row level security';

    -- Tenant isolation. Drop-and-recreate so re-running this
    -- migration never accumulates duplicate policies.
    execute 'drop policy if exists "message_templates_select" on public.message_templates';
    execute $policy$
      create policy "message_templates_select" on public.message_templates
        for select to authenticated
        using (
          is_account_member(account_id)
          or (user_id = auth.uid())
        )
    $policy$;

    execute 'drop policy if exists "message_templates_insert" on public.message_templates';
    execute $policy$
      create policy "message_templates_insert" on public.message_templates
        for insert to authenticated
        with check (
          has_account_role(account_id, 'agent')
          or (user_id = auth.uid())
        )
    $policy$;

    execute 'drop policy if exists "message_templates_update" on public.message_templates';
    execute $policy$
      create policy "message_templates_update" on public.message_templates
        for update to authenticated
        using (
          has_account_role(account_id, 'agent')
          or (user_id = auth.uid())
        )
        with check (
          has_account_role(account_id, 'agent')
          or (user_id = auth.uid())
        )
    $policy$;

    execute 'drop policy if exists "message_templates_delete" on public.message_templates';
    execute $policy$
      create policy "message_templates_delete" on public.message_templates
        for delete to authenticated
        using (
          has_account_role(account_id, 'admin')
          or (user_id = auth.uid())
        )
    $policy$;
  end if;
end
$$;
