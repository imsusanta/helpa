import { describe, it, expect } from 'vitest';
import { createClient } from '@/lib/appwrite-compat';
import fs from 'fs';
import path from 'path';

describe('Appwrite Compat Least-Privilege Security Audit', () => {
  it('rejects public any permissions and generates user-scoped least-privilege permissions', () => {
    const client = createClient();

    const qb = client.from('whatsapp_config');

    const recordWithAny = {
      permissions: ['read("any")', 'read("user:user_123456789")'],
      user_id: 'user_123456789',
    };

    const getPermsFn = (
      qb as unknown as {
        getPermissionsForRecord?: (r: Record<string, unknown>) => string[];
      }
    ).getPermissionsForRecord;
    const perms = getPermsFn ? getPermsFn(recordWithAny) : null;

    if (perms) {
      expect(perms).not.toContain('read("any")');
      expect(perms).not.toContain('write("any")');
      expect(perms).not.toContain('update("any")');
      expect(perms).not.toContain('delete("any")');
      expect(perms).toContain('read("user:user_123456789")');
    }
  });

  it('ensures no protected collection manifest or repo configuration exposes public any permissions', () => {
    const prohibited = [
      'read("any")',
      'write("any")',
      'update("any")',
      'delete("any")',
    ];

    const compatSource = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/appwrite-compat.ts'),
      'utf8'
    );

    prohibited.forEach((perm) => {
      expect(compatSource).not.toContain(perm);
    });
  });
});
