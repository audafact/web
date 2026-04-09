#!/usr/bin/env bash
# Restore dumps/prod_sanitized_*.dump into STAGING Supabase.
#
# Do NOT use pg_restore --clean here: Supabase "postgres" is not superuser; --clean tries to
# DROP objects owned by Supabase in auth/storage/realtime and fails destructively.
#
# We restore public schema only (app tables, RLS, types, data) and skip auth/storage DDL.
# You will see "already exists" warnings if staging already has matching objects; new tables
# (e.g. app_config) still apply. Use the latest dump from dump-prod-sanitized-for-staging.sh.
#
# Prefer DIRECT DB URI for staging (db.<ref>.supabase.co:5432). Session pooler often works;
# transaction pooler is a poor match for pg_restore.
#
# Usage (from web/):
#   export STAGING_DATABASE_URL='postgresql://postgres:PASSWORD@db.YOUR_STAGING_REF.supabase.co:5432/postgres?sslmode=require'
#   ./scripts/restore-prod-sanitized-to-staging.sh [path/to/backup.dump]
#
# Or set TARGET_DB_URL in web/scripts/.env (not committed).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$WEB_ROOT"

for _pg17 in /opt/homebrew/opt/postgresql@17/bin /usr/local/opt/postgresql@17/bin; do
  if [ -x "$_pg17/pg_restore" ]; then
    export PATH="$_pg17:$PATH"
    break
  fi
done

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "pg_restore not found. Install PostgreSQL 17+ client tools." >&2
  exit 1
fi

STAGING_DB="${STAGING_DATABASE_URL:-${TARGET_DB_URL:-}}"
if [ -z "$STAGING_DB" ] && [ -f "$SCRIPT_DIR/.env" ]; then
  # shellcheck source=/dev/null
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
  STAGING_DB="${STAGING_DATABASE_URL:-${TARGET_DB_URL:-}}"
fi

if [ -z "$STAGING_DB" ]; then
  echo "Set STAGING_DATABASE_URL or TARGET_DB_URL (e.g. in web/scripts/.env)." >&2
  exit 1
fi

if [ "${1:-}" != "" ]; then
  DUMP="$1"
else
  DUMP="$(ls -t "$WEB_ROOT"/dumps/prod_sanitized_*.dump 2>/dev/null | head -1 || true)"
fi

if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  echo "No dump file. Pass path or run scripts/dump-prod-sanitized-for-staging.sh first." >&2
  exit 1
fi

echo "Restoring public schema from: $DUMP"
echo "(Ignoring duplicate DDL errors if staging already matches prod for many objects.)"

set +e
pg_restore \
  -d "$STAGING_DB" \
  --schema=public \
  --no-owner \
  --no-privileges \
  "$DUMP"
code=$?
set -e

if [ "$code" -ne 0 ]; then
  echo "pg_restore exited with status $code (common when many objects already exist). Verify staging: public.app_config, library_tracks, etc." >&2
fi

exit 0
