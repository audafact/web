-- Manual Schema Backup
-- Created: $(date)
-- Purpose: Schema structure backup when automated methods fail

-- This backup contains the essential schema information
-- extracted manually to ensure completeness

-- Users table structure
CREATE TABLE IF NOT EXISTS public.users (
    id uuid NOT NULL,
    access_tier text DEFAULT 'free'::text,
    stripe_customer_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    subscription_id text,
    plan_interval text,
    price_id text
);

-- Library tracks table structure
CREATE TABLE IF NOT EXISTS public.library_tracks (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    track_id text NOT NULL,
    name text NOT NULL,
    artist text,
    bpm integer,
    key text,
    duration integer,
    type text NOT NULL,
    size text,
    tags text[] DEFAULT '{}',
    is_pro_only boolean DEFAULT false,
    is_active boolean DEFAULT true,
    rotation_week integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    genre text[] NOT NULL DEFAULT '{}',
    file_key text,
    preview_key text,
    short_hash text,
    content_hash text,
    size_bytes bigint,
    content_type text
);

-- Uploads table structure
CREATE TABLE IF NOT EXISTS public.uploads (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    file_key text NOT NULL,
    file_size bigint,
    content_hash text,
    mime_type text,
    original_filename text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Track rotations table structure
CREATE TABLE IF NOT EXISTS public.track_rotations (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    week_number integer NOT NULL,
    track_ids text[] NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Add primary key constraints
ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE public.uploads ADD CONSTRAINT uploads_pkey PRIMARY KEY (id);
ALTER TABLE public.library_tracks ADD CONSTRAINT library_tracks_pkey PRIMARY KEY (id);
ALTER TABLE public.track_rotations ADD CONSTRAINT track_rotations_pkey PRIMARY KEY (id);

-- Add unique constraints
ALTER TABLE public.library_tracks ADD CONSTRAINT library_tracks_track_id_key UNIQUE (track_id);
ALTER TABLE public.uploads ADD CONSTRAINT uploads_file_key_unique UNIQUE (file_key);

-- Add foreign key constraints
ALTER TABLE public.uploads ADD CONSTRAINT uploads_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public.users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add check constraints
ALTER TABLE public.users ADD CONSTRAINT users_plan_interval_check CHECK (plan_interval = ANY (ARRAY['monthly'::text, 'yearly'::text]));
ALTER TABLE public.library_tracks ADD CONSTRAINT library_tracks_type_check CHECK (type = ANY (ARRAY['wav'::text, 'mp3'::text]));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_access_tier ON public.users(access_tier);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON public.users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_id ON public.users(subscription_id);

CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON public.uploads(created_at);
CREATE INDEX IF NOT EXISTS idx_uploads_file_key ON public.uploads(file_key);
CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON public.uploads(user_id);

CREATE INDEX IF NOT EXISTS idx_library_tracks_is_active ON public.library_tracks(is_active);
CREATE INDEX IF NOT EXISTS idx_library_tracks_rotation_week ON public.library_tracks(rotation_week);
CREATE INDEX IF NOT EXISTS idx_library_tracks_is_pro_only ON public.library_tracks(is_pro_only);
CREATE INDEX IF NOT EXISTS idx_library_tracks_file_key ON public.library_tracks(file_key);
CREATE INDEX IF NOT EXISTS idx_library_tracks_preview_key ON public.library_tracks(preview_key);
CREATE INDEX IF NOT EXISTS idx_library_tracks_short_hash ON public.library_tracks(short_hash);
CREATE INDEX IF NOT EXISTS idx_library_tracks_content_hash ON public.library_tracks(content_hash);
CREATE INDEX IF NOT EXISTS idx_library_tracks_size_bytes ON public.library_tracks(size_bytes);

CREATE INDEX IF NOT EXISTS idx_track_rotations_week_number ON public.track_rotations(week_number);
CREATE INDEX IF NOT EXISTS idx_track_rotations_is_active ON public.track_rotations(is_active);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_rotations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can insert their own data" ON public.users FOR INSERT TO public WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own data" ON public.users FOR UPDATE TO public USING (auth.uid() = id);
CREATE POLICY "Users can view their own data" ON public.users FOR SELECT TO public USING (auth.uid() = id);

CREATE POLICY "Users can insert their own uploads" ON public.uploads FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own uploads" ON public.uploads FOR UPDATE TO public USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own uploads" ON public.uploads FOR SELECT TO public USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own uploads" ON public.uploads FOR DELETE TO public USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view library tracks" ON public.library_tracks FOR SELECT TO public USING (true);
CREATE POLICY "Service role can manage library tracks" ON public.library_tracks FOR ALL TO service_role USING (true);

CREATE POLICY "Anyone can view track rotations" ON public.track_rotations FOR SELECT TO public USING (true);
CREATE POLICY "Service role can manage track rotations" ON public.track_rotations FOR ALL TO service_role USING (true);

-- Functions
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

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE public.users IS 'User profiles and subscription information';
COMMENT ON TABLE public.uploads IS 'User file uploads with R2 storage integration';
COMMENT ON TABLE public.library_tracks IS 'Library tracks with R2 storage integration';
COMMENT ON TABLE public.track_rotations IS 'Track rotation schedule for free users';
