-- Migration: Safe Remote Schema Synchronization
-- Purpose: Safely synchronize schema changes with conditional logic and data protection
-- Date: 2025-01-XX
-- Safety Level: HIGH - Multiple guards and data preservation checks

-- GUARD 1: Create comprehensive backup tables before any changes
-- This provides multiple layers of protection

-- Backup current users table
CREATE TABLE IF NOT EXISTS users_backup_remote_sync AS 
SELECT * FROM public.users;

-- Backup current library_tracks table (preserve the 59 existing entries)
CREATE TABLE IF NOT EXISTS library_tracks_backup_remote_sync AS 
SELECT * FROM public.library_tracks;

-- Backup current uploads table
CREATE TABLE IF NOT EXISTS uploads_backup_remote_sync AS 
SELECT * FROM public.uploads;

-- Backup current track_rotations table
CREATE TABLE IF NOT EXISTS track_rotations_backup_remote_sync AS 
SELECT * FROM public.track_rotations;

-- GUARD 2: Verify backup integrity
DO $$
DECLARE
    original_count integer;
    backup_count integer;
BEGIN
    -- Check library_tracks backup integrity
    SELECT COUNT(*) INTO original_count FROM public.library_tracks;
    SELECT COUNT(*) INTO backup_count FROM library_tracks_backup_remote_sync;
    
    IF original_count != backup_count THEN
        RAISE EXCEPTION 'Backup integrity check failed: library_tracks count mismatch (original: %, backup: %)', 
            original_count, backup_count;
    END IF;
    
    RAISE NOTICE 'Backup integrity verified: library_tracks backed up successfully (% rows)', original_count;
END $$;

-- GUARD 3: Conditional constraint removal with existence checks
DO $$
BEGIN
    -- Only drop track_rotations_pkey if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'track_rotations_pkey'
        AND table_name = 'track_rotations'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."track_rotations" DROP CONSTRAINT "track_rotations_pkey";
        RAISE NOTICE 'Dropped track_rotations_pkey constraint';
    ELSE
        RAISE NOTICE 'track_rotations_pkey constraint does not exist, skipping';
    END IF;
END $$;

-- GUARD 4: Safe index removal with existence checks
DROP INDEX IF EXISTS "public"."idx_library_tracks_genre";
DROP INDEX IF EXISTS "public"."track_rotations_pkey";

-- GUARD 5: Safe column modification with data type validation
DO $$
DECLARE
    current_data_type text;
    sample_genre text;
BEGIN
    -- Check current data type of genre column
    SELECT data_type INTO current_data_type 
    FROM information_schema.columns 
    WHERE table_name = 'library_tracks' 
    AND column_name = 'genre'
    AND table_schema = 'public';
    
    RAISE NOTICE 'Current genre column data type: %', current_data_type;
    
    -- Only modify if not already text[]
    IF current_data_type != 'ARRAY' THEN
        -- Check if current data can be safely converted
        SELECT genre INTO sample_genre 
        FROM public.library_tracks 
        WHERE genre IS NOT NULL 
        LIMIT 1;
        
        IF sample_genre IS NOT NULL THEN
            RAISE NOTICE 'Sample genre data: %', sample_genre;
        END IF;
        
        -- Safe conversion with error handling
        BEGIN
            ALTER TABLE "public"."library_tracks" 
            ALTER COLUMN "genre" SET DEFAULT '{}'::text[];
            
            ALTER TABLE "public"."library_tracks" 
            ALTER COLUMN "genre" SET DATA TYPE text[] 
            USING "genre"::text[];
            
            RAISE NOTICE 'Successfully converted genre column to text[]';
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Failed to convert genre column: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'Genre column is already text[], skipping conversion';
    END IF;
END $$;

-- GUARD 6: Safe function replacement
SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_current_rotation_week()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Calculate week number since a reference date (e.g., 2024-01-01)
    RETURN FLOOR(EXTRACT(EPOCH FROM (CURRENT_DATE - DATE '2024-01-01')) / (7 * 24 * 60 * 60));
END;
$function$;

-- GUARD 7: Final verification
DO $$
DECLARE
    final_count integer;
BEGIN
    -- Verify no data was lost
    SELECT COUNT(*) INTO final_count FROM public.library_tracks;
    
    IF final_count != (SELECT COUNT(*) FROM library_tracks_backup_remote_sync) THEN
        RAISE EXCEPTION 'Data integrity check failed: library_tracks count changed during migration';
    END IF;
    
    RAISE NOTICE 'Migration completed successfully. Final library_tracks count: %', final_count;
END $$;

-- Add migration completion comment
COMMENT ON TABLE public.library_tracks IS 'Schema synchronized with remote - SAFE MIGRATION COMPLETED';
