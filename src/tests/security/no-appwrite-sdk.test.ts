import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walkTsFiles(full, acc);
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('Appwrite SDK excision', () => {
  it('does not keep the infrastructure or compat trees', () => {
    expect(
      fs.existsSync(path.join(process.cwd(), 'src/infrastructure/appwrite'))
    ).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'src/lib/appwrite'))).toBe(
      false
    );
    expect(
      fs.existsSync(path.join(process.cwd(), 'src/lib/appwrite-compat.ts'))
    ).toBe(false);
    expect(
      fs.existsSync(
        path.join(process.cwd(), 'src/lib/appwrite-server-compat.ts')
      )
    ).toBe(false);
  });

  it('does not import the Appwrite SDKs from application code or scripts', () => {
    const files = [
      ...walkTsFiles(path.join(process.cwd(), 'src')),
      ...walkTsFiles(path.join(process.cwd(), 'scripts')),
    ];
    const offenders: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      if (
        /from ['"]appwrite['"]/.test(source) ||
        /from ['"]node-appwrite['"]/.test(source) ||
        /require\(['"]appwrite['"]\)/.test(source) ||
        /require\(['"]node-appwrite['"]\)/.test(source)
      ) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps database facades on Supabase clients only', () => {
    const server = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/db/server.ts'),
      'utf8'
    );
    const client = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/db/client.ts'),
      'utf8'
    );
    expect(server).toContain('@/lib/supabase/server');
    expect(client).toContain('@/lib/supabase/client');
    expect(server).not.toContain('node-appwrite');
    expect(client).not.toContain("from 'appwrite'");
  });
});
