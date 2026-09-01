#!/usr/bin/env bash
# Fresh-apply smoke test: apply all committed migrations to an EMPTY
# Supabase database and verify the resulting schema passes the static
# guards (validate + RLS invariants) against a live schema.
#
# This is the executable half of roadmap P1 ("migration rollback tests"):
# static scans prove files are well-formed; this proves they APPLY cleanly
# in order to a database with no prior state. Requires Docker (Supabase CLI
# runs the local stack in containers).
#
# Usage:
#   npm run supabase:fresh        # one-shot, tears down at the end
#   npm run supabase:fresh:keep   # leaves the stack running for inspection
set -euo pipefail

KEEP_STACK="${1:-}"
if ! command -v supabase >/dev/null 2>&1; then
  echo "✗ supabase CLI not found. Install: brew install supabase/tap/supabase"
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "✗ Docker is not running. Start Docker Desktop, then re-run."
  exit 1
fi

echo "== Fresh-apply smoke test =="
echo "[1/4] Stopping any existing local stack..."
supabase stop --no-backup >/dev/null 2>&1 || true

echo "[2/4] Starting clean local Supabase (Postgres + Auth)..."
supabase start >/dev/null 2>&1 || supabase start

echo "[3/4] Applying migrations to the empty database..."
supabase db reset --linked >/dev/null 2>&1 || supabase db reset

echo "[4/4] Running static guards against the live-applied schema..."
npm run supabase:validate
npm run supabase:invariants

echo ""
echo "✅ Fresh apply succeeded: all $(ls supabase/migrations/*.sql | wc -l | tr -d ' ') migrations applied in order, schema passes validate + invariants."

if [ "$KEEP_STACK" = "keep" ]; then
  echo "   (stack left running — run 'supabase stop' when done)"
else
  echo "[teardown] stopping stack..."
  supabase stop --no-backup >/dev/null 2>&1 || true
fi
