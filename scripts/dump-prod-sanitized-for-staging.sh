#!/usr/bin/env bash
# Read-only pg_dump of production for staging refresh.
#
# Source of truth: production (including changes made only in the SQL editor). Repo
# migrations may lag; this dump reflects live prod schema + data except the excludes below.
#
# INCLUDED (examples): public.app_config (demo / feature flags), library_tracks, and all
# other tables/schemas pg_dump emits by default — with DATA for those tables unless listed
# under “Data excluded”.
#
# Data excluded (TABLE DATA only; DDL for those tables still in the archive):
#   public: users, uploads, sessions, recordings, library_usage, invite_codes,
#           invite_code_redemptions, analytics_events
#   auth:   all tables (no prod credentials / sessions / MFA on staging)
#   storage.objects (file metadata); storage buckets definition kept
#   supabase_migrations.schema_migrations (prod migration log ≠ repo after editor drift)
#
# Usage (from web/):
#   source ../.env   # or: export DATABASE_URL='postgresql://postgres:PASS@db.REF.supabase.co:5432/postgres?sslmode=require'
#   ./scripts/dump-prod-sanitized-for-staging.sh
#
# Or set DATABASE_URL explicitly (recommended for CI).
#
# Restore: use scripts/restore-prod-sanitized-to-staging.sh (do NOT use pg_restore --clean on
# Supabase: postgres cannot DROP managed auth/storage/event-trigger objects).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$WEB_ROOT"

# Supabase hosted DBs are often newer than a default Homebrew pg_dump; 14.x aborts against PG17+.
for _pg17 in /opt/homebrew/opt/postgresql@17/bin /usr/local/opt/postgresql@17/bin; do
  if [ -x "$_pg17/pg_dump" ]; then
    export PATH="$_pg17:$PATH"
    break
  fi
done

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found. Install PostgreSQL client tools." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install PostgreSQL client tools." >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ] && [ -n "${VITE_SUPABASE_URL:-}" ] && [ -n "${VITE_SUPABASE_DB_PASS:-}" ]; then
  REF="$(printf '%s' "$VITE_SUPABASE_URL" | sed -E 's#^https://([^.]+)\.supabase\.co.*#\1#')"
  if [ -z "$REF" ] || [ "$REF" = "$VITE_SUPABASE_URL" ]; then
    echo "Could not parse project ref from VITE_SUPABASE_URL. Set DATABASE_URL." >&2
    exit 1
  fi
  DATABASE_URL="postgresql://postgres:${VITE_SUPABASE_DB_PASS}@db.${REF}.supabase.co:5432/postgres?sslmode=require"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Set DATABASE_URL, or VITE_SUPABASE_URL + VITE_SUPABASE_DB_PASS (e.g. from web/.env)." >&2
  exit 1
fi

OUT_DIR="${DUMP_DIR:-$WEB_ROOT/dumps}"
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="$OUT_DIR/prod_sanitized_${STAMP}.dump"

echo "Probing source database (read-only)…"

table_exists() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc \
    "SELECT 1 FROM pg_tables WHERE schemaname = '$1' AND tablename = '$2' LIMIT 1" | grep -q 1
}

append_exclude_data() {
  local schema="$1"
  local rel="$2"
  if table_exists "$schema" "$rel"; then
    PGDUMP_ARGS+=(--exclude-table-data="${schema}.${rel}")
  fi
}

PGDUMP_ARGS=(
  --format=custom
  --no-owner
  --no-privileges
  --file="$OUT_FILE"
)

# Public: app content tied to users / recordings pipeline + analytics
for rel in users uploads sessions recordings library_usage invite_codes invite_code_redemptions analytics_events; do
  append_exclude_data public "$rel"
done

# Auth: never copy prod credentials / sessions / MFA state
while read -r fullname; do
  [ -n "$fullname" ] && PGDUMP_ARGS+=(--exclude-table-data="$fullname")
done < <(psql "$DATABASE_URL" -Atqc "SELECT schemaname||'.'||tablename FROM pg_tables WHERE schemaname = 'auth' ORDER BY 1")

# Storage: keep bucket rows; drop object rows (upload metadata)
append_exclude_data storage objects

# Migration history on remote ≠ repo after SQL editor changes — avoid locking staging to prod’s migration log
append_exclude_data supabase_migrations schema_migrations

if table_exists public app_config; then
  _ac="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT count(*)::text FROM public.app_config")"
  echo "Source public.app_config: ${_ac} row(s) (will be included in dump)."
else
  echo "WARNING: public.app_config is missing on source — demo / app toggles will not copy to staging." >&2
  echo "         Add it on production (or restore from SQL), then re-run this script." >&2
fi

echo "Running pg_dump (this only reads from the source database)…"
pg_dump "${PGDUMP_ARGS[@]}" "$DATABASE_URL"

echo "Wrote: $OUT_FILE"
ls -lh "$OUT_FILE"
