# Phase 1 Verification Checklist

## Overview

This document provides a step-by-step verification process to confirm that all requirements from PRD_01_Database_Schema_And_Models.md have been successfully implemented.

## Prerequisites

- Supabase project running
- Access to Supabase dashboard
- Environment variables configured
- Node.js and npm installed

## Step 1: Apply Database Migrations

### 1.1 Run Migration Files

Execute the following migrations in order:

```bash
# Navigate to web directory
cd web

# Apply migrations (run these in your Supabase project)
# 1. Create uploads table
supabase db reset --db-url "your-db-url" --file 20250101000009_create_uploads_table.sql

# 2. Add preview_key to library_tracks
supabase db reset --db-url "your-db-url" --file 20250101000010_add_preview_key_to_library.sql

# 3. Add quota and access control functions
supabase db reset --db-url "your-db-url" --file 20250101000011_add_quota_functions.sql
```

**✅ Verification**: All migrations run without errors

### 1.2 Verify Table Creation

In Supabase Dashboard → Table Editor:

**Uploads Table**:

- [ ] Table `uploads` exists
- [ ] Has columns: `id`, `user_id`, `file_key`, `content_type`, `size_bytes`, `title`, `created_at`, `updated_at`
- [ ] `id` is UUID PRIMARY KEY
- [ ] `user_id` references `auth.users(id)` with CASCADE delete
- [ ] `file_key` is TEXT NOT NULL
- [ ] `content_type` is TEXT NOT NULL
- [ ] `size_bytes` is BIGINT NOT NULL
- [ ] `title` is TEXT (nullable)
- [ ] `created_at` and `updated_at` are TIMESTAMPTZ with defaults

**Library Tracks Table**:

- [ ] Column `preview_key` exists (TEXT, nullable)
- [ ] Column `file_key` is NOT NULL
- [ ] Index `idx_library_tracks_preview_key` exists

## Step 2: Verify Indexes

### 2.1 Check Uploads Indexes

In Supabase Dashboard → SQL Editor:

```sql
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE tablename = 'uploads';
```

**Expected Results**:

- [ ] `idx_uploads_user_id` on `uploads(user_id)`
- [ ] `idx_uploads_created_at` on `uploads(created_at)`
- [ ] `idx_uploads_file_key` on `uploads(file_key)`
- [ ] Primary key index on `id`

### 2.2 Check Library Tracks Indexes

```sql
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE tablename = 'library_tracks';
```

**Expected Results**:

- [ ] `idx_library_tracks_preview_key` on `preview_key`
- [ ] All existing indexes still present

## Step 3: Verify Constraints

### 3.1 Check Uploads Constraints

```sql
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'uploads'::regclass;
```

**Expected Results**:

- [ ] `uploads_file_key_unique` - UNIQUE constraint on `file_key`
- [ ] `uploads_size_bytes_positive` - CHECK constraint ensuring `size_bytes > 0`
- [ ] Foreign key constraint on `user_id` referencing `auth.users(id)`

## Step 4: Verify Database Functions

### 4.1 Test Quota Function

```sql
-- Test with valid parameters
SELECT check_user_upload_quota(
  '00000000-0000-0000-0000-0000-000000000000'::uuid,
  1000000, -- 1MB
  100000000 -- 100MB limit
);

-- Expected: Returns TRUE (can upload)
```

### 4.2 Test Access Control Function

```sql
-- Test with valid parameters
SELECT check_library_access(
  '00000000-0000-0000-0000-0000-000000000000'::uuid,
  '00000000-0000-0000-0000-0000-000000000000'::uuid
);

-- Expected: Returns TRUE or FALSE based on track access
```

### 4.3 Test Usage Function

```sql
-- Test with valid parameters
SELECT * FROM get_user_upload_usage(
  '00000000-0000-0000-0000-0000-000000000000'::uuid,
  1 -- 1 day period
);

-- Expected: Returns table with usage statistics
```

## Step 5: Verify RLS Policies

### 5.1 Check Uploads RLS

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'uploads';
```

**Expected Results**:

- [ ] Policy: "Users can view their own uploads" (SELECT)
- [ ] Policy: "Users can insert their own uploads" (INSERT)
- [ ] Policy: "Users can update their own uploads" (UPDATE)
- [ ] Policy: "Users can delete their own uploads" (DELETE)
- [ ] Policy: "Service role can manage uploads" (ALL)

## Step 6: Verify Triggers

### 6.1 Check Updated At Trigger

```sql
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'uploads';
```

**Expected Results**:

- [ ] Trigger `update_uploads_updated_at` exists
- [ ] Fires BEFORE UPDATE
- [ ] Executes function `update_updated_at_column()`

## Step 7: Test TypeScript Integration

### 7.1 Verify Type Definitions

Check that `web/src/types/music.ts` contains:

**Upload Interface**:

- [ ] `file_key: string` (required)
- [ ] `content_type: string` (required)
- [ ] `size_bytes: number` (required)
- [ ] `title?: string` (optional)
- [ ] `updated_at: string` (required)

**LibraryTrack Interface**:

- [ ] `previewKey?: string` (optional)
- [ ] `rotationWeek?: number` (optional)
- [ ] `isActive?: boolean` (optional)

### 7.2 Verify Database Service Methods

Check that `web/src/services/databaseService.ts` contains:

**New Methods**:

- [ ] `checkUploadQuota(userId, fileSize, quotaLimit)`
- [ ] `checkLibraryAccess(userId, trackId)`
- [ ] `getUserUploadUsage(userId, periodDays)`
- [ ] `getUploadsWithPagination(userId, page, pageSize, filters)`

## Step 8: Run Automated Tests

### 8.1 Execute Test Script

```bash
# Install dependencies if needed
npm install @supabase/supabase-js dotenv

