import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Supabase cutover security audit', () => {
  it('contains no Appwrite network endpoint or credential fallback', () => {
    const sources = [
      'src/lib/appwrite-compat.ts',
      'src/lib/appwrite-server-compat.ts',
      'src/infrastructure/appwrite/server.ts',
      'src/lib/supabase/server.ts',
    ].map((file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8'));

    const combined = sources.join('\n');
    expect(combined).not.toContain('cloud.appwrite.io');
    expect(combined).not.toContain('X-Appwrite-Key');
    expect(combined).not.toContain('APPWRITE_API_KEY');
    expect(combined).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });
});
