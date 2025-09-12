# Migration Template and Best Practices

## ⚠️ IMPORTANT: Schema Protection Rules

**NEVER modify existing table structures unless explicitly intended!**

### ✅ ALLOWED Operations:

- Add NEW tables
- Add NEW columns to existing tables
- Add NEW indexes
- Add NEW functions
- Add NEW policies
- Add NEW constraints (that don't conflict with existing ones)

### ❌ FORBIDDEN Operations:

- DROP existing tables
- DROP existing columns
- MODIFY existing column types
- MODIFY existing constraints
- DROP existing indexes

## Migration File Naming Convention

```
YYYYMMDDHHMMSS_descriptive_name.sql
```

Example: `20250831023000_add_user_preferences_table.sql`

## Migration Structure Template

```sql
-- Migration: [Brief description]
-- Date: [Date]
-- Purpose: [What this migration accomplishes]

-- 1. ADD NEW TABLES (if any)
CREATE TABLE IF NOT EXISTS public.new_table_name (
    -- table definition
);

-- 2. ADD NEW COLUMNS (if any)
ALTER TABLE public.existing_table_name
ADD COLUMN IF NOT EXISTS new_column_name TEXT;

-- 3. ADD NEW INDEXES (if any)
CREATE INDEX IF NOT EXISTS idx_new_index_name
ON public.table_name(column_name);

-- 4. ADD NEW FUNCTIONS (if any)
CREATE OR REPLACE FUNCTION public.new_function_name()
RETURNS TEXT AS $$
BEGIN
    -- function logic
    RETURN 'result';
END;
$$ LANGUAGE plpgsql;

-- 5. ADD NEW POLICIES (if any)
CREATE POLICY "New policy name" ON public.table_name
    FOR SELECT TO public USING (condition);

-- 6. VALIDATE SCHEMA INTEGRITY
-- Always run this after making changes:
-- SELECT validate_schema_changes();
```

## Before Running Any Migration:

1. **Check current schema**: `npx supabase db diff --schema public`
2. **Verify no destructive changes**: Look for DROP, ALTER COLUMN, etc.
3. **Test locally first**: Use `npx supabase db reset --local` to test
4. **Backup if needed**: Consider backing up production data

## Emergency Rollback

If a migration causes issues:

```bash
# Revert the last migration
npx supabase migration repair --status reverted [migration_name]

# Reset to a known good state
npx supabase db reset --linked
```

## Current Protected Tables

- `public.users` - User profiles and subscription info
- `public.uploads` - File uploads with R2 storage
- `public.library_tracks` - Library tracks with R2 storage
- `public.track_rotations` - Track rotation schedule

**These tables are SCHEMA_LOCKED and should not be modified!**
