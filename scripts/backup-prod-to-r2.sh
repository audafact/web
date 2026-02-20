#!/bin/bash
#
# PRODUCTION DATABASE BACKUP TO R2
# Creates a pg_dump (custom format) of prod Supabase and uploads to R2.
# Run via GitHub Actions cron (daily) or manually with env vars set.
#
# Required env vars (never commit these):
#   PGHOST, PGUSER, PGPASSWORD, PGPORT (default 5432), PGDATABASE (default postgres)
#   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
#
# Optional: R2_BUCKET (default audafact-db-backups), RETENTION_DAYS (default 30)

set -e

RETENTION_DAYS="${RETENTION_DAYS:-30}"
R2_BUCKET="${R2_BUCKET:-audafact-db-backups}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-postgres}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Validate required env vars
for var in PGHOST PGUSER PGPASSWORD R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
  if [ -z "${!var}" ]; then
    print_error "Missing required env var: $var"
  fi
done

DUMP_FILE="supabase_prod_$(date +%F_%H%M).dump"
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

print_status "Starting prod backup to R2..."
print_status "Target: ${R2_BUCKET}/db/${DUMP_FILE}"

# pg_dump with custom format (recommended for restores)
export PGPASSWORD
export PGPORT
export PGDATABASE

if ! pg_dump \
  --host="$PGHOST" \
  --port="$PGPORT" \
  --username="$PGUSER" \
  --dbname="$PGDATABASE" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$DUMP_FILE"; then
  print_error "pg_dump failed"
fi

FILE_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
print_success "Dump created: $DUMP_FILE ($FILE_SIZE)"

# Upload to R2 via AWS CLI (S3-compatible)
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"

if ! aws s3 cp "$DUMP_FILE" "s3://${R2_BUCKET}/db/${DUMP_FILE}" \
  --endpoint-url "$R2_ENDPOINT" \
  --no-progress; then
  print_error "R2 upload failed"
fi

print_success "Uploaded to R2: ${R2_BUCKET}/db/${DUMP_FILE}"

# Retention: delete backups older than RETENTION_DAYS
print_status "Cleaning up backups older than ${RETENTION_DAYS} days..."
if date -v-${RETENTION_DAYS}d +%Y-%m-%d >/dev/null 2>&1; then
  CUTOFF=$(date -v-${RETENTION_DAYS}d +%Y-%m-%d)
else
  CUTOFF=$(date -d "${RETENTION_DAYS} days ago" +%Y-%m-%d)
fi

if [ -n "$CUTOFF" ]; then
  aws s3 ls "s3://${R2_BUCKET}/db/" --endpoint-url "$R2_ENDPOINT" 2>/dev/null | while read -r line; do
    date_part=$(echo "$line" | awk '{print $1}')
    file=$(echo "$line" | awk '{print $4}')
    if [ -n "$file" ] && [ -n "$date_part" ] && [[ "$date_part" < "$CUTOFF" ]]; then
      if aws s3 rm "s3://${R2_BUCKET}/db/${file}" --endpoint-url "$R2_ENDPOINT" 2>/dev/null; then
        print_status "Deleted old backup: $file"
      fi
    fi
  done
fi

rm -f "$DUMP_FILE"
print_success "Backup complete."
