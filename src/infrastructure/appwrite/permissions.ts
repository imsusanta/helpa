/**
 * Supabase authorization is enforced by PostgreSQL RLS, not document-level
 * permission strings. Kept temporarily so legacy repository signatures remain
 * source-compatible during the import rename.
 */
export function createTenantPermissions(_accountId: string): string[] {
  return [];
}
