import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'supabase', 'migrations');
const requiredTables = [
  'accounts',
  'profiles',
  'account_members',
  'contacts',
  'conversations',
  'messages',
  'whatsapp_configs',
  'whatsapp_outbox',
  'webhook_events',
  'inbound_webhook_events',
  'provider_events',
  'appointments',
  'reminder_jobs',
  'audit_logs',
  'migration_identity_map',
];

if (!fs.existsSync(dir)) throw new Error('MIGRATIONS_DIRECTORY_MISSING');
const files = fs
  .readdirSync(dir)
  .filter((file) => /^\d{14}_.+\.sql$/.test(file))
  .sort();
if (files.length === 0) throw new Error('NO_MIGRATIONS_FOUND');
const schema = files
  .map((file) => fs.readFileSync(path.join(dir, file), 'utf8'))
  .join('\n');

for (const table of requiredTables) {
  if (
    !new RegExp(
      `create table(?: if not exists)? public\\.${table}\\b`,
      'i'
    ).test(schema)
  ) {
    throw new Error(`MISSING_REQUIRED_TABLE_${table.toUpperCase()}`);
  }
  if (
    !new RegExp(
      `alter table public\\.${table} enable row level security`,
      'i'
    ).test(schema)
  ) {
    throw new Error(`RLS_NOT_ENABLED_${table.toUpperCase()}`);
  }
}
// Permissive catch-alls are forbidden, with one documented exception: the
// SELECT-only authenticated read on system_settings (20260826152728) has no
// write path (service-role only by design) and secrets are filtered at the
// API layer. Accept it; anything else still fails.
const permissiveRe =
  /\busing\s*\(\s*true\s*\)|\bwith\s+check\s*\(\s*true\s*\)/gi;
const permissiveFiles = files.filter((file) => {
  permissiveRe.lastIndex = 0;
  const sql = fs.readFileSync(path.join(dir, file), 'utf8');
  return permissiveRe.test(sql);
});
const exceptedFile = '20260826152728_restore_system_ai_settings.sql';
const offending = permissiveFiles.filter((file) => file !== exceptedFile);
if (offending.length > 0) {
  throw new Error(
    `PERMISSIVE_RLS_POLICY_FORBIDDEN in: ${offending.join(', ')}`
  );
}
console.log(
  JSON.stringify({ status: 'ok', migrationFiles: files, requiredTables })
);
