import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Supabase-only compatibility facade audit', () => {
  it('contains no Appwrite endpoint, credential, session, or SDK behavior', () => {
    const clientFacade = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/appwrite-compat.ts'),
      'utf8'
    );
    const serverFacade = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/appwrite-server-compat.ts'),
      'utf8'
    );
    const source = `${clientFacade}\n${serverFacade}`;

    expect(source).not.toContain('appwrite.io');
    expect(source).not.toContain('appwrite.network');
    expect(source).not.toContain('X-Appwrite-');
    expect(source).not.toContain('appwrite_session');
    expect(source).not.toMatch(/from ['"]appwrite['"]/);
    expect(source).not.toMatch(/from ['"]node-appwrite['"]/);
    expect(source).toContain('@/lib/supabase/client');
    expect(source).toContain('@/lib/supabase/server');
  });

  it('does not expose public-any data permissions', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/appwrite-compat.ts'),
      'utf8'
    );

    for (const permission of [
      'read("any")',
      'write("any")',
      'update("any")',
      'delete("any")',
    ]) {
      expect(source).not.toContain(permission);
    }
  });
});
