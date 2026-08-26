-- ============================================================
-- Harden profiles INSERT so a client cannot self-elevate.
--
-- The prior policy was:
--   CREATE POLICY profiles_insert ON public.profiles
--     FOR INSERT TO authenticated
--     WITH CHECK (user_id = auth.uid());
-- with INSERT granted to `authenticated`. The WITH CHECK constrained
-- only user_id — nothing stopped an authenticated user (who has no
-- profile row yet, exactly the state new signups can be in) from
-- inserting a row with:
--   * account_id = <victim tenant>, account_role = 'owner'
--     → passes every is_account_member(...) / has_account_role(...)
--       policy for that tenant (leads, invoices, appointments, ...), or
--   * is_super_admin = true
--     → passes is_platform_super_admin() / platform-payment modify paths.
-- Because those authorization helpers read public.profiles, a
-- client-writable profile row is an authorization root.
--
-- Fix (two layers):
--   1. Revoke INSERT from client roles. Profile creation is owned by the
--      handle_new_user() SECURITY DEFINER trigger and by server code
--      using the service-role client; no client (anon/authenticated)
--      path inserts profiles.
--   2. Keep a tightened INSERT policy as defense in depth: even if INSERT
--      is ever re-granted, a client may only insert its own,
--      non-privileged row bound to an account it already owns.
--
-- Idempotent: safe to run repeatedly.
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    -- 1. Remove client-role INSERT privilege (trigger/service-role only).
    REVOKE INSERT ON TABLE public.profiles FROM authenticated;
    REVOKE INSERT ON TABLE public.profiles FROM anon;

    -- 2. Replace the permissive INSERT policy with a hardened one.
    DROP POLICY IF EXISTS profiles_insert ON public.profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

    CREATE POLICY profiles_insert ON public.profiles
      FOR INSERT TO authenticated
      WITH CHECK (
        user_id = (SELECT auth.uid())
        -- Never allow a client to mint a platform super admin.
        AND is_super_admin IS NOT TRUE
        -- Only bind a profile to an account the caller already owns
        -- (or leave it unassigned); prevents attaching yourself to a
        -- victim tenant with an elevated role.
        AND (
          account_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.accounts a
            WHERE a.id = account_id
              AND a.owner_user_id = (SELECT auth.uid())
          )
        )
      );
  END IF;
END $$;
