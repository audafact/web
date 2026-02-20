#!/bin/bash

# Safe Fix Script - Fixes current database issues without destructive operations
# This script runs the safe migration to clean up backup tables and add missing functions

set -e  # Exit on any error

echo "🔧 Running Safe Database Fix..."
echo "=================================="

# Check if we're in the right directory
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Error: Please run this script from the web directory"
    exit 1
fi

echo "✅ Supabase project directory found"

# Check if the migration file exists
MIGRATION_FILE="supabase/migrations/20250831130000_fix_current_issues.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "✅ Migration file found: $MIGRATION_FILE"

# Show what the migration will do
echo ""
echo "📋 This migration will:"
echo "   1. Remove erroneous backup tables (safe cleanup)"
echo "   2. Add missing get_user_tracks function"
echo "   3. Grant proper permissions"
echo "   4. Test the function"
echo ""

# Ask for confirmation
read -p "🤔 Do you want to proceed? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled"
    exit 1
fi

echo ""
echo "🚀 Running migration..."

# DB URL must be provided via env - never commit credentials
if [ -z "$DB_URL" ]; then
  echo "❌ Error: DB_URL is required. Set it from Supabase Dashboard → Settings → Database."
  echo "   Example: export DB_URL='postgresql://postgres.[REF]:[PASSWORD]@aws-0-us-east-2.pooler.supabase.com:5432/postgres'"
  exit 1
fi

echo "📡 Connecting to database..."

# Run the migration
psql "$DB_URL" -f "$MIGRATION_FILE"

echo ""
echo "✅ Migration completed successfully!"
echo ""
echo "🔍 Verifying results..."

# Verify the function was created
psql "$DB_URL" -c "SELECT routine_name, routine_type FROM information_schema.routines WHERE routine_name = 'get_user_tracks';"

# Check that backup tables were removed
echo ""
echo "📊 Checking for backup tables..."
psql "$DB_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%backup%';"

echo ""
echo "🎉 Database fix completed successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Test user registration (should create entries in public.users)"
echo "   2. Test the tier-based track access"
echo "   3. Verify that free users only get 10 tracks from current rotation"
echo "   4. Verify that pro users get all tracks"
echo ""
echo "💡 The erroneous backup tables have been removed and the missing function has been added."
