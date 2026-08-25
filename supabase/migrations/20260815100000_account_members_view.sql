-- Backward compatibility view for account_members (no-op when canonical table exists)
DO $$
BEGIN
  -- If account_members is already a physical table, keep the canonical table
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'account_members'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'account_id'
  ) THEN
    CREATE OR REPLACE VIEW public.account_members AS
    SELECT 
      id,
      user_id,
      account_id,
      COALESCE(account_role::text, role, 'owner') AS role,
      true AS active,
      created_at,
      updated_at
    FROM public.profiles;

    GRANT SELECT ON public.account_members TO authenticated, service_role, anon;
  END IF;
END $$;

