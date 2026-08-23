import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Legacy import facade boundaries', () => {
  it('keeps server compatibility imports on Supabase clients only', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/appwrite-server-compat.ts'),
      'utf8'
    );

    expect(source).toContain('createSupabaseServerClient');
    expect(source).toContain('getSupabaseAdminClient');
    expect(source).not.toContain('createDataClient');
    expect(source).not.toContain('APPWRITE_CONFIG');
    expect(source).not.toContain("next/headers");
  });
});
