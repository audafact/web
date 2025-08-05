-- Create library tracks table
CREATE TABLE public.library_tracks (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    track_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    artist TEXT,
    genre TEXT NOT NULL,
    bpm INTEGER,
    key TEXT,
    duration INTEGER,
    file_url TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('wav', 'mp3')),
    size TEXT,
    tags TEXT[] DEFAULT '{}',
    is_pro_only BOOLEAN DEFAULT false,
    preview_url TEXT,
    is_active BOOLEAN DEFAULT true,
    rotation_week INTEGER, -- Week number when this track is available for free users
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

-- Add indexes
CREATE INDEX idx_library_tracks_genre ON public.library_tracks(genre);
CREATE INDEX idx_library_tracks_is_active ON public.library_tracks(is_active);
CREATE INDEX idx_library_tracks_rotation_week ON public.library_tracks(rotation_week);
CREATE INDEX idx_library_tracks_is_pro_only ON public.library_tracks(is_pro_only);
CREATE INDEX idx_track_rotations_week_number ON public.track_rotations(week_number);
CREATE INDEX idx_track_rotations_is_active ON public.track_rotations(is_active);

-- Enable RLS
ALTER TABLE public.library_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_rotations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for library_tracks (read-only for all authenticated users)
CREATE POLICY "Anyone can view library tracks" ON public.library_tracks
    FOR SELECT TO public USING (true);

-- Allow service role to manage library tracks (for CLI operations)
CREATE POLICY "Service role can manage library tracks" ON public.library_tracks
    FOR ALL TO service_role USING (true);

-- RLS Policies for track_rotations (read-only for all authenticated users)
CREATE POLICY "Anyone can view track rotations" ON public.track_rotations
    FOR SELECT TO public USING (true);

-- Function to get current rotation week
CREATE OR REPLACE FUNCTION get_current_rotation_week()
RETURNS INTEGER AS $$
BEGIN
    -- Calculate week number since a reference date (e.g., 2024-01-01)
    RETURN FLOOR(EXTRACT(EPOCH FROM (CURRENT_DATE - DATE '2024-01-01')) / (7 * 24 * 60 * 60));
END;
$$ LANGUAGE plpgsql;

