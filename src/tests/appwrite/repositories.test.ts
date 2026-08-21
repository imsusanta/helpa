import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Legacy repository contract cutover', () => {
  it('uses the Supabase admin client behind the compatibility boundary', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/infrastructure/appwrite/server.ts'),
      'utf8'
    );
    expect(source).toContain("from '@/lib/supabase/server'");
    expect(source).not.toContain("from 'node-appwrite'");
  });
});
