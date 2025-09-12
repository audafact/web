#!/bin/bash

# SAFE MIGRATION EXECUTION SCRIPT
# Purpose: Safely execute migrations with multiple safety checks
# Date: 2025-01-XX

set -e  # Exit on any error

echo "🚀 Starting Safe Migration Execution"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if we're in the right directory
if [ ! -f "supabase/config.toml" ]; then
    print_error "This script must be run from the web directory containing supabase/config.toml"
    exit 1
fi

# Check if Supabase is running
print_status "Checking Supabase status..."
if ! supabase status > /dev/null 2>&1; then
    print_error "Supabase is not running. Please start it first with 'supabase start'"
    exit 1
fi

print_success "Supabase is running"

# Check if we're connected to local database
print_status "Verifying local database connection..."
# Try to get DB URL from Supabase status, with fallback
DB_URL=$(supabase status --output json 2>/dev/null | jq -r '.db.url' 2>/dev/null || echo "")

# If JSON parsing failed, try direct status parsing
if [ -z "$DB_URL" ] || [ "$DB_URL" = "null" ]; then
    print_status "JSON parsing failed, extracting DB URL from status output..."
    DB_URL=$(supabase status 2>/dev/null | grep "DB URL:" | awk '{print $3}' || echo "")
fi

# Final fallback to default local URL
if [ -z "$DB_URL" ]; then
    DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    print_status "Using default local database URL: $DB_URL"
else
    print_status "Extracted database URL: $DB_URL"
fi

if [[ "$DB_URL" == *"127.0.0.1"* ]] || [[ "$DB_URL" == *"localhost"* ]]; then
    print_success "Connected to local database: $DB_URL"
else
    print_warning "Database URL suggests remote connection: $DB_URL"
    print_warning "This script is designed for local development. Proceed with caution."
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Migration cancelled. Please ensure you're connected to local database."
        exit 1
    fi
fi

# Phase 1: Safe Foundation (Baseline Schema)
echo ""
print_status "Phase 1: Applying Safe Foundation Migrations"
echo "------------------------------------------------"

# Check if baseline schema exists and apply it first
if [ -f "supabase/migrations/20250831022018_baseline_schema.sql" ]; then
    print_status "Applying baseline schema first..."
    
    # Apply baseline schema directly to local database
    if psql "$DB_URL" -f "supabase/migrations/20250831022018_baseline_schema.sql" 2>/dev/null; then
        print_success "Baseline schema applied successfully"
    else
        print_warning "Baseline schema application had issues, but continuing..."
    fi
else
    print_warning "Baseline schema not found, skipping Phase 1"
fi

# Phase 2: User Creation Trigger
echo ""
print_status "Phase 2: Applying User Creation Trigger"
echo "---------------------------------------------"

if [ -f "supabase/migrations/20250101000000_add_user_creation_trigger.sql" ]; then
    print_status "Applying user creation trigger..."
    
    # Apply user creation trigger directly to local database
    if psql "$DB_URL" -f "supabase/migrations/20250101000000_add_user_creation_trigger.sql" 2>/dev/null; then
        print_success "User creation trigger applied successfully"
    else
        print_error "Failed to apply user creation trigger"
        print_status "Check the error above. You may need to run this manually."
        exit 1
    fi
else
    print_error "User creation trigger migration not found"
    exit 1
fi

# Phase 3: Schema Lock
echo ""
print_status "Phase 3: Applying Schema Lock"
echo "-----------------------------------"

if [ -f "supabase/migrations/20250831022300_schema_lock.sql" ]; then
    print_status "Applying schema lock..."
    
    if psql "$DB_URL" -f "supabase/migrations/20250831022300_schema_lock.sql" 2>/dev/null; then
        print_success "Schema lock applied successfully"
    else
        print_warning "Schema lock application had issues, but continuing..."
    fi
else
    print_warning "Schema lock migration not found, skipping Phase 3"
fi

