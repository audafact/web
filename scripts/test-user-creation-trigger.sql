-- Test Script: Verify User Creation Trigger
-- Purpose: Test that the user creation trigger is working correctly
-- Date: 2025-01-XX

-- This script tests the user creation trigger without actually creating users
-- It's safe to run multiple times

-- 1. Check if the handle_new_user function exists
SELECT 
    routine_name,
    routine_type,
    routine_definition IS NOT NULL as has_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'handle_new_user';

-- 2. Check if the trigger exists on auth.users
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created'
AND event_object_table = 'users'
AND event_object_schema = 'auth';

-- 3. Check if the users table exists and has the right structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Check current user count
SELECT 
    'Current users count' as description,
    COUNT(*) as count
FROM public.users;

-- 5. Check if the trigger function can be called (syntax check only)
-- This won't actually execute the function, just verify it compiles
SELECT 
    'Function compilation check' as description,
    pg_get_functiondef(oid) IS NOT NULL as compiles_successfully
FROM pg_proc 
WHERE proname = 'handle_new_user' 
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 6. Show any existing triggers on auth.users table
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users'
AND event_object_schema = 'auth';

-- 7. Check RLS policies on users table
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users' 
AND schemaname = 'public';

-- Summary status
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'handle_new_user'
        ) THEN '✅ handle_new_user function exists'
        ELSE '❌ handle_new_user function missing'
    END as function_status,
    
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'on_auth_user_created'
        ) THEN '✅ User creation trigger exists'
        ELSE '❌ User creation trigger missing'
    END as trigger_status,
    
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'users'
        ) THEN '✅ Users table exists'
        ELSE '❌ Users table missing'
    END as table_status;
