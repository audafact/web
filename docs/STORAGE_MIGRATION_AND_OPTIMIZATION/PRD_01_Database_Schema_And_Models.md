# PRD: Phase 1 - Database Schema & Models

## Overview

Establish the foundational database schema and models required to support the R2 storage migration and new media lifecycle management.

## Objectives

- Create uploads table for user-generated content
- Enhance library tracks table with preview support
- Implement proper constraints and indexing
- Add database functions for quota and access control

## Success Criteria

- [ ] Uploads table created with all required columns
- [ ] Library tracks table updated with preview_key support
- [ ] Proper indexes created for performance
- [ ] Database functions implemented for quota checking
- [ ] All constraints properly enforced

## Technical Requirements

### Uploads Table Schema

```sql
CREATE TABLE uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_uploads_user_id ON uploads(user_id);
CREATE INDEX idx_uploads_created_at ON uploads(created_at);
CREATE INDEX idx_uploads_file_key ON uploads(file_key);

-- Constraints
ALTER TABLE uploads ADD CONSTRAINT uploads_file_key_unique UNIQUE(file_key);
ALTER TABLE uploads ADD CONSTRAINT uploads_size_bytes_positive CHECK(size_bytes > 0);
```

### Library Tracks Table Updates

```sql
-- Add preview_key column
ALTER TABLE library_tracks ADD COLUMN preview_key TEXT;

-- Update existing tracks to ensure file_key is NOT NULL
ALTER TABLE library_tracks ALTER COLUMN file_key SET NOT NULL;

-- Add index for preview_key
CREATE INDEX idx_library_tracks_preview_key ON library_tracks(preview_key);
```

### Database Functions

#### Quota Checking Function

```sql
CREATE OR REPLACE FUNCTION check_user_upload_quota(
  user_id UUID,
  file_size BIGINT,
  quota_limit BIGINT DEFAULT 100000000 -- 100MB default
) RETURNS BOOLEAN AS $$
BEGIN
  -- Check daily upload size
  DECLARE
    daily_total BIGINT;
  BEGIN
    SELECT COALESCE(SUM(size_bytes), 0)
    INTO daily_total
    FROM uploads
    WHERE user_id = $1
    AND created_at >= CURRENT_DATE;

    RETURN (daily_total + file_size) <= quota_limit;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Access Control Function

```sql
CREATE OR REPLACE FUNCTION check_library_access(
  user_id UUID,
  track_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user has access to pro-only tracks
  DECLARE
    track_is_pro BOOLEAN;
    user_tier TEXT;
  BEGIN
    SELECT is_pro_only INTO track_is_pro
    FROM library_tracks
    WHERE id = track_id;

    IF NOT track_is_pro THEN
      RETURN TRUE; -- Free tracks accessible to all
    END IF;

    -- Check user tier for pro tracks
    SELECT tier INTO user_tier
    FROM user_profiles
    WHERE user_id = $1;

    RETURN user_tier IN ('pro', 'enterprise');
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Implementation Steps

### Step 1: Create Migration Files

1. Create `20250101000009_create_uploads_table.sql`
2. Create `20250101000010_add_preview_key_to_library.sql`
3. Create `20250101000011_add_quota_functions.sql`

### Step 2: Update Database Models

1. Update `src/types/music.ts` to include new upload types
2. Update `src/services/databaseService.ts` to handle new tables
3. Add upload-related database operations

### Step 3: Test Database Changes

1. Run migrations in development environment
2. Verify all constraints work correctly
3. Test quota and access control functions
4. Validate indexing performance

## Dependencies

- None (Foundation phase)

## Risks & Mitigation

- **Risk**: Breaking existing library tracks data
  - **Mitigation**: Test migrations thoroughly in development
- **Risk**: Performance impact of new indexes
  - **Mitigation**: Monitor query performance and adjust as needed

## Testing Requirements

- [ ] Migration scripts run successfully
- [ ] All constraints enforced correctly
- [ ] Indexes improve query performance
- [ ] Functions return expected results
- [ ] No data loss during migration

## Definition of Done

- [ ] All migration files created and tested
- [ ] Database schema updated in development
- [ ] Type definitions updated
- [ ] Database service methods implemented
- [ ] All tests passing
- [ ] Documentation updated
