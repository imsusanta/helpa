import fs from 'node:fs';
import path from 'node:path';

/**
 * Schema-invariant guard: every table that declares at least one RLS policy
 * must also ENABLE ROW LEVEL SECURITY, and every UPDATE policy must carry
 * both USING and WITH CHECK.
 *
 * Rationale: PR #209 found tables with reviewed, correct policies where the
 * table-level `ENABLE ROW LEVEL SECURITY` flag was missing — on Postgres,
 * policies on an RLS-disabled table are completely inert, so any
 * authenticated client could read/write cross-tenant rows. Policies are
 * also forbidden from being written as permissive catch-alls
 * (`USING (true)` / `WITH CHECK (true)`).
 *
 * This check is static (migration files are the schema source of truth) and
 * runs in CI via npm run supabase:validate. It is a property test on the
 * schema, not a behavior test: the invariant "policies imply enforcement"
 * must hold for every migration, present and future.
 */

const dir = path.join(process.cwd(), 'supabase', 'migrations');

if (!fs.existsSync(dir)) {
  throw new Error('MIGRATIONS_DIRECTORY_MISSING');
}

const files = fs
  .readdirSync(dir)
  .filter((file) => /^\d{14}_.+\.sql$/.test(file))
  .sort();

if (files.length === 0) throw new Error('NO_MIGRATIONS_FOUND');

const problems = [];

// Track per-table RLS state across the concatenated migration history.
const rlsEnabled = new Map(); // table -> migration that enabled RLS
const tablesWithPolicies = new Map(); // table -> Set<migration>
const updatePolicies = new Map(); // "table|policy" -> { using, withCheck }

const CREATE_TABLE_RE = /create table(?: if not exists)?\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi;
const ENABLE_RLS_RE = /alter table(?: if exists)?\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+enable row level security/gi;
const CREATE_POLICY_RE = /create policy\s+(?:if not exists\s+)?"?([a-z0-9_]+)"?\s+on\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi;
const UPDATE_POLICY_RE = /create policy\s+(?:if not exists\s+)?"?([a-z0-9_]+)"?\s+on\s+(?:public\.)?([a-z_][a-z0-9_]*)[^;]*?\bfor update\b/gi;
const USING_RE = /\busing\b/gi;
const WITH_CHECK_RE = /\bwith check\b/gi;

for (const file of files) {
  const sql = fs.readFileSync(path.join(dir, file), 'utf8');
  const rel = path.relative(process.cwd(), path.join(dir, file));

  for (const m of sql.matchAll(CREATE_TABLE_RE)) {
    const table = m[1].toLowerCase();
    if (!rlsEnabled.has(table)) rlsEnabled.set(table, null);
    if (!tablesWithPolicies.has(table)) tablesWithPolicies.set(table, new Set());
  }

  for (const m of sql.matchAll(ENABLE_RLS_RE)) {
    rlsEnabled.set(m[1].toLowerCase(), rel);
  }

  for (const m of sql.matchAll(CREATE_POLICY_RE)) {
    const [, policy, table] = m;
    const t = table.toLowerCase();
    if (!rlsEnabled.has(t)) rlsEnabled.set(t, null);
    if (!tablesWithPolicies.has(t)) tablesWithPolicies.set(t, new Set());
    tablesWithPolicies.get(t).add(rel);
  }

  // For UPDATE policies, inspect the full statement for USING / WITH CHECK.
  const statements = sql.split(';');
  for (const stmt of statements) {
    const pm = stmt.match(UPDATE_POLICY_RE);
    if (!pm) continue;
    const [, policy, table] = pm;
    const key = `${table.toLowerCase()}|${policy.toLowerCase()}`;
    const hasUsing = USING_RE.test(stmt);
    const hasWithCheck = WITH_CHECK_RE.test(stmt);
    USING_RE.lastIndex = 0;
    WITH_CHECK_RE.lastIndex = 0;
    const prev = updatePolicies.get(key) || { using: false, withCheck: false };
    updatePolicies.set(key, {
      using: prev.using || hasUsing,
      withCheck: prev.withCheck || hasWithCheck,
    });
  }

  // Permissive catch-alls stay forbidden (carried over from validate script).
  if (/\busing\s*\(\s*true\s*\)|\bwith\s+check\s*\(\s*true\s*\)/i.test(sql)) {
    problems.push(`${rel}: PERMISSIVE_RLS_POLICY_FORBIDDEN (USING/WITH CHECK (true))`);
  }
}

// Invariant 1: every policy-bearing table must have the ENABLE flag somewhere
// in the migration history.
for (const [table, migrations] of tablesWithPolicies) {
  if (migrations.size === 0) continue;
  if (!rlsEnabled.get(table)) {
    problems.push(
      `RLS_FLAG_MISSING: table "${table}" has policies in ${[...migrations].join(', ')} but no migration issues ENABLE ROW LEVEL SECURITY (policies are inert)`
    );
  }
}

// Invariant 2: every UPDATE policy must declare both USING and WITH CHECK.
for (const [key, clauses] of updatePolicies) {
  if (!clauses.using || !clauses.withCheck) {
    const missing = [
      !clauses.using ? 'USING' : null,
      !clauses.withCheck ? 'WITH CHECK' : null,
    ]
      .filter(Boolean)
      .join(' and ');
    problems.push(`UPDATE_POLICY_INCOMPLETE: "${key}" is missing ${missing}`);
  }
}

if (problems.length > 0) {
  console.error(`\nRLS invariant violations (${problems.length}):\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(
    '\nPolicies on an RLS-disabled table are inert — add "ALTER TABLE ... ENABLE ROW LEVEL SECURITY" and pair every UPDATE policy USING with WITH CHECK.'
  );
  process.exit(1);
}

console.log(
  JSON.stringify({
    status: 'ok',
    checkedMigrations: files.length,
    tablesWithPolicies: [...tablesWithPolicies.keys()],
    updatePoliciesChecked: updatePolicies.size,
    invariants: [
      'policy-bearing tables must ENABLE ROW LEVEL SECURITY',
      'UPDATE policies must pair USING with WITH CHECK',
      'no permissive (true) catch-all policies',
    ],
  })
);