-- Function to get available tracks for free users
CREATE OR REPLACE FUNCTION get_free_user_tracks()
RETURNS TABLE (
    id UUID,
    track_id TEXT,
    name TEXT,
    artist TEXT,
    genre TEXT,
    bpm INTEGER,
    key TEXT,
    duration INTEGER,
    file_url TEXT,
    type TEXT,
    size TEXT,
    tags TEXT[],
    is_pro_only BOOLEAN,
    preview_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lt.id,
        lt.track_id,
        lt.name,
        lt.artist,
        lt.genre,
        lt.bpm,
        lt.key,
        lt.duration,
        lt.file_url,
        lt.type,
        lt.size,
        lt.tags,
        lt.is_pro_only,
        lt.preview_url
    FROM public.library_tracks lt
    WHERE lt.is_active = true 
    AND lt.is_pro_only = false
    AND lt.rotation_week = get_current_rotation_week()
    ORDER BY lt.name;
END;
$$ LANGUAGE plpgsql;

-- Function to get all tracks for pro users
CREATE OR REPLACE FUNCTION get_pro_user_tracks()
RETURNS TABLE (
    id UUID,
    track_id TEXT,
    name TEXT,
    artist TEXT,
    genre TEXT,
    bpm INTEGER,
    key TEXT,
    duration INTEGER,
    file_url TEXT,
    type TEXT,
    size TEXT,
    tags TEXT[],
    is_pro_only BOOLEAN,
    preview_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lt.id,
        lt.track_id,
        lt.name,
        lt.artist,
        lt.genre,
        lt.bpm,
        lt.key,
        lt.duration,
        lt.file_url,
        lt.type,
        lt.size,
        lt.tags,
        lt.is_pro_only,
        lt.preview_url
    FROM public.library_tracks lt
    WHERE lt.is_active = true
    ORDER BY lt.name;
END;
$$ LANGUAGE plpgsql;

-- Insert initial tracks
INSERT INTO public.library_tracks (
    track_id, name, artist, genre, bpm, key, duration, 
    file_url, type, size, tags, is_pro_only, preview_url, rotation_week
) VALUES 
    ('ron-drums', 'RON Drums', 'RON', 'drum-n-bass', 140, 'Am', 180, 
     '/audio/RON-drums.wav', 'wav', '5.5MB', ARRAY['drums', 'drum-n-bass', 'electronic'], false, '/previews/ron-drums-preview.mp3', 1),
    
    ('secrets-of-the-heart', 'Secrets of the Heart', 'Ambient Collective', 'ambient', 120, 'Cm', 240, 
     '/audio/Secrets of the Heart.mp3', 'mp3', '775KB', ARRAY['ambient', 'atmospheric', 'chill'], false, '/previews/secrets-preview.mp3', 1),
    
    ('rhythm-revealed', 'The Rhythm Revealed (Drums)', 'House Masters', 'house', 128, 'Fm', 200, 
     '/audio/The Rhythm Revealed(Drums).wav', 'wav', '5.5MB', ARRAY['house', 'drums', 'groove'], false, '/previews/rhythm-preview.mp3', 1),
    
    ('unveiled-desires', 'Unveiled Desires', 'Techno Collective', 'techno', 135, 'Em', 220, 
     '/audio/Unveiled Desires.wav', 'wav', '6.0MB', ARRAY['techno', 'dark', 'industrial'], false, '/previews/unveiled-preview.mp3', 1),
    
    ('pro-exclusive-1', 'Pro Exclusive Track 1', 'Premium Artist', 'progressive-house', 128, 'Am', 300, 
     '/audio/pro-1.wav', 'wav', '8.2MB', ARRAY['progressive', 'house', 'premium'], true, '/previews/pro-1-preview.mp3', NULL),
    
    ('pro-exclusive-2', 'Pro Exclusive Track 2', 'Elite Producer', 'deep-house', 125, 'Dm', 280, 
     '/audio/pro-2.wav', 'wav', '7.8MB', ARRAY['deep', 'house', 'premium'], true, '/previews/pro-2-preview.mp3', NULL);

-- Insert additional tracks for rotation (weeks 2-4)
INSERT INTO public.library_tracks (
    track_id, name, artist, genre, bpm, key, duration, 
    file_url, type, size, tags, is_pro_only, preview_url, rotation_week
) VALUES 
    ('week2-track1', 'Week 2 Track 1', 'Rotation Artist', 'house', 128, 'Am', 200, 
     '/audio/week2-1.wav', 'wav', '4.5MB', ARRAY['house', 'rotation'], false, '/previews/week2-1-preview.mp3', 2),
    
    ('week2-track2', 'Week 2 Track 2', 'Rotation Artist', 'techno', 135, 'Dm', 220, 
     '/audio/week2-2.wav', 'wav', '5.0MB', ARRAY['techno', 'rotation'], false, '/previews/week2-2-preview.mp3', 2),
    
    ('week3-track1', 'Week 3 Track 1', 'Rotation Artist', 'ambient', 120, 'Cm', 240, 
     '/audio/week3-1.wav', 'wav', '3.8MB', ARRAY['ambient', 'rotation'], false, '/previews/week3-1-preview.mp3', 3),
    
    ('week3-track2', 'Week 3 Track 2', 'Rotation Artist', 'drum-n-bass', 140, 'Em', 180, 
     '/audio/week3-2.wav', 'wav', '6.2MB', ARRAY['drum-n-bass', 'rotation'], false, '/previews/week3-2-preview.mp3', 3),
    
    ('week4-track1', 'Week 4 Track 1', 'Rotation Artist', 'house', 125, 'Fm', 200, 
     '/audio/week4-1.wav', 'wav', '4.8MB', ARRAY['house', 'rotation'], false, '/previews/week4-1-preview.mp3', 4),
    
    ('week4-track2', 'Week 4 Track 2', 'Rotation Artist', 'techno', 130, 'Am', 220, 
     '/audio/week4-2.wav', 'wav', '5.5MB', ARRAY['techno', 'rotation'], false, '/previews/week4-2-preview.mp3', 4);

-- Note: update_updated_at_column() function is created in the main schema migration
-- Trigger will be added separately if needed 