import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { assertNotRetiredSupabaseUrl } from './lib/supabase-target.mjs';

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
const reportPath = path.join(
  process.cwd(),
  'artifacts',
  'supabase-migration-report.json'
);
const lockPath = path.join(process.cwd(), '.supabase-migration.lock');
const projectRef = process.env.SUPABASE_PROJECT_REF;
const target = process.env.MIGRATION_TARGET || 'staging';
const isProduction = target === 'production';
const placeholder = /placeholder|your-|dummy|example/i;

function fail(code) {
  throw new Error(code);
}

function assertPreflight() {
  if (!fs.existsSync(migrationsDir)) fail('MIGRATIONS_DIRECTORY_MISSING');
  if (!projectRef || !/^[a-z0-9]{20}$/i.test(projectRef)) {
    fail('INVALID_SUPABASE_PROJECT_REF');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
    fail('INSECURE_HTTP_ENDPOINT_FORBIDDEN');
  }
  try {
    assertNotRetiredSupabaseUrl(`https://${projectRef}.supabase.co`);
    if (supabaseUrl) assertNotRetiredSupabaseUrl(supabaseUrl);
  } catch {
    fail('RETIRED_SUPABASE_PROJECT');
  }

  if (
    !process.env.SUPABASE_ACCESS_TOKEN ||
    placeholder.test(process.env.SUPABASE_ACCESS_TOKEN)
  ) {
    fail('INVALID_SUPABASE_ACCESS_TOKEN');
  }
  if (
    !process.env.SUPABASE_DB_PASSWORD ||
    placeholder.test(process.env.SUPABASE_DB_PASSWORD)
  ) {
    fail('INVALID_SUPABASE_DB_PASSWORD');
  }
  if (isProduction) {
    if (process.env.MIGRATION_CONFIRM_PRODUCTION !== projectRef) {
      fail('PRODUCTION_CONFIRMATION_MISMATCH');
    }
    if (
      !process.env.SUPABASE_BACKUP_REFERENCE ||
      placeholder.test(process.env.SUPABASE_BACKUP_REFERENCE)
    ) {
      fail('PRODUCTION_BACKUP_REFERENCE_REQUIRED');
    }
  }
}

const FORBIDDEN_SQL_PATTERNS = [
  /\bdrop\s+database\b/i,
  /\bshutdown\b/i,
  /\bcopy\s+.*\s+to\s+program\b/i,
  /\bpg_read_file\b/i,
  /\bpg_write_file\b/i,
  /\bdblink_connect\b/i,
];

function validateMigrationFiles() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => /^\d{14}_[a-zA-Z0-9_-]+\.sql$/.test(file))
    .sort();

  if (files.length === 0) fail('NO_VALID_MIGRATIONS_FOUND');

  for (const file of files) {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    for (const pattern of FORBIDDEN_SQL_PATTERNS) {
      if (pattern.test(content)) {
        fail(`FORBIDDEN_SQL_PATTERN_DETECTED_${file}`);
      }
    }
  }
}

function migrationVersions() {
  validateMigrationFiles();
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => /^\d{14}_[a-zA-Z0-9_-]+\.sql$/.test(file))
    .sort()
    .map((file) => file.slice(0, 14));
}

function writeReport(report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

function run(command, args) {
  execFileSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
}

function main() {
  const report = {
    target,
    projectRef: projectRef || null,
    startedAt: new Date().toISOString(),
    migrationVersions: [],
    success: false,
    error: null,
  };
  let lockFd;
  try {
    assertPreflight();
    report.migrationVersions = migrationVersions();
    if (report.migrationVersions.length === 0) fail('NO_MIGRATIONS_FOUND');
    lockFd = fs.openSync(lockPath, 'wx');

    // Official Supabase CLI maintains migration history and stops at the
    // first SQL error. We deliberately do not send SQL through a REST API.
    run('supabase', [
      'link',
      '--project-ref',
      projectRef,
      '--password',
      process.env.SUPABASE_DB_PASSWORD,
    ]);
    run('supabase', ['db', 'push', '--linked', '--dry-run']);
    run('supabase', ['db', 'push', '--linked']);
    run('supabase', ['migration', 'list', '--linked']);

    report.success = true;
    report.completedAt = new Date().toISOString();
    writeReport(report);
    console.log('✅ Supabase database migrations applied successfully!');
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : 'MIGRATION_FAILED';
    report.error = errorMsg;
    report.completedAt = new Date().toISOString();
    writeReport(report);
    console.error(`\n❌ Migration preflight check failed: ${errorMsg}\n`);
    console.error(
      'To apply migrations automatically to your Supabase PostgreSQL database, configure:'
    );
    console.error(
      '  - SUPABASE_PROJECT_REF (20-character project ref from https://<ref>.supabase.co)'
    );
    console.error(
      '  - SUPABASE_ACCESS_TOKEN (from Supabase Dashboard → Account → Access Tokens)'
    );
    console.error('  - SUPABASE_DB_PASSWORD (your database password)\n');
    console.error(
      'Alternatively, you can apply the migration SQL scripts directly via the Supabase Dashboard SQL Editor:'
    );
    console.error(
      '  1. supabase/migrations/20260814000000_canonical_tenant_cutover.sql'
    );
    console.error(
      '  2. supabase/migrations/20260815100000_account_members_view.sql'
    );
    console.error(
      '  3. supabase/migrations/20260815120000_add_missing_inbox_columns.sql\n'
    );
    process.exitCode = 1;
  } finally {
    if (lockFd !== undefined) fs.closeSync(lockFd);
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  }
}

main();
