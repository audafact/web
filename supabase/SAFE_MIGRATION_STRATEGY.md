# SAFE MIGRATION STRATEGY

## Ensuring User Creation Trigger with Data Protection

### Overview

This document outlines a comprehensive, safe migration strategy to ensure that when users register via Supabase auth, corresponding entries are automatically created in the `public.users` table, while preserving all existing data (especially the 59 library_tracks entries).

### Current Issues Identified

1. **Missing User Creation Trigger**: The `handle_new_user` function exists in baseline schema but the trigger is missing
2. **Migration Order Problem**: User trigger migration runs before baseline schema that creates the function
3. **Potentially Destructive Operations**: Remote schema migration contains operations that could affect existing data
4. **Linter Configuration Issues**: SQL linter is incorrectly flagging valid SQL syntax

### Migration Files Status

#### ✅ SAFE MIGRATIONS

- `20250101000000_add_user_creation_trigger.sql` - **SAFE** - Creates user creation trigger with function
- `20250831022300_schema_lock.sql` - **SAFE** - Adds schema protection comments
- `20250831022018_baseline_schema.sql` - **SAFE** - Baseline schema creation

#### ⚠️ POTENTIALLY DESTRUCTIVE MIGRATIONS

- `20250831022250_remote_schema.sql` - **RISKY** - Contains DROP operations and ALTER COLUMN
- `20250831022250_remote_schema_safe.sql` - **SAFE VERSION** - Contains all safety guards
- `20250830201700_add_r2_storage_fields.sql` - **NEEDS REVIEW** - R2 storage field additions

#### 🔒 SAFETY GUARDS IMPLEMENTED

1. **Comprehensive Backup Strategy**

   - Multiple backup layers before any changes
   - Complete database dumps (schema + data)
   - Critical tables backup with verification
   - Migration files backup
   - Data integrity verification after backup

2. **Conditional Operations**

   - All destructive operations wrapped in existence checks
   - Operations only run if needed
   - Safe fallbacks for missing objects

3. **Data Type Validation**

   - Column type changes only if necessary
   - Safe conversion with error handling
   - Sample data inspection before changes

4. **Rollback Protection**
   - Backup tables remain available
   - Migration can be safely reversed
   - Data integrity checks throughout

### 🔐 COMPREHENSIVE BACKUP PROCESS

**BEFORE running any migrations, you MUST create a complete database backup:**

#### Step 1: Run the Backup Script

```bash
# Make sure you're in the web directory
cd /Users/david/Desktop/development/audafact/web

# Run the comprehensive backup script
./scripts/create-db-backup.sh
```

#### Step 2: Verify Backup Integrity

The backup script will create:

- **Complete Database Backup**: Full schema + data dump
- **Schema-Only Backup**: Structure without data
- **Data-Only Backup**: Data without structure
- **Critical Tables Backup**: SQL script for essential tables
- **Migration Files Backup**: Copy of all migration files
- **Backup Manifest**: Complete documentation of what was backed up

#### Step 3: Confirm Backup Success

- ✅ All backup files have content (not empty)
- ✅ Backup directory contains expected files
- ✅ Backup manifest is created and readable
- ✅ Total backup size is reasonable

### Recommended Migration Order

1. **Phase 0: Database Backup** 🔐 **REQUIRED FIRST**

   - Run `./scripts/create-db-backup.sh`
   - Verify all backup files are created successfully
   - Keep backup until migrations are verified successful

2. **Phase 1: Safe Foundation** ✅

   - Apply baseline schema (creates tables and functions)
   - Apply schema lock (protects existing structures)

3. **Phase 2: User Creation Trigger** ✅

   - Apply user creation trigger migration
   - Verify trigger creation and function existence

4. **Phase 3: Safe Schema Synchronization** ⚠️

   - Apply safe remote schema migration (with all guards)
   - Monitor data integrity throughout process

5. **Phase 4: R2 Storage Fields** ⚠️
   - Review and apply R2 storage field additions
   - Ensure no data loss

### Pre-Migration Checklist

- [ ] **Database backup completed** - Run `./scripts/create-db-backup.sh`
- [ ] **Backup verification passed** - All files have content and reasonable sizes
- [ ] **Backup manifest reviewed** - Understand what was backed up
- [ ] **All existing data verified** (especially 59 library_tracks)
- [ ] **Migration files reviewed for safety**
- [ ] **Rollback plan prepared**
- [ ] **Test environment validation completed**

### Post-Migration Verification

- [ ] **User creation trigger working correctly**
- [ ] **All existing data preserved** (verify 59 library_tracks still exist)
- [ ] **New user registrations create public.users entries**
- [ ] **No data integrity issues**
- [ ] **All functions and triggers operational**
- [ ] **Backup files remain intact** (don't delete until verified)

### Rollback Plan

If any issues occur:

1. **Immediate Rollback from Backup Tables**

   ```sql
   -- Restore from critical tables backup
   DROP TABLE IF EXISTS public.library_tracks;
   ALTER TABLE library_tracks_backup_critical RENAME TO library_tracks;

   -- Verify data is restored
   SELECT COUNT(*) FROM public.library_tracks; -- Should show 59
   ```

2. **Complete Database Restore**

   ```bash
   # Restore from complete backup
   psql -f migrations_backup_YYYYMMDD_HHMMSS/complete_database_backup.sql
   ```

3. **Migration Rollback**

   ```bash
   supabase db reset
   # Re-apply only safe migrations
   ```

4. **Data Recovery from Multiple Sources**
   - Use backup tables to restore data
   - Use complete database dump if needed
   - Verify data integrity
   - Re-run safe migrations only

### Safety Features

- **Multiple Backup Layers**: Redundant backup tables + SQL dumps
- **Conditional Logic**: Operations only run when safe
- **Data Validation**: Integrity checks throughout process
- **Error Handling**: Graceful failure with rollback options
- **Audit Trail**: Comprehensive logging of all operations
- **Backup Verification**: Automatic checks that backups are valid

### Execution Commands

```bash
# 1. CREATE BACKUP (REQUIRED FIRST)
./scripts/create-db-backup.sh

# 2. VERIFY BACKUP SUCCESS
ls -la migrations_backup_YYYYMMDD_HHMMSS/
cat migrations_backup_YYYYMMDD_HHMMSS/backup_manifest.txt

# 3. RUN SAFE MIGRATIONS
./scripts/execute-safe-migrations.sh

# 4. TEST USER CREATION TRIGGER
psql -f scripts/test-user-creation-trigger.sql
```

### Next Steps

1. **Run the backup script**: `./scripts/create-db-backup.sh`
2. **Verify backup integrity** - Check all files have content
3. **Review backup manifest** - Understand what was backed up
4. **Execute safe migrations** - Run `./scripts/execute-safe-migrations.sh`
5. **Test and verify** - Ensure user creation trigger works
6. **Keep backup until verified** - Don't delete until you're confident

### Contact

For questions or issues during migration, refer to this document and the rollback procedures outlined above. The backup script provides comprehensive protection for your data.
