#!/usr/bin/env bash
# Restore-drill verification helper (read-only). Prints the checks an
# operator should run and, when supabase is linked, executes the RLS
# verification query against the linked project.
set -euo pipefail

echo "== Restore & Rollback Drill — verification =="
echo "Full procedure: docs/rollbacks/RESTORE_DRILL.md"
echo

echo "[1/3] Backup reference required before any production change."
echo "      Set SUPABASE_BACKUP_REFERENCE to today's backup date and re-run the"
echo "      migration runner (npm run supabase:migrate)."
echo

echo "[2/3] Fresh-apply + invariant gate (scratch project):"
echo "      supabase db push --linked --include-all"
echo "      npm run supabase:validate"
echo "      npm run supabase:invariants"
echo

echo "[3/3] RLS-off scan — run this in SQL Editor (expect 0 rows):"
cat <<'SQL'
select relname, relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false;
SQL
echo

if command -v supabase >/dev/null 2>&1 && [ -f supabase/.temp/project-ref ] 2>/dev/null; then
  echo "supabase CLI detected; running RLS-off scan against linked project..."
  supabase db query --linked "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity=false;" 2>/dev/null || echo "(no linked project or query failed — run the SQL above manually)"
fi
