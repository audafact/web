#!/bin/bash
#
# RESTORE DATABASE FROM R2 BACKUP
# Downloads a .dump file from R2 and restores to a TARGET database.
# TARGET must be staging or local - NEVER prod.
#
# Usage:
#   TARGET_DB_URL="postgresql://user:pass@host:5432/postgres" ./restore-from-r2.sh [filename.dump]
#   If filename omitted, lists available backups and prompts.
#
# Required env vars:
#   TARGET_DB_URL - Connection string for restore target (staging or local only)
#   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
#
# Optional: R2_BUCKET (default audafact-db-backups)

set -e

# Load scripts/.env if present (run from web/ dir)
if [ -f "scripts/.env" ]; then
  set +e
  source scripts/.env 2>/dev/null || true
  set -e
fi

# Always use backup bucket for db restores (ignore R2_BUCKET which may be for other uses)
R2_BUCKET="${R2_BACKUP_BUCKET:-audafact-db-backups}"
# Prefer backup credentials (scoped to backup bucket); fall back to general R2 creds
R2_ACCESS_KEY_ID="${R2_BACKUP_ACCESS_KEY_ID:-$R2_ACCESS_KEY_ID}"
R2_SECRET_ACCESS_KEY="${R2_BACKUP_SECRET_ACCESS_KEY:-$R2_SECRET_ACCESS_KEY}"
PROD_REF="julxtxaspzhwbylnqkkj"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Refuse to restore to prod
if echo "$TARGET_DB_URL" | grep -q "$PROD_REF"; then
  print_error "TARGET_DB_URL contains prod project ref. Restore to staging or local only."
fi

if [ -z "$TARGET_DB_URL" ]; then
  print_error "TARGET_DB_URL is required (e.g. postgresql://postgres:pass@host:5432/postgres)"
fi

for var in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
  if [ -z "${!var}" ]; then
    print_error "Missing required env var: $var"
  fi
done

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

if [ -n "$1" ]; then
  DUMP_FILE="$1"
else
  print_status "Available backups:"
  aws s3 ls "s3://${R2_BUCKET}/db/" --endpoint-url "$R2_ENDPOINT" | grep '\.dump$' || true
  echo ""
  read -p "Enter backup filename (e.g. supabase_prod_2025-02-19_0200.dump): " DUMP_FILE
  if [ -z "$DUMP_FILE" ]; then
    print_error "No filename provided"
  fi
fi

DUMP_PATH="/tmp/$DUMP_FILE"
print_status "Downloading $DUMP_FILE from R2..."

if ! aws s3 cp "s3://${R2_BUCKET}/db/${DUMP_FILE}" "$DUMP_PATH" --endpoint-url "$R2_ENDPOINT"; then
  print_error "Download failed"
fi

print_success "Downloaded. Restoring to target DB..."

# Supabase Cloud (staging) restricts postgres: cannot DROP/CREATE auth, storage, realtime.
# Restore only public schema there. Full restore works for local (127.0.0.1).
RESTORE_SCHEMA=""
RESTORE_EXCLUDE=""
if echo "$TARGET_DB_URL" | grep -qE '\.(supabase\.co|pooler\.supabase\.com)'; then
  RESTORE_SCHEMA="-n public"
  print_status "Supabase Cloud detected: restoring public schema only (auth/storage/realtime are managed)"
fi

# Prefer pg_restore from postgresql@17 (dumps use format 1.16; --exclude-function needs PG 17+)
PG_RESTORE="pg_restore"
for candidate in /opt/homebrew/opt/postgresql@17/bin/pg_restore /usr/local/opt/postgresql@17/bin/pg_restore; do
  if [ -x "$candidate" ]; then
    PG_RESTORE="$candidate"
    break
  fi
done

# Exclude handle_new_user when supported; older pg_restore treats unknown flags as fatal and restores nothing.
if [ -n "$RESTORE_SCHEMA" ] && "$PG_RESTORE" --help 2>&1 | grep -q "exclude-function"; then
  RESTORE_EXCLUDE="--exclude-function=public.handle_new_user()"
  print_status "Excluding public.handle_new_user() (use PostgreSQL 17+ client if this is missing)"
else
  print_warning "pg_restore has no --exclude-function; handle_new_user may log errors — restore should continue."
fi

set +e
# Allow partial restore: do not exit on errors (auth FKs, handle_new_user, etc.)
"$PG_RESTORE" \
  --dbname="$TARGET_DB_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  $RESTORE_SCHEMA \
  $RESTORE_EXCLUDE \
  "$DUMP_PATH" 2>&1 | tee /tmp/restore.log
RESTORE_STATUS=${PIPESTATUS[0]}
set -e

if [ "$RESTORE_STATUS" -ne 0 ] ||
  grep -qiE "unrecognized option:|fatal:" /tmp/restore.log 2>/dev/null; then
  print_warning "Restore problem (exit $RESTORE_STATUS). See /tmp/restore.log. Install postgresql@17 and re-run if you saw 'unrecognized option'."
elif grep -qi "^pg_restore:.*error" /tmp/restore.log 2>/dev/null; then
  print_warning "Restore finished with some object errors (common on Supabase). Check /tmp/restore.log."
else
  print_success "Restore finished (exit 0). Review /tmp/restore.log for details."
fi

rm -f "$DUMP_PATH"
print_success "Restore complete. Verify data in target DB."
