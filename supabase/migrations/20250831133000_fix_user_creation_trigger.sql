-- Migration: Fix User Creation Trigger
-- Description: Fix handle_new_user function and create the missing trigger
-- Date: 2025-08-31
-- Status: SAFE - Non-destructive, only adds missing functionality

-- Step 1: Fix the handle_new_user function to include timestamps
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

-- Step 2: Grant permissions to the function
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Step 3: Note about the trigger
-- The trigger on auth.users cannot be created automatically due to permission restrictions
-- The function is ready and can be used manually or through Supabase dashboard
-- 
-- To create the trigger manually, run this in the Supabase SQL editor:
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
