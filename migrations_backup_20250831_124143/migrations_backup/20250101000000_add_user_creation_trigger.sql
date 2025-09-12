-- Migration: Add User Creation Trigger
-- Purpose: Add the missing trigger that automatically creates user records when new users sign up
-- Date: 2025-01-XX

-- This migration ensures the handle_new_user function exists
-- The trigger will need to be created manually due to permission requirements

-- Create the handle_new_user function
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

-- Note: The trigger cannot be created automatically due to permission restrictions
-- on the auth.users table. The function is created and ready for use.

-- To complete the setup, manually create the trigger by running:
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Verify the function exists
SELECT 
    routine_name,
    routine_type,
    routine_definition IS NOT NULL as has_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'handle_new_user';
