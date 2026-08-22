import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const recoveryMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260822130000_restore_rls_authorization_invariants.sql'
  ),
  'utf8'
);

describe('Supabase migration authorization regressions', () => {
  it('restores authenticated execution only for explicit RLS helpers', () => {
    for (const helper of [
      'is_active_account_member',
      'has_account_role',
      'is_account_member',
      'is_platform_super_admin',
    ]) {
      expect(recoveryMigration).toContain(`'${helper}'`);
    }

    expect(recoveryMigration).toContain(
      'grant execute on function %s to authenticated'
    );
    expect(recoveryMigration).not.toMatch(
      /grant execute on all functions in schema public to authenticated/i
    );
  });

  it('keeps platform administration persisted-role-only', () => {
    expect(recoveryMigration).toContain('public.is_platform_super_admin()');
    expect(recoveryMigration).not.toMatch(/profiles\.email/i);
    expect(recoveryMigration).not.toMatch(/@[a-z0-9.-]+/i);
  });

  it('replaces both legacy and advisor-generated payment policies', () => {
    expect(recoveryMigration).toContain(
      'drop policy if exists "Tenant members can view own account payments"'
    );
    expect(recoveryMigration).toContain(
      'drop policy if exists "platform_payments_select"'
    );
    expect(recoveryMigration).toContain(
      'create policy "platform_payments_modify"'
    );
  });
});
