-- Test the get_pro_user_tracks function
-- This script verifies that the function exists and returns the expected data

-- Test 1: Check if function exists
SELECT 
    routine_name,
    routine_type,
    routine_definition IS NOT NULL as has_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'get_pro_user_tracks';

-- Test 2: Call the function and count results
SELECT 'get_pro_user_tracks() count:' as test, COUNT(*) as result FROM get_pro_user_tracks();

-- Test 3: Show sample data from the function
SELECT * FROM get_pro_user_tracks() LIMIT 3;

-- Test 4: Verify the data structure
SELECT 
    'Column count:' as info,
    COUNT(*) as count
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'library_tracks';

-- Test 5: Check if we have the expected columns
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'library_tracks'
AND column_name IN ('file_key', 'preview_key', 'short_hash', 'content_hash', 'size_bytes', 'content_type')
ORDER BY column_name;
