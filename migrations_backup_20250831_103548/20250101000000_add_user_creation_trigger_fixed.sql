-- Migration: Add User Creation Trigger (FIXED VERSION)
-- Purpose: Add the missing trigger that automatically creates user records when new users sign up
-- Date: 2025-01-XX

-- This migration ensures the handle_new_user function exists and creates the trigger
-- It's designed to be safe and idempotent

-- First, ensure the handle_new_user function exists
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Insert a new user record when auth.users gets a new entry
  INSERT INTO public.users (id, access_tier, created_at, updated_at)
  VALUES (NEW.id, 'free', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING; -- Prevent duplicate insertions
  
  RETURN NEW;
END;
$function$;

-- Create the trigger on auth.users
-- Use a more robust approach that handles permission issues gracefully

-- First, check if we have the necessary permissions
DO $$
DECLARE
    has_auth_permissions boolean;
BEGIN
    -- Check if we can create triggers on auth.users
    SELECT EXISTS (
        SELECT 1 FROM information_schema.role_table_grants 
        WHERE table_name = 'users' 
        AND table_schema = 'auth'
        AND privilege_type = 'TRIGGER'
        AND grantee = current_user
    ) INTO has_auth_permissions;
    
    IF has_auth_permissions THEN
        -- We have permissions, create the trigger
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        
        CREATE TRIGGER on_auth_user_created
          AFTER INSERT ON auth.users
          FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
          
        RAISE NOTICE 'User creation trigger created successfully';
    ELSE
        -- No permissions, provide clear instructions
        RAISE NOTICE 'Insufficient permissions to create trigger on auth.users';
        RAISE NOTICE 'The handle_new_user function is created and ready.';
        RAISE NOTICE 'To create the trigger manually, run as superuser:';
        RAISE NOTICE 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();';
    END IF;
END $$;

-- Add comment to document the trigger (only if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created' 
    AND tgrelid = 'auth.users'::regclass
  ) THEN
    COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Automatically creates public.users entry when auth.users gets new user';
  END IF;
END $$;

-- Verify the trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- Show manual trigger creation instructions if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created' 
    AND tgrelid = 'auth.users'::regclass
  ) THEN
    RAISE NOTICE '';
    RAISE NOTICE 'MANUAL TRIGGER CREATION REQUIRED:';
    RAISE NOTICE 'The trigger could not be created automatically due to permissions.';
    RAISE NOTICE 'To create it manually, run this SQL as a superuser or auth owner:';
    RAISE NOTICE '';
    RAISE NOTICE 'CREATE TRIGGER on_auth_user_created';
    RAISE NOTICE '  AFTER INSERT ON auth.users';
    RAISE NOTICE '  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();';
    RAISE NOTICE '';
    RAISE NOTICE 'The handle_new_user function is ready and working.';
  END IF;
END $$;
