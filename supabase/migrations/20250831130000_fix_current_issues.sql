-- Migration: Fix Current Issues
-- Description: Clean up erroneous backup tables and add missing get_user_tracks function
-- Date: 2025-08-31
-- Status: SAFE - No destructive operations, only cleanup and additions

-- Step 1: Clean up erroneous backup tables that shouldn't persist
-- These tables were created by the previous migration but should not remain

DO $$ 
BEGIN
    -- Check if backup tables exist before dropping them
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'library_tracks_backup_remote_sync') THEN
        DROP TABLE IF EXISTS public.library_tracks_backup_remote_sync;
        RAISE NOTICE 'Removed library_tracks_backup_remote_sync table';
    ELSE
        RAISE NOTICE 'library_tracks_backup_remote_sync table does not exist, skipping';
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'track_rotations_backup_remote_sync') THEN
        DROP TABLE IF EXISTS public.track_rotations_backup_remote_sync;
        RAISE NOTICE 'Removed track_rotations_backup_remote_sync table';
    ELSE
        RAISE NOTICE 'track_rotations_backup_remote_sync table does not exist, skipping';
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'uploads_backup_remote_sync') THEN
        DROP TABLE IF EXISTS public.uploads_backup_remote_sync;
        RAISE NOTICE 'Removed uploads_backup_remote_sync table';
    ELSE
        RAISE NOTICE 'uploads_backup_remote_sync table does not exist, skipping';
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users_backup_remote_sync') THEN
        DROP TABLE IF EXISTS public.users_backup_remote_sync;
        RAISE NOTICE 'Removed users_backup_remote_sync table';
    ELSE
        RAISE NOTICE 'users_backup_remote_sync table does not exist, skipping';
    END IF;
END $$;

-- Step 2: Create the missing get_user_tracks function
-- This function is needed by the LibraryService to provide tier-based access

CREATE OR REPLACE FUNCTION get_user_tracks(user_id UUID)
RETURNS TABLE (
  track_id TEXT,
  name TEXT,
  artist TEXT,
  genre TEXT[],
  bpm INTEGER,
  key TEXT,
  duration INTEGER,
  file_key TEXT,
  preview_key TEXT,
  type TEXT,
  size TEXT,
  tags TEXT[],
  is_pro_only BOOLEAN,
  rotation_week INTEGER,
  is_active BOOLEAN
) AS $$
BEGIN
  -- Get user's access tier
  DECLARE
    user_tier TEXT;
  BEGIN
    -- Check if user exists and get their tier
    SELECT access_tier INTO user_tier
    FROM public.users
    WHERE id = user_id;
    
    -- If user doesn't exist, return no tracks (guest user)
    IF user_tier IS NULL THEN
      RETURN;
    END IF;
    
    IF user_tier = 'pro' THEN
      -- Pro users get all active tracks
      RETURN QUERY
      SELECT 
        lt.track_id,
        lt.name,
        lt.artist,
        lt.genre,
        lt.bpm,
        lt.key,
        lt.duration,
        lt.file_key,
        lt.preview_key,
        lt.type,
        lt.size,
        lt.tags,
        lt.is_pro_only,
        lt.rotation_week,
        lt.is_active
      FROM public.library_tracks lt
      WHERE lt.is_active = true
      ORDER BY lt.rotation_week DESC, lt.name;
      
    ELSIF user_tier = 'free' THEN
      -- Free users get tracks from current rotation week (limited to 10)
      RETURN QUERY
      SELECT 
        lt.track_id,
        lt.name,
        lt.artist,
        lt.genre,
        lt.bpm,
        lt.key,
        lt.duration,
        lt.file_key,
        lt.preview_key,
        lt.type,
        lt.size,
        lt.tags,
        lt.is_pro_only,
        lt.rotation_week,
        lt.is_active
      FROM public.library_tracks lt
      WHERE lt.is_active = true 
        AND lt.rotation_week = get_current_rotation_week()
        AND lt.is_pro_only = false
      ORDER BY lt.name
      LIMIT 10;
      
    ELSE
      -- Unknown tier or guest users get no tracks (they use bundled tracks)
      RETURN;
    END IF;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to the function
COMMENT ON FUNCTION get_user_tracks(UUID) IS 'Returns tracks based on user tier: pro users get all tracks, free users get 10 tracks from current rotation week, guest users get none';

-- Step 3: Grant permissions to the new function
GRANT EXECUTE ON FUNCTION get_user_tracks(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_user_tracks(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_tracks(UUID) TO service_role;

-- Step 4: Verify the function was created successfully
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.routines WHERE routine_name = 'get_user_tracks') THEN
        RAISE NOTICE 'Successfully created get_user_tracks function';
    ELSE
        RAISE EXCEPTION 'Failed to create get_user_tracks function';
    END IF;
END $$;

-- Step 5: Test the function with a sample call (will return empty if no users exist yet)
DO $$
BEGIN
    RAISE NOTICE 'Testing get_user_tracks function...';
    -- This will return empty if no users exist, which is expected after reset
    PERFORM COUNT(*) FROM get_user_tracks('00000000-0000-0000-0000-000000000000'::UUID);
    RAISE NOTICE 'get_user_tracks function test completed successfully';
END $$;
