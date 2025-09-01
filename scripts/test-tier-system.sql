-- Test Script: Verify Tier-Based Track Access System
-- Run this after applying the fix migration to verify everything works

-- 1. Check that the get_user_tracks function exists
SELECT 
    routine_name, 
    routine_type, 
    data_type 
FROM information_schema.routines 
WHERE routine_name = 'get_user_tracks';

-- 2. Check that backup tables were removed
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE '%backup%';

-- 3. Check current user count (should be 0 after reset)
SELECT COUNT(*) as user_count FROM public.users;

-- 4. Check current library tracks count
SELECT COUNT(*) as track_count FROM public.library_tracks;

-- 5. Check current rotation week
SELECT get_current_rotation_week() as current_rotation_week;

-- 6. Test the get_user_tracks function with a non-existent user (should return empty)
SELECT COUNT(*) as tracks_for_nonexistent_user 
FROM get_user_tracks('00000000-0000-0000-0000-000000000000'::UUID);

-- 7. Check available functions for tier-based access
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN (
    'get_user_tracks',
    'get_free_user_tracks', 
    'get_pro_user_tracks',
    'get_user_library_track_count',
    'add_library_track_to_user'
)
ORDER BY routine_name;

-- 8. Check table structure for key tables
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('users', 'library_tracks', 'library_usage')
ORDER BY table_name, ordinal_position;

-- 9. Check that the user creation trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 10. Summary of what should be working
SELECT 
    '✅ get_user_tracks function exists' as check_item,
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.routines WHERE routine_name = 'get_user_tracks') 
        THEN 'YES' 
        ELSE 'NO' 
    END as status
UNION ALL
SELECT 
    '✅ Backup tables removed' as check_item,
    CASE 
        WHEN NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name LIKE '%backup%') 
        THEN 'YES' 
        ELSE 'NO' 
    END as status
UNION ALL
SELECT 
    '✅ User creation trigger exists' as check_item,
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created') 
        THEN 'YES' 
        ELSE 'NO' 
    END as status
UNION ALL
SELECT 
    '✅ Tier-based functions available' as check_item,
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.routines WHERE routine_name = 'get_free_user_tracks')
        AND EXISTS (SELECT FROM information_schema.routines WHERE routine_name = 'get_pro_user_tracks')
        THEN 'YES' 
        ELSE 'NO' 
    END as status;