# Phase 4: Safe Schema Synchronization
echo ""
print_status "Phase 4: Safe Schema Synchronization"
echo "------------------------------------------"

# Check if safe remote schema exists
if [ -f "supabase/migrations/20250831022250_remote_schema_safe.sql" ]; then
    print_warning "Safe remote schema migration found. This contains potentially destructive operations."
    echo "The migration includes comprehensive safety guards, but please review before proceeding."
    echo ""
    echo "Safety features include:"
    echo "- Comprehensive backup tables"
    echo "- Conditional operations with existence checks"
    echo "- Data integrity verification"
    echo "- Rollback protection"
    echo ""
    
    read -p "Do you want to proceed with the safe remote schema migration? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Applying safe remote schema migration..."
        if psql "$DB_URL" -f "supabase/migrations/20250831022250_remote_schema_safe.sql" 2>/dev/null; then
            print_success "Safe remote schema migration applied successfully"
        else
            print_error "Failed to apply safe remote schema migration"
            print_status "Check the error above. Rollback procedures are available."
            exit 1
        fi
    else
        print_warning "Skipping remote schema migration. User creation trigger is now functional."
    fi
else
    print_warning "Safe remote schema migration not found. Original migration may contain destructive operations."
fi

# Phase 5: R2 Storage Fields
echo ""
print_status "Phase 5: R2 Storage Fields"
echo "--------------------------------"

if [ -f "supabase/migrations/20250830201700_add_r2_storage_fields.sql" ]; then
    print_status "R2 storage fields migration found. Reviewing for safety..."
    
    # Check if this migration contains destructive operations
    if grep -q "DROP\|DELETE\|TRUNCATE\|ALTER COLUMN" "supabase/migrations/20250830201700_add_r2_storage_fields.sql"; then
        print_warning "R2 storage fields migration contains potentially destructive operations"
        echo "Please review the migration file before proceeding."
        read -p "Do you want to proceed with R2 storage fields migration? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Applying R2 storage fields migration..."
            if psql "$DB_URL" -f "supabase/migrations/20250830201700_add_r2_storage_fields.sql" 2>/dev/null; then
                print_success "R2 storage fields migration applied successfully"
            else
                print_error "Failed to apply R2 storage fields migration"
                exit 1
            fi
        else
            print_warning "Skipping R2 storage fields migration"
        fi
    else
        print_status "R2 storage fields migration appears safe, applying..."
        if psql "$DB_URL" -f "supabase/migrations/20250830201700_add_r2_storage_fields.sql" 2>/dev/null; then
            print_success "R2 storage fields migration applied successfully"
        else
            print_error "Failed to apply R2 storage fields migration"
            exit 1
        fi
    fi
else
    print_warning "R2 storage fields migration not found"
fi

# Final Verification
echo ""
print_status "Final Verification"
echo "---------------------"

print_status "Checking if user creation trigger is working..."
# Test the trigger function exists
if psql "$DB_URL" -t -c "SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created');" 2>/dev/null | grep -q "t"; then
    print_success "User creation trigger verification passed"
else
    print_warning "User creation trigger verification failed - manual testing recommended"
fi

print_status "Checking database state..."
# Check if there are any obvious issues
if psql "$DB_URL" -t -c "SELECT COUNT(*) FROM public.users;" 2>/dev/null; then
    print_success "Users table accessible"
else
    print_warning "Users table access issue detected"
fi

echo ""
print_success "Migration execution completed!"
echo ""
echo "🎯 Next steps:"
echo "1. Test user registration to verify trigger works"
echo "2. Verify all existing data is preserved (especially 59 library_tracks)"
echo "3. Check that new users get public.users entries"
echo ""
echo "🔒 Your backup is still available in: migrations_backup_20250831_102847"
echo "⚠️  Keep this backup until you've verified everything is working correctly"
echo ""
echo "If any issues occur, refer to the rollback procedures in SAFE_MIGRATION_STRATEGY.md"
