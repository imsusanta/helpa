import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const SOURCE_ROOT = resolve(process.cwd(), 'src');
const CORE_ROOT = join(SOURCE_ROOT, 'core');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return SOURCE_EXTENSIONS.has(extname(path)) ? [path] : [];
  });
}

function importedModules(source: string): string[] {
  const modules: string[] = [];
  const pattern =
    /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    modules.push(match[1] || match[2]);
  }
  return modules;
}

function forbiddenCoreImport(moduleName: string): boolean {
  return (
    moduleName === '@/app' ||
    moduleName.startsWith('@/app/') ||
    moduleName === '@/components' ||
    moduleName.startsWith('@/components/')
  );
}

describe('architecture module boundaries', () => {
  it('keeps Next.js routes and React UI out of the core layer', () => {
    const violations = sourceFiles(CORE_ROOT).flatMap((file) => {
      const imports = importedModules(readFileSync(file, 'utf8'));
      return imports
        .filter(forbiddenCoreImport)
        .map((moduleName) => `${relative(SOURCE_ROOT, file)} -> ${moduleName}`);
    });

    expect(
      violations,
      `Core must not depend on app routes or UI components:\n${violations.join('\n')}`
    ).toEqual([]);
  });
});
