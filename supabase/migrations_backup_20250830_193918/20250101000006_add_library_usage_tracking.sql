-- Add library usage tracking table
CREATE TABLE public.library_usage (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    track_id TEXT NOT NULL REFERENCES public.library_tracks(track_id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    rotation_week INTEGER NOT NULL, -- Week when the track was added
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, track_id, rotation_week)
);

-- Add indexes for performance
CREATE INDEX idx_library_usage_user_id ON public.library_usage(user_id);
CREATE INDEX idx_library_usage_track_id ON public.library_usage(track_id);
CREATE INDEX idx_library_usage_rotation_week ON public.library_usage(rotation_week);
CREATE INDEX idx_library_usage_is_active ON public.library_usage(is_active);
CREATE INDEX idx_library_usage_user_rotation ON public.library_usage(user_id, rotation_week);

-- Enable RLS
ALTER TABLE public.library_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for library_usage
CREATE POLICY "Users can view their own library usage" ON public.library_usage
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own library usage" ON public.library_usage
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own library usage" ON public.library_usage
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Function to get user's current library track count
CREATE OR REPLACE FUNCTION get_user_library_track_count(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    current_week INTEGER;
    track_count INTEGER;
BEGIN
    current_week := get_current_rotation_week();
    
    SELECT COUNT(*) INTO track_count
    FROM public.library_usage
    WHERE user_id = user_uuid 
    AND rotation_week = current_week
    AND is_active = true;
    
    RETURN COALESCE(track_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to add a library track to user's collection
CREATE OR REPLACE FUNCTION add_library_track_to_user(user_uuid UUID, track_id_text TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    current_week INTEGER;
    track_count INTEGER;
    max_tracks INTEGER;
    user_tier TEXT;
BEGIN
    current_week := get_current_rotation_week();
    
    -- Get user's tier
    SELECT access_tier INTO user_tier
    FROM public.users
    WHERE id = user_uuid;
    
    -- Set max tracks based on tier
    IF user_tier = 'pro' THEN
        max_tracks := 999999; -- Effectively unlimited
    ELSE
        max_tracks := 10; -- Free users get 10 tracks
    END IF;
    
    -- Get current track count
    track_count := get_user_library_track_count(user_uuid);
    
    -- Check if user can add more tracks
    IF track_count >= max_tracks THEN
        RETURN FALSE;
    END IF;
    
    -- Check if track is already added this week
    IF EXISTS (
        SELECT 1 FROM public.library_usage 
        WHERE user_id = user_uuid 
        AND track_id = track_id_text 
        AND rotation_week = current_week
        AND is_active = true
    ) THEN
        RETURN FALSE;
    END IF;
    
    -- Add the track
    INSERT INTO public.library_usage (user_id, track_id, rotation_week)
    VALUES (user_uuid, track_id_text, current_week);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to remove a library track from user's collection
CREATE OR REPLACE FUNCTION remove_library_track_from_user(user_uuid UUID, track_id_text TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    current_week INTEGER;
BEGIN
    current_week := get_current_rotation_week();
    
    UPDATE public.library_usage
    SET is_active = false, updated_at = NOW()
    WHERE user_id = user_uuid 
    AND track_id = track_id_text 
    AND rotation_week = current_week
    AND is_active = true;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's current library tracks
CREATE OR REPLACE FUNCTION get_user_library_tracks(user_uuid UUID)
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
    preview_url TEXT,
    added_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    current_week INTEGER;
BEGIN
    current_week := get_current_rotation_week();
    
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
        lt.preview_url,
        lu.added_at
    FROM public.library_tracks lt
    INNER JOIN public.library_usage lu ON lt.id = lu.track_id
    WHERE lu.user_id = user_uuid 
    AND lu.rotation_week = current_week
    AND lu.is_active = true
    AND lt.is_active = true
    ORDER BY lu.added_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically rotate tracks weekly (3 new tracks per week)
CREATE OR REPLACE FUNCTION rotate_free_user_tracks()
RETURNS VOID AS $$
DECLARE
    current_week INTEGER;
    next_week INTEGER;
    available_tracks RECORD;
    track_counter INTEGER := 0;
    max_new_tracks INTEGER := 3;
BEGIN
    current_week := get_current_rotation_week();
    next_week := current_week + 1;
    
    -- Get tracks that haven't been in rotation recently
    FOR available_tracks IN
        SELECT id, track_id, name
        FROM public.library_tracks
        WHERE is_active = true 
        AND is_pro_only = false
        AND (rotation_week IS NULL OR rotation_week < current_week - 4) -- Not used in last 4 weeks
        ORDER BY RANDOM()
        LIMIT max_new_tracks
    LOOP
        -- Update the track's rotation week
        UPDATE public.library_tracks
        SET rotation_week = next_week, updated_at = NOW()
        WHERE id = available_tracks.id;
        
        track_counter := track_counter + 1;
        
        -- Log the rotation
        RAISE NOTICE 'Rotated track % (%) to week %', available_tracks.name, available_tracks.track_id, next_week;
    END LOOP;
    
    -- If we don't have enough tracks to rotate, add some from older weeks
    IF track_counter < max_new_tracks THEN
        FOR available_tracks IN
            SELECT id, track_id, name
            FROM public.library_tracks
            WHERE is_active = true 
            AND is_pro_only = false
            AND rotation_week < current_week
            AND rotation_week >= current_week - 8 -- Within last 8 weeks
            ORDER BY rotation_week ASC, RANDOM()
            LIMIT (max_new_tracks - track_counter)
        LOOP
            UPDATE public.library_tracks
            SET rotation_week = next_week, updated_at = NOW()
            WHERE id = available_tracks.id;
            
            RAISE NOTICE 'Re-rotated track % (%) to week %', available_tracks.name, available_tracks.track_id, next_week;
        END LOOP;
    END IF;
    
    -- Clean up old usage records (older than 8 weeks)
    DELETE FROM public.library_usage
    WHERE rotation_week < current_week - 8;
    
    RAISE NOTICE 'Track rotation completed for week %', next_week;
END;
$$ LANGUAGE plpgsql;

-- Function to get rotation info for display
CREATE OR REPLACE FUNCTION get_rotation_info()
RETURNS TABLE (
    current_week INTEGER,
    next_rotation_date DATE,
    days_until_rotation INTEGER,
    current_track_count INTEGER
) AS $$
DECLARE
    current_week_val INTEGER;
    next_rotation_date_val DATE;
    days_until_rotation_val INTEGER;
    current_track_count_val INTEGER;
BEGIN
    current_week_val := get_current_rotation_week();
    
    -- Calculate next rotation date (next Monday)
    next_rotation_date_val := DATE '2024-01-01' + (current_week_val + 1) * 7;
    
    -- Calculate days until rotation
    days_until_rotation_val := next_rotation_date_val - CURRENT_DATE;
    
    -- Get current track count for free users
    SELECT COUNT(*) INTO current_track_count_val
    FROM public.library_tracks
    WHERE is_active = true 
    AND is_pro_only = false
    AND rotation_week = current_week_val;
    
    RETURN QUERY
    SELECT 
        current_week_val,
        next_rotation_date_val,
        days_until_rotation_val,
        current_track_count_val;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run rotation weekly (this would be set up in Supabase dashboard)
-- The function rotate_free_user_tracks() should be called every Monday at 00:00 UTC 