# Run test script
node scripts/test-database-functions.js
```

**Expected Results**:

- [ ] All tests pass without errors
- [ ] Table structure verification successful
- [ ] Function calls return expected results
- [ ] Index verification successful

## Step 9: Manual Database Operations

### 9.1 Test Upload Creation

```sql
-- Insert test upload
INSERT INTO uploads (user_id, file_key, content_type, size_bytes, title)
VALUES (
  '00000000-0000-0000-0000-0000-000000000000'::uuid,
  'test-file-key-123',
  'audio/wav',
  1048576,
  'Test Upload'
);

-- Verify insertion
SELECT * FROM uploads WHERE file_key = 'test-file-key-123';

-- Expected: Record created with all fields populated
```

### 9.2 Test Constraint Enforcement

```sql
-- Try to insert with negative size (should fail)
INSERT INTO uploads (user_id, file_key, content_type, size_bytes, title)
VALUES (
  '00000000-0000-0000-0000-0000-000000000000'::uuid,
  'test-file-key-124',
  'audio/wav',
  -1000,
  'Test Upload'
);

-- Expected: Constraint violation error
```

### 9.3 Test Unique Constraint

```sql
-- Try to insert duplicate file_key (should fail)
INSERT INTO uploads (user_id, file_key, content_type, size_bytes, title)
VALUES (
  '00000000-0000-0000-0000-0000-000000000000'::uuid,
  'test-file-key-123', -- Same as above
  'audio/mp3',
  2048576,
  'Duplicate Upload'
);

-- Expected: Unique constraint violation error
```

## Step 10: Performance Verification

### 10.1 Check Query Performance

```sql
-- Test index performance on uploads
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM uploads
WHERE user_id = '00000000-0000-0000-0000-0000-000000000000'::uuid
ORDER BY created_at DESC;

-- Expected: Uses index on user_id and created_at
```

## Success Criteria Checklist

### Database Schema ✅

- [ ] Uploads table created with all required columns
- [ ] Library tracks table updated with preview_key support
- [ ] Proper indexes created for performance
- [ ] All constraints properly enforced

### Database Functions ✅

- [ ] Quota checking function implemented
- [ ] Access control function implemented
- [ ] Usage tracking function implemented
- [ ] All functions return expected results

### TypeScript Integration ✅

- [ ] Type definitions updated
- [ ] Database service methods implemented
- [ ] All new methods properly typed

### Security & Access Control ✅

- [ ] RLS policies properly configured
- [ ] User isolation enforced
- [ ] Service role access granted

### Performance ✅

- [ ] Indexes improve query performance
- [ ] No regression in existing operations
- [ ] Functions execute efficiently

## Troubleshooting

### Common Issues

1. **Migration Errors**:

   - Check Supabase version compatibility
   - Verify SQL syntax for your PostgreSQL version
   - Check for existing table conflicts

2. **Function Errors**:

   - Verify function syntax
   - Check parameter types
   - Ensure proper permissions

3. **TypeScript Errors**:
   - Verify type definitions match database schema
   - Check import/export statements
   - Ensure proper nullability handling

### Rollback Plan

If issues arise, you can rollback using:

```sql
-- Drop functions
DROP FUNCTION IF EXISTS check_user_upload_quota;
DROP FUNCTION IF EXISTS check_library_access;
DROP FUNCTION IF EXISTS get_user_upload_usage;

-- Drop columns
ALTER TABLE library_tracks DROP COLUMN IF EXISTS preview_key;

-- Drop table (WARNING: This will delete all data)
DROP TABLE IF EXISTS uploads CASCADE;
```

## Next Steps

After successful verification:

1. **Document any deviations** from the PRD
2. **Update team** on completion status
3. **Begin Phase 2** (R2 CDN Configuration)
4. **Schedule Phase 3** (Worker API Core) planning

## Contact

For questions or issues during verification:

- **Backend Team**: Database and function issues
- **DevOps Team**: Migration and deployment issues
- **Frontend Team**: TypeScript integration issues
