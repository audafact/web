-- Migration: Add User Creation Trigger
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

-- Create the trigger on auth.users if it doesn't exist
-- This trigger will fire whenever a new user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add comment to document the trigger
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Automatically creates public.users entry when auth.users gets new user';

-- Verify the trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';
