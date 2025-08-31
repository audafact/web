-- Baseline schema migration
-- This represents the current state of the database as of 2025-08-31

-- Create users table
CREATE TABLE public.users (
    id UUID NOT NULL,
    access_tier TEXT DEFAULT 'free'::text,
    stripe_customer_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    subscription_id TEXT,
    plan_interval TEXT,
    price_id TEXT
);

-- Create uploads table
CREATE TABLE public.uploads (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    file_key TEXT NOT NULL,
    file_size BIGINT,
    content_hash TEXT,
    mime_type TEXT,
    original_filename TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create library tracks table with R2 storage fields
CREATE TABLE public.library_tracks (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    track_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    artist TEXT,
    genre TEXT NOT NULL,
    bpm INTEGER,
    key TEXT,
    duration INTEGER,
    type TEXT NOT NULL CHECK (type IN ('wav', 'mp3')),
    size TEXT,
    tags TEXT[] DEFAULT '{}',
    is_pro_only BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    rotation_week INTEGER,
    file_key TEXT,
    preview_key TEXT,
    short_hash TEXT,
    content_hash TEXT,
    size_bytes BIGINT,
    content_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rotation schedule table
CREATE TABLE public.track_rotations (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    week_number INTEGER NOT NULL,
    track_ids TEXT[] NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add primary key constraints
ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE public.uploads ADD CONSTRAINT uploads_pkey PRIMARY KEY (id);
ALTER TABLE public.library_tracks ADD CONSTRAINT library_tracks_pkey PRIMARY KEY (id);
ALTER TABLE public.track_rotations ADD CONSTRAINT track_rotations_pkey PRIMARY KEY (id);

-- Add unique constraints
ALTER TABLE public.uploads ADD CONSTRAINT uploads_file_key_unique UNIQUE (file_key);

-- Add foreign key constraints
ALTER TABLE public.uploads ADD CONSTRAINT uploads_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public.users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.users ADD CONSTRAINT users_plan_interval_check CHECK (plan_interval = ANY (ARRAY['monthly'::text, 'yearly'::text]));

-- Create indexes
CREATE INDEX idx_users_access_tier ON public.users(access_tier);
CREATE INDEX idx_users_stripe_customer_id ON public.users(stripe_customer_id);
CREATE INDEX idx_users_subscription_id ON public.users(subscription_id);

CREATE INDEX idx_uploads_created_at ON public.uploads(created_at);
CREATE INDEX idx_uploads_file_key ON public.uploads(file_key);
CREATE INDEX idx_uploads_user_id ON public.uploads(user_id);

CREATE INDEX idx_library_tracks_genre ON public.library_tracks(genre);
CREATE INDEX idx_library_tracks_is_active ON public.library_tracks(is_active);
CREATE INDEX idx_library_tracks_rotation_week ON public.library_tracks(rotation_week);
CREATE INDEX idx_library_tracks_is_pro_only ON public.library_tracks(is_pro_only);
CREATE INDEX idx_library_tracks_file_key ON public.library_tracks(file_key);
CREATE INDEX idx_library_tracks_preview_key ON public.library_tracks(preview_key);
CREATE INDEX idx_library_tracks_short_hash ON public.library_tracks(short_hash);
CREATE INDEX idx_library_tracks_content_hash ON public.library_tracks(content_hash);
CREATE INDEX idx_library_tracks_size_bytes ON public.library_tracks(size_bytes);

CREATE INDEX idx_track_rotations_week_number ON public.track_rotations(week_number);
CREATE INDEX idx_track_rotations_is_active ON public.track_rotations(is_active);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_rotations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users can insert their own data" ON public.users
    FOR INSERT TO public WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON public.users
    FOR UPDATE TO public USING (auth.uid() = id);

CREATE POLICY "Users can view their own data" ON public.users
    FOR SELECT TO public USING (auth.uid() = id);

-- RLS Policies for uploads
CREATE POLICY "Users can insert their own uploads" ON public.uploads
    FOR INSERT TO public WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own uploads" ON public.uploads
    FOR UPDATE TO public USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own uploads" ON public.uploads
    FOR SELECT TO public USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own uploads" ON public.uploads
    FOR DELETE TO public USING (auth.uid() = user_id);

-- RLS Policies for library_tracks (read-only for all authenticated users)
CREATE POLICY "Anyone can view library tracks" ON public.library_tracks
    FOR SELECT TO public USING (true);

-- Allow service role to manage library tracks
CREATE POLICY "Service role can manage library tracks" ON public.library_tracks
    FOR ALL TO service_role USING (true);

-- RLS Policies for track_rotations (read-only for all authenticated users)
CREATE POLICY "Anyone can view track rotations" ON public.track_rotations
    FOR SELECT TO public USING (true);

-- Allow service role to manage track rotations
CREATE POLICY "Service role can manage track rotations" ON public.track_rotations
    FOR ALL TO service_role USING (true);

-- Functions
CREATE OR REPLACE FUNCTION public.get_current_rotation_week()
RETURNS INTEGER AS $$
BEGIN
    RETURN FLOOR(EXTRACT(EPOCH FROM (CURRENT_DATE - DATE '2024-01-01')) / (7 * 24 * 60 * 60));
END;
$$ LANGUAGE plpgsql;

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

-- Create trigger for updating updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.users IS 'User profiles and subscription information';
COMMENT ON TABLE public.uploads IS 'User file uploads with R2 storage integration';
COMMENT ON TABLE public.library_tracks IS 'Library tracks with R2 storage integration';
COMMENT ON TABLE public.track_rotations IS 'Track rotation schedule for free users';
