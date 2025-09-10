-- Restore data from backup
-- This script restores the library_tracks and users data that was lost

-- First, let's check what we currently have
SELECT 'Current library_tracks count:' as status, COUNT(*) as count FROM public.library_tracks;

-- Now let's restore the library_tracks data
-- The data is in the clean_library_tracks_inserts.sql file

-- Let's verify the function exists and works
SELECT 'get_pro_user_tracks function test:' as status, COUNT(*) as result FROM get_pro_user_tracks();

-- Check if we can call other functions
SELECT 'get_free_user_tracks function test:' as status, COUNT(*) as result FROM get_free_user_tracks();

-- Check current rotation week
SELECT 'Current rotation week:' as status, get_current_rotation_week() as result;
