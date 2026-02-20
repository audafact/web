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

R2_BUCKET="${R2_BUCKET:-audafact-db-backups}"
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

pg_restore \
  --dbname="$TARGET_DB_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  "$DUMP_PATH"

rm -f "$DUMP_PATH"
print_success "Restore complete. Verify data in target DB."
