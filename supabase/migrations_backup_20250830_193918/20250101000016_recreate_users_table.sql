-- Migration: Recreate Users Table
-- This migration recreates the users table that integrates with Supabase Auth

-- Drop existing table if it exists (to avoid conflicts)
DROP TABLE IF EXISTS public.users CASCADE;

-- 1. Create the users table
CREATE TABLE public.users (
    id uuid NOT NULL,
    access_tier text DEFAULT 'free'::text,
    stripe_customer_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    subscription_id text,
    plan_interval text,
    price_id text
);

-- 2. Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Create indexes
CREATE INDEX idx_users_access_tier ON public.users USING btree (access_tier);
CREATE INDEX idx_users_stripe_customer_id ON public.users USING btree (stripe_customer_id);
CREATE INDEX idx_users_subscription_id ON public.users USING btree (subscription_id);
CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

-- 4. Set primary key
ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY USING INDEX users_pkey;

-- 5. Add foreign key constraint to auth.users
ALTER TABLE public.users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 6. Add check constraint for plan_interval
ALTER TABLE public.users ADD CONSTRAINT users_plan_interval_check CHECK (plan_interval = ANY (ARRAY['monthly'::text, 'yearly'::text]));

-- 7. Create the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.users (id, access_tier)
  VALUES (NEW.id, 'free');
  RETURN NEW;
END;
$function$;

-- 8. Create the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 9. Create the trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. Create the trigger for updating updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON public.users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11. Create RLS policies
DROP POLICY IF EXISTS "Users can insert their own data" ON public.users;
CREATE POLICY "Users can insert their own data" ON public.users
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
CREATE POLICY "Users can update their own data" ON public.users
  AS PERMISSIVE FOR UPDATE TO public
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
CREATE POLICY "Users can view their own data" ON public.users
  AS PERMISSIVE FOR SELECT TO public
  USING (auth.uid() = id);

-- 12. Grant necessary permissions
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
