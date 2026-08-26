import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Supabase credential safety', () => {
  const serverSource = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/supabase/server.ts'),
    'utf8'
  );
  const clientSource = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/supabase/client.ts'),
    'utf8'
  );

  it('does not embed JWTs or project-specific fallback hosts', () => {
    for (const source of [serverSource, clientSource]) {
      expect(source).not.toMatch(
        /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/
      );
      expect(source).not.toMatch(/https:\/\/[a-z0-9]+\.supabase\.co/);
    }
  });

  it('requires runtime configuration for public and service-role clients', () => {
    expect(serverSource).toContain('requireSupabasePublicConfig()');
    expect(serverSource).toContain('requireSupabaseServiceRole()');
  });

  it('uses direct public environment references in the browser bundle', () => {
    expect(clientSource).toContain('process.env.NEXT_PUBLIC_SUPABASE_URL');
    expect(clientSource).toContain('process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
    expect(clientSource).not.toContain('process.env[name]');
  });

  it('does not let operator scripts fall back to the retired Helpa project', () => {
    const scriptsDir = path.join(process.cwd(), 'scripts');
    const scriptFiles = fs
      .readdirSync(scriptsDir)
      .filter((name) => name.endsWith('.mjs') || name.endsWith('.ts'));
    for (const name of scriptFiles) {
      const source = fs.readFileSync(path.join(scriptsDir, name), 'utf8');
      expect(source, name).not.toContain(
        'https://tmqlzsyqlprioeoowmtk.supabase.co'
      );
    }
  });

  it('documents the current production project as the script fallback', () => {
    const targetSource = fs.readFileSync(
      path.join(process.cwd(), 'scripts/lib/supabase-target.mjs'),
      'utf8'
    );
    expect(targetSource).toContain(
      'https://${CANONICAL_PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co'
    );
    expect(targetSource).toContain("'zsxhtcprjllesptvxlyq'");
  });
});
