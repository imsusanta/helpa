#!/usr/bin/env bash
#
# Bring up a self-contained local development backend for Helpa inside a
# Cloud Agent VM: a Docker daemon, the local Supabase stack, the application
# database schema, and a generated .env.local. Safe to run repeatedly.
#
# Why this exists
#   Helpa is a Supabase-backed Next.js app. To run or test anything beyond the
#   public marketing pages an agent needs a real Postgres + Auth + REST stack.
#   The Supabase CLI provides that locally via Docker. Two environment quirks
#   are handled here:
#     1. Nested-container Docker needs the fuse-overlayfs storage driver and the
#        legacy iptables backend for container-to-container networking.
#     2. The committed supabase/migrations are a production "cutover" overlay
#        that assumes a pre-existing legacy database and does not apply cleanly
#        to an empty DB. The app's canonical, self-consistent schema is the
#        idempotent snapshot in scripts/supabase_schema_complete.sql, so we boot
#        the stack with an empty migrations set and apply that snapshot instead.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

log() { printf '\n[setup-local-supabase] %s\n' "$*"; }

# ---------------------------------------------------------------------------
# 0. Prerequisites (installed once; typically already present in the base image)
# ---------------------------------------------------------------------------
ensure_prerequisites() {
  if ! command -v docker >/dev/null 2>&1; then
    log "Installing Docker Engine."
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sudo sh /tmp/get-docker.sh >/dev/null 2>&1
  fi
  if ! command -v fuse-overlayfs >/dev/null 2>&1; then
    log "Installing fuse-overlayfs."
    sudo apt-get update -qq >/dev/null 2>&1 || true
    sudo apt-get install -y -qq fuse-overlayfs >/dev/null 2>&1 || true
  fi
  if ! command -v supabase >/dev/null 2>&1; then
    log "Installing the Supabase CLI."
    local arch
    arch="$(dpkg --print-architecture)"
    curl -fsSL "https://github.com/supabase/cli/releases/latest/download/supabase_linux_${arch}.tar.gz" -o /tmp/supabase.tar.gz
    sudo tar -xzf /tmp/supabase.tar.gz -C /usr/local/bin supabase
  fi
}

# ---------------------------------------------------------------------------
# 1. Docker daemon (nested-container aware)
# ---------------------------------------------------------------------------
ensure_docker() {
  if docker info >/dev/null 2>&1; then
    log "Docker daemon already running."
    return
  fi

  log "Configuring and starting the Docker daemon."
  sudo mkdir -p /etc/docker
  # fuse-overlayfs handles whiteout files in userspace (overlayfs mknod is not
  # permitted in the nested container); disable the containerd snapshotter.
  echo '{ "storage-driver": "fuse-overlayfs", "features": { "containerd-snapshotter": false }, "iptables": true }' \
    | sudo tee /etc/docker/daemon.json >/dev/null

  # The nftables backend cannot program docker's bridge rules here, which breaks
  # container-to-container networking. Use the legacy iptables backend.
  if command -v iptables-legacy >/dev/null 2>&1; then
    sudo update-alternatives --set iptables /usr/sbin/iptables-legacy >/dev/null 2>&1 || true
    sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy >/dev/null 2>&1 || true
  fi

  sudo bash -c 'nohup dockerd >/var/log/dockerd.log 2>&1 &'

  log "Waiting for Docker to become ready..."
  for _ in $(seq 1 30); do
    if sudo docker info >/dev/null 2>&1; then break; fi
    sleep 1
  done
  sudo docker info >/dev/null 2>&1 || { log "ERROR: Docker failed to start (see /var/log/dockerd.log)."; exit 1; }

  # Allow the non-root user to talk to the daemon for the rest of this session.
  sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
  log "Docker is ready."
}

