import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Supabase credential safety', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/supabase/server.ts'),
    'utf8'
  );

  it('does not embed JWTs or project-specific fallback hosts', () => {
    expect(source).not.toMatch(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/
    );
    expect(source).not.toMatch(/https:\/\/[a-z0-9]+\.supabase\.co/);
  });

  it('requires runtime configuration for public and service-role clients', () => {
    expect(source).toContain('requireSupabasePublicConfig()');
    expect(source).toContain('requireSupabaseServiceRole()');
  });
});
