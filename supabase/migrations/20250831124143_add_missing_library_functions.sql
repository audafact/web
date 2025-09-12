-- Add missing library functions
-- This migration restores the library management functions that were lost

-- Function to get current rotation week
CREATE OR REPLACE FUNCTION public.get_current_rotation_week()
RETURNS INTEGER AS $$
BEGIN
    RETURN FLOOR(EXTRACT(EPOCH FROM (CURRENT_DATE - DATE '2024-01-01')) / (7 * 24 * 60 * 60));
END;
$$ LANGUAGE plpgsql;

-- Function to get tracks for free users (current rotation week only)
CREATE OR REPLACE FUNCTION public.get_free_user_tracks()
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
CREATE OR REPLACE FUNCTION public.get_pro_user_tracks()
RETURNS TABLE (
    id UUID,
    track_id TEXT,
    name TEXT,
    artist TEXT,
    bpm INTEGER,
    key TEXT,
    duration INTEGER,
    file_key TEXT,
    type TEXT,
    size TEXT,
    tags TEXT[],
    is_pro_only BOOLEAN,
    preview_key TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lt.id,
        lt.track_id,
        lt.name,
        lt.artist,
        lt.bpm,
        lt.key,
        lt.duration,
        lt.file_key,
        lt.type,
        lt.size,
        lt.tags,
        lt.is_pro_only,
        lt.preview_key
    FROM public.library_tracks lt
    WHERE lt.is_active = true
    ORDER BY lt.name;
END;
$$ LANGUAGE plpgsql;

-- Function to get user library track count
CREATE OR REPLACE FUNCTION public.get_user_library_track_count(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM public.library_usage lu
        WHERE lu.user_id = user_uuid 
        AND lu.is_active = true
        AND lu.rotation_week = get_current_rotation_week()
    );
END;
$$ LANGUAGE plpgsql;

-- Function to add library track to user
CREATE OR REPLACE FUNCTION public.add_library_track_to_user(user_uuid UUID, track_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_count INTEGER;
    track_is_pro BOOLEAN;
    user_tier TEXT;
BEGIN
    -- Get user's access tier
    SELECT access_tier INTO user_tier
    FROM public.users
    WHERE id = user_uuid;
    
    -- Get track info
    SELECT is_pro_only INTO track_is_pro
    FROM public.library_tracks
    WHERE id = track_uuid;
    
    -- Check if user can access this track
    IF track_is_pro = true AND user_tier != 'pro' THEN
        RETURN false;
    END IF;
    
    -- For free users, check limits
    IF user_tier = 'free' THEN
        current_count := get_user_library_track_count(user_uuid);
        IF current_count >= 10 THEN
            RETURN false;
        END IF;
    END IF;
    
    -- Check if track is already in user's collection
    IF EXISTS (
        SELECT 1 FROM public.library_usage 
        WHERE user_id = user_uuid 
        AND track_id = track_uuid 
        AND is_active = true
        AND rotation_week = get_current_rotation_week()
    ) THEN
        RETURN false;
    END IF;
    
    -- Add track to user's collection
    INSERT INTO public.library_usage (user_id, track_id, rotation_week, is_active)
    VALUES (user_uuid, track_uuid, get_current_rotation_week(), true);
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to remove library track from user
CREATE OR REPLACE FUNCTION public.remove_library_track_from_user(user_uuid UUID, track_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.library_usage
    SET is_active = false
    WHERE user_id = user_uuid 
    AND track_id = track_uuid 
    AND is_active = true;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's library tracks
CREATE OR REPLACE FUNCTION public.get_user_library_tracks(user_uuid UUID)
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
    INNER JOIN public.library_usage lu ON lt.id = lu.track_id
    WHERE lu.user_id = user_uuid 
    AND lu.is_active = true
    AND lu.rotation_week = get_current_rotation_week()
    ORDER BY lt.name;
END;
$$ LANGUAGE plpgsql;

-- Function to rotate free user tracks
CREATE OR REPLACE FUNCTION public.rotate_free_user_tracks()
RETURNS VOID AS $$
DECLARE
    next_week INTEGER;
    available_tracks UUID[];
BEGIN
    next_week := get_current_rotation_week() + 1;
    
    -- Select 3 tracks that haven't been in rotation recently
    SELECT ARRAY_AGG(id) INTO available_tracks
    FROM (
        SELECT id FROM public.library_tracks
        WHERE is_active = true 
        AND is_pro_only = false
        AND (rotation_week IS NULL OR rotation_week < get_current_rotation_week() - 4)
        ORDER BY RANDOM()
        LIMIT 3
    ) AS available;
    
    -- Update rotation week for selected tracks
    IF available_tracks IS NOT NULL THEN
        UPDATE public.library_tracks
        SET rotation_week = next_week
        WHERE id = ANY(available_tracks);
    END IF;
    
    -- Clean up old usage records (older than 8 weeks)
    DELETE FROM public.library_usage
    WHERE rotation_week < get_current_rotation_week() - 8;
END;
$$ LANGUAGE plpgsql;

-- Function to get rotation info
CREATE OR REPLACE FUNCTION public.get_rotation_info()
RETURNS TABLE (
    current_week INTEGER,
    next_rotation_date DATE,
    days_until_rotation INTEGER,
    current_tracks_count INTEGER
) AS $$
DECLARE
    next_monday DATE;
BEGIN
    -- Calculate next Monday
    next_monday := CURRENT_DATE + (8 - EXTRACT(DOW FROM CURRENT_DATE))::INTEGER;
    IF next_monday <= CURRENT_DATE THEN
        next_monday := next_monday + 7;
    END IF;
    
    RETURN QUERY
    SELECT 
        get_current_rotation_week() as current_week,
        next_monday as next_rotation_date,
        (next_monday - CURRENT_DATE)::INTEGER as days_until_rotation,
        COUNT(*)::INTEGER as current_tracks_count
    FROM public.library_tracks
    WHERE is_active = true 
    AND is_pro_only = false
    AND rotation_week = get_current_rotation_week();
END;
$$ LANGUAGE plpgsql;

-- Create library_usage table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.library_usage (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    track_id UUID NOT NULL,
    rotation_week INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES public.library_tracks(id) ON DELETE CASCADE
);

-- Add indexes for library_usage table
CREATE INDEX IF NOT EXISTS idx_library_usage_user_id ON public.library_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_library_usage_track_id ON public.library_usage(track_id);
CREATE INDEX IF NOT EXISTS idx_library_usage_rotation_week ON public.library_usage(rotation_week);
CREATE INDEX IF NOT EXISTS idx_library_usage_active ON public.library_usage(is_active);

-- Enable RLS for library_usage table
ALTER TABLE public.library_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for library_usage
CREATE POLICY "Users can view their own library usage" ON public.library_usage
    FOR SELECT TO public USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own library usage" ON public.library_usage
    FOR INSERT TO public WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own library usage" ON public.library_usage
    FOR UPDATE TO public USING (auth.uid() = user_id);

-- Allow service role to manage library usage
CREATE POLICY "Service role can manage library usage" ON public.library_usage
    FOR ALL TO service_role USING (true);

-- Add comments
COMMENT ON FUNCTION public.get_pro_user_tracks() IS 'Returns all active tracks for pro users';
COMMENT ON FUNCTION public.get_free_user_tracks() IS 'Returns tracks available for free users in the current rotation week';
COMMENT ON FUNCTION public.get_user_library_track_count(UUID) IS 'Returns the number of library tracks a user has added in the current week';
COMMENT ON FUNCTION public.add_library_track_to_user(UUID, UUID) IS 'Adds a library track to a user collection, respecting limits';
COMMENT ON FUNCTION public.remove_library_track_from_user(UUID, UUID) IS 'Removes a library track from a user collection';
COMMENT ON FUNCTION public.get_user_library_tracks(UUID) IS 'Returns all library tracks currently in a user collection';
COMMENT ON FUNCTION public.rotate_free_user_tracks() IS 'Automatically rotates 3 tracks for the next week';
COMMENT ON FUNCTION public.get_rotation_info() IS 'Returns current rotation information including next rotation date';
COMMENT ON TABLE public.library_usage IS 'Tracks which library tracks users have added to their collection';
