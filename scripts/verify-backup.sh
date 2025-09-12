#!/bin/bash

# BACKUP VERIFICATION SCRIPT
# Purpose: Verify that database backup was completed successfully
# Date: 2025-01-XX

echo "🔍 Verifying Database Backup"
echo "============================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Find the most recent backup directory
BACKUP_DIR=$(ls -td migrations_backup_* 2>/dev/null | head -1)

if [ -z "$BACKUP_DIR" ]; then
    print_error "No backup directory found. Please run the backup script first:"
    echo "   ./scripts/create-db-backup.sh"
    exit 1
fi

print_status "Found backup directory: $BACKUP_DIR"

# Check if backup directory exists and has content
if [ ! -d "$BACKUP_DIR" ]; then
    print_error "Backup directory does not exist: $BACKUP_DIR"
    exit 1
fi

# Check backup manifest
MANIFEST_FILE="$BACKUP_DIR/backup_manifest.txt"
if [ -f "$MANIFEST_FILE" ]; then
    print_success "Backup manifest found"
    echo ""
    echo "📋 BACKUP MANIFEST:"
    echo "==================="
    cat "$MANIFEST_FILE"
    echo ""
else
    print_error "Backup manifest not found: $MANIFEST_FILE"
fi

# Check all required backup files
REQUIRED_FILES=(
    "complete_database_backup.sql"
    "schema_only_backup.sql"
    "data_only_backup.sql"
    "critical_tables_backup.sql"
)

echo "🔍 VERIFYING BACKUP FILES:"
echo "==========================="

ALL_FILES_VALID=true

for file in "${REQUIRED_FILES[@]}"; do
    FILE_PATH="$BACKUP_DIR/$file"
    
    if [ -f "$FILE_PATH" ]; then
        if [ -s "$FILE_PATH" ]; then
            FILE_SIZE=$(du -h "$FILE_PATH" | cut -f1)
            print_success "✓ $file - $FILE_SIZE"
        else
            print_error "✗ $file - EMPTY FILE"
            ALL_FILES_VALID=false
        fi
    else
        print_error "✗ $file - MISSING"
        ALL_FILES_VALID=false
    fi
done

# Check migration files backup
MIGRATIONS_BACKUP="$BACKUP_DIR/migrations_backup"
if [ -d "$MIGRATIONS_BACKUP" ]; then
    MIGRATION_COUNT=$(ls "$MIGRATIONS_BACKUP"/*.sql 2>/dev/null | wc -l)
    if [ "$MIGRATION_COUNT" -gt 0 ]; then
        print_success "✓ Migration files backup - $MIGRATION_COUNT files"
    else
        print_warning "⚠ Migration files backup directory exists but contains no .sql files"
    fi
else
    print_warning "⚠ Migration files backup directory not found"
fi

# Check total backup size
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo ""
echo "📊 BACKUP SUMMARY:"
echo "=================="
echo "Backup Directory: $BACKUP_DIR"
echo "Total Size: $TOTAL_SIZE"
echo "Backup Status: $([ "$ALL_FILES_VALID" = true ] && echo "✅ VALID" || echo "❌ INVALID")"

# Final recommendation
echo ""
if [ "$ALL_FILES_VALID" = true ]; then
    print_success "Backup verification completed successfully!"
    echo ""
    echo "🎯 Next Steps:"
    echo "1. Your database is safely backed up"
    echo "2. You can now run the migration script:"
    echo "   ./scripts/execute-safe-migrations.sh"
    echo "3. Keep this backup until migrations are verified successful"
    echo ""
    echo "⚠️  Important: Do not delete the backup directory until you've verified"
    echo "   that all migrations completed successfully and your data is intact."
else
    print_error "Backup verification failed!"
    echo ""
    echo "❌ Some backup files are missing or empty."
    echo "Please re-run the backup script:"
    echo "   ./scripts/create-db-backup.sh"
    echo ""
    echo "Do not proceed with migrations until backup verification passes."
    exit 1
fi
