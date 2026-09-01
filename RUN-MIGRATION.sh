#!/bin/zsh
# ─────────────────────────────────────────────────────────────
# Helpa — Supabase production migration (one command)
# Usage:
#   cd ~/.openclaw-autoclaw/workspace/helpa-migrate
#   ./RUN-MIGRATION.sh
# ─────────────────────────────────────────────────────────────
set -e

echo "==> Step 0: checking Supabase CLI..."
if ! command -v supabase >/dev/null 2>&1; then
  echo "    installing Supabase CLI via Homebrew..."
  brew install supabase/tap/supabase
fi
supabase --version

echo ""
echo "==> Step 1: load credentials from .env.migration.local"
if [ ! -f .env.migration.local ]; then
  echo ""
  echo "  ⚠️  .env.migration.local not found!"
  echo "  Create it first (values are NOT sent to me or anywhere):"
  echo ""
  echo "    cd ~/.openclaw-autoclaw/workspace/helpa-migrate"
  echo "    cp .env.migration.example .env.migration.local"
  echo "    nano .env.migration.local   # fill in 3 values"
  echo ""
  echo "  Where to find each value:"
  echo "   - SUPABASE_PROJECT_REF: dashboard URL https://supabase.com/dashboard/project/<REF>"
  echo "   - SUPABASE_ACCESS_TOKEN: supabase.com/dashboard/account/tokens → Generate token"
  echo "   - SUPABASE_DB_PASSWORD: the DB password you set at project creation"
  echo "                           (or reset it: Project Settings → Database → Reset database password)"
  echo ""
  exit 1
fi
set -a
source .env.migration.local
set +a

# Sanity check (values are masked)
echo "    PROJECT_REF : ${SUPABASE_PROJECT_REF:0:4}****${SUPABASE_PROJECT_REF: -2}"
echo "    ACCESS_TOKEN: ${SUPABASE_ACCESS_TOKEN:0:4}****"
echo "    DB_PASSWORD : **** (set)"

echo ""
echo "==> Step 2: confirm this is PRODUCTION"
if [ "$MIGRATION_TARGET" != "production" ]; then
  echo "    MIGRATION_TARGET must be 'production' in .env.migration.local"
  exit 1
fi
if [ "$MIGRATION_CONFIRM_PRODUCTION" != "$SUPABASE_PROJECT_REF" ]; then
  echo "    MIGRATION_CONFIRM_PRODUCTION must equal SUPABASE_PROJECT_REF (double-confirm)"
  exit 1
fi
if [ -z "$SUPABASE_BACKUP_REFERENCE" ]; then
  echo "    SUPABASE_BACKUP_REFERENCE is required — note today's auto-backup:"
  echo "    Dashboard → Database → Backups → note the latest backup id/date"
  echo "    Put that date string in .env.migration.local, e.g. 2026-08-31"
  exit 1
fi
echo "    confirmed. backup reference: $SUPABASE_BACKUP_REFERENCE"

echo ""
echo "==> Step 3: dry-run then apply all 38 migrations"
npm run supabase:migrate

echo ""
echo "==> Step 4: verify table list"
echo "    Run this in Supabase Dashboard → SQL Editor to verify:"
echo "    select table_name from information_schema.tables where table_schema='public' order by table_name;"
echo ""
echo "✅ Done. Post-merge checklist: message_reactions + message_templates should now exist with RLS ON."