# ---------------------------------------------------------------------------
# 2. Supabase local stack
# ---------------------------------------------------------------------------
ensure_supabase() {
  if supabase status >/dev/null 2>&1; then
    log "Supabase stack already running."
    return
  fi

  log "Starting the local Supabase stack (booting with an empty migration set)."
  local hold_dir mig_dir
  mig_dir="supabase/migrations"
  hold_dir="$(mktemp -d)"

  # Restore the migration files no matter how we leave this function (success,
  # error under `set -e`, or signal). An EXIT trap is used instead of a RETURN
  # trap because a failing command under `set -e` bypasses RETURN traps and
  # would otherwise leave the migrations directory empty.
  SETUP_MIG_HOLD_DIR="$hold_dir"
  SETUP_MIG_DIR="$mig_dir"
  restore_migrations() {
    [ -n "${SETUP_MIG_HOLD_DIR:-}" ] || return 0
    shopt -s nullglob
    local f
    for f in "$SETUP_MIG_HOLD_DIR"/*.sql; do
      mv "$f" "$SETUP_MIG_DIR/" 2>/dev/null || true
    done
    rmdir "$SETUP_MIG_HOLD_DIR" 2>/dev/null || true
    SETUP_MIG_HOLD_DIR=""
  }
  trap restore_migrations EXIT

  shopt -s nullglob
  local f
  for f in "$mig_dir"/*.sql; do
    mv "$f" "$hold_dir/"
  done

  # `supabase start` can return non-zero when an optional, non-essential
  # container (edge_runtime, imgproxy, vector, pooler) is unhealthy even though
  # the core stack (db, kong, auth, rest, storage) is fine. Exclude those and do
  # not abort on a non-zero exit; verify core health explicitly below instead.
  supabase start -x edge_runtime,imgproxy,vector,pooler >/dev/null 2>&1 || true

  restore_migrations
  trap - EXIT

  if ! supabase status >/dev/null 2>&1; then
    log "ERROR: the Supabase core stack did not become healthy."
    supabase status || true
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# 3. Application database schema
# ---------------------------------------------------------------------------
apply_schema() {
  local db_container
  db_container="$(docker ps --filter 'name=supabase_db' --format '{{.Names}}' | head -1)"
  if [ -z "$db_container" ]; then
    log "ERROR: could not locate the Supabase database container."
    exit 1
  fi

  log "Applying canonical schema (scripts/supabase_schema_complete.sql)."
  docker exec -i "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=0 \
    < scripts/supabase_schema_complete.sql >/dev/null 2>&1 || true

  log "Applying account_members compatibility view."
  docker exec -i "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=0 \
    < supabase/migrations/20260815100000_account_members_view.sql >/dev/null 2>&1 || true

  log "Granting Supabase API roles access to the public schema."
  # Recreating the public schema (or any custom bootstrap) can drop the default
  # privileges Supabase relies on; re-grant them so PostgREST roles can read.
  docker exec -i "$db_container" psql -U postgres -d postgres >/dev/null 2>&1 <<'SQL' || true
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
NOTIFY pgrst, 'reload schema';
SQL
  log "Schema ready."
}

# ---------------------------------------------------------------------------
# 4. .env.local (development configuration)
# ---------------------------------------------------------------------------
write_env_local() {
  if [ -f .env.local ] && grep -q '^NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321' .env.local; then
    log ".env.local already present; leaving it untouched."
    return
  fi

  log "Writing .env.local for the local Supabase stack."
  local status anon srk
  status="$(supabase status -o env 2>/dev/null)"
  anon="$(printf '%s\n' "$status" | grep '^ANON_KEY=' | cut -d'"' -f2)"
  srk="$(printf '%s\n' "$status" | grep '^SERVICE_ROLE_KEY=' | cut -d'"' -f2)"

  local enc tok pdf cron
  enc="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
  tok="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
  pdf="$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")"
  cron="$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")"

  cat > .env.local <<EOF
# Local development environment (Supabase local stack).
# Auto-generated by scripts/setup-local-supabase.sh — safe to delete/regenerate.
AUTH_PROVIDER=supabase
DATABASE_PROVIDER=supabase
MIGRATION_MODE=cutover

NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=$anon
SUPABASE_SERVICE_ROLE_KEY=$srk
SUPABASE_PROJECT_REF=localdevlocaldevlocal
SUPABASE_DB_PASSWORD=postgres

WHATSAPP_TOKEN_ENCRYPTION_KEY=$tok
ENCRYPTION_KEY=$enc
PDF_SIGNING_KEY=$pdf
CRON_SECRET=$cron

NEXT_PUBLIC_SITE_URL=http://localhost:3000
# Placeholder Meta credentials — WhatsApp embedded signup is not exercised locally.
NEXT_PUBLIC_META_APP_ID=000000000000000
NEXT_PUBLIC_META_CONFIG_ID=000000000000000
META_APP_ID=000000000000000
META_APP_SECRET=local-dev-meta-secret
META_CONFIG_ID=000000000000000
META_WEBHOOK_VERIFY_TOKEN=local-dev-verify-token
EOF
}

ensure_prerequisites
ensure_docker
ensure_supabase
apply_schema
write_env_local

log "Local Supabase backend is ready:"
log "  API:    http://127.0.0.1:54321"
log "  Studio: http://127.0.0.1:54323"
log "Start the app with: npm run dev  (http://localhost:3000)"
