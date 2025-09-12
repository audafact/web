-- Verify data restoration and function functionality
-- This script checks that all 59+ tracks have been restored and the function works

-- Check total library tracks count
SELECT 'Total library tracks:' as status, COUNT(*) as count FROM public.library_tracks;

-- Check if get_pro_user_tracks function exists
SELECT 
    'get_pro_user_tracks function exists:' as status,
    EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' AND routine_name = 'get_pro_user_tracks'
    ) as exists;

-- Test the get_pro_user_tracks function
SELECT 'get_pro_user_tracks() returns:' as status, COUNT(*) as result FROM get_pro_user_tracks();

-- Show sample tracks from the function
SELECT 'Sample tracks from get_pro_user_tracks():' as status;
SELECT track_id, name, artist, genre FROM get_pro_user_tracks() LIMIT 5;

-- Verify we have the expected columns
SELECT 'Expected columns present:' as status,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'library_tracks'
AND column_name IN ('file_key', 'preview_key', 'short_hash', 'content_hash', 'size_bytes', 'content_type');
