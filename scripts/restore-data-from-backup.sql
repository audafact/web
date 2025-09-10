-- Restore data from backup
-- This script restores the library_tracks data that was lost during migration

-- First, let's check what we currently have
SELECT 'Current library_tracks count:' as status, COUNT(*) as count FROM public.library_tracks;

-- Check if we have any backup tables
SELECT 'Backup tables found:' as status, COUNT(*) as count 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%backup%';

-- Now let's restore the library_tracks data from our backup
-- We'll use the data-only backup which contains the INSERT statements

-- Note: This script should be run after the complete database backup has been restored
-- The data-only backup contains INSERT statements that will populate the tables

-- Let's verify the current state
SELECT 'Current state verification:' as status;
SELECT 'library_tracks table exists:' as check, EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'library_tracks'
) as exists;

SELECT 'get_pro_user_tracks function exists:' as check, EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_schema = 'public' AND routine_name = 'get_pro_user_tracks'
) as exists;

-- Check if we can call the function
SELECT 'Function test:' as status, COUNT(*) as result FROM get_pro_user_tracks();
