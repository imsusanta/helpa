-- Backward compatibility view for account_members referencing profiles
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
