-- Test script to verify library functions have been restored
-- Run this to check if the functions exist and work correctly

-- Check if functions exist
SELECT 
    routine_name,
    routine_type,
    routine_definition IS NOT NULL as has_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'get_pro_user_tracks',
    'get_free_user_tracks', 
    'get_current_rotation_week',
    'get_user_library_track_count',
    'add_library_track_to_user',
    'remove_library_track_from_user',
    'get_user_library_tracks',
    'rotate_free_user_tracks',
    'get_rotation_info'
)
ORDER BY routine_name;

-- Test get_current_rotation_week function
SELECT 'get_current_rotation_week() result:' as test, get_current_rotation_week() as result;

-- Test get_pro_user_tracks function (should return empty if no tracks exist)
SELECT 'get_pro_user_tracks() count:' as test, COUNT(*) as result FROM get_pro_user_tracks();

-- Test get_free_user_tracks function (should return empty if no tracks exist)
SELECT 'get_free_user_tracks() count:' as test, COUNT(*) as result FROM get_free_user_tracks();

-- Check if library_usage table exists
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'library_usage';

-- Check library_usage table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'library_usage'
ORDER BY ordinal_position;
