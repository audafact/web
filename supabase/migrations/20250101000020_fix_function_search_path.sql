-- Migration: Fix Function Search Path Security Issues
-- Description: Add SET search_path to all functions to prevent search path injection attacks
-- Date: 2025-01-01
-- Status: SAFE - Security improvement, non-destructive

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Insert a new user record when auth.users gets a new entry
  INSERT INTO public.users (id, access_tier, created_at, updated_at)
  VALUES (NEW.id, 'free', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING; -- Prevent duplicate insertions
  
  RETURN NEW;
END;
$function$;

-- Fix check_user_upload_quota function
CREATE OR REPLACE FUNCTION public.check_user_upload_quota(
  p_user_id UUID,
  p_file_size BIGINT,
  p_quota_limit BIGINT DEFAULT 100000000 -- 100MB default
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Check daily upload size
  DECLARE
    daily_total BIGINT;
  BEGIN
    SELECT COALESCE(SUM(file_size), 0)
    INTO daily_total
    FROM public.uploads
    WHERE user_id = p_user_id
    AND created_at >= CURRENT_DATE;

    RETURN (daily_total + p_file_size) <= p_quota_limit;
  END;
END;
$$;

-- Fix check_daily_upload_size function (drop first if exists with different signature)
DROP FUNCTION IF EXISTS public.check_daily_upload_size(UUID, BIGINT);
CREATE OR REPLACE FUNCTION public.check_daily_upload_size(
  user_id UUID,
  requested_size BIGINT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  daily_total BIGINT;
  daily_limit BIGINT := 100000000; -- 100MB default
  allowed BOOLEAN;
BEGIN
  SELECT COALESCE(SUM(file_size), 0)
  INTO daily_total
  FROM public.uploads
  WHERE public.uploads.user_id = check_daily_upload_size.user_id
  AND created_at >= CURRENT_DATE;

  allowed := (daily_total + requested_size) <= daily_limit;
  
  RETURN jsonb_build_object(
    'allowed', allowed,
    'limit', daily_limit,
    'used', daily_total,
    'remaining', GREATEST(0, daily_limit - daily_total),
    'reason', CASE WHEN allowed THEN NULL ELSE 'Daily upload size limit exceeded' END
  );
END;
$$;

-- Fix check_daily_upload_count function (drop first if exists with different signature)
DROP FUNCTION IF EXISTS public.check_daily_upload_count(UUID);
CREATE OR REPLACE FUNCTION public.check_daily_upload_count(
  user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  daily_count BIGINT;
  daily_limit BIGINT := 50; -- 50 uploads per day default
  allowed BOOLEAN;
BEGIN
  SELECT COUNT(*)
  INTO daily_count
  FROM public.uploads
  WHERE public.uploads.user_id = check_daily_upload_count.user_id
  AND created_at >= CURRENT_DATE;

  allowed := daily_count < daily_limit;
  
  RETURN jsonb_build_object(
    'allowed', allowed,
    'limit', daily_limit,
    'used', daily_count,
    'remaining', GREATEST(0, daily_limit - daily_count),
    'reason', CASE WHEN allowed THEN NULL ELSE 'Daily upload count limit exceeded' END
  );
END;
$$;

-- Fix get_user_tracks function
CREATE OR REPLACE FUNCTION public.get_user_tracks(user_id UUID)
RETURNS TABLE (
  track_id TEXT,
  name TEXT,
  artist TEXT,
  genre TEXT[],
  bpm INTEGER,
  key TEXT,
  duration INTEGER,
  file_key TEXT,
  preview_key TEXT,
  type TEXT,
  size TEXT,
  tags TEXT[],
  is_pro_only BOOLEAN,
  rotation_week INTEGER,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_tier TEXT;
BEGIN
  -- Check if user exists and get their tier
  SELECT access_tier INTO user_tier
  FROM public.users
  WHERE id = user_id;
  
  -- If user doesn't exist, return no tracks (guest user)
  IF user_tier IS NULL THEN
    RETURN;
  END IF;
  
  IF user_tier = 'pro' THEN
    -- Pro users get all active tracks
    RETURN QUERY
    SELECT 
      lt.track_id,
      lt.name,
      lt.artist,
      CASE WHEN lt.genre IS NOT NULL THEN ARRAY[lt.genre]::TEXT[] ELSE ARRAY[]::TEXT[] END,
      lt.bpm,
      lt.key,
      lt.duration,
      lt.file_key,
      lt.preview_key,
      lt.type,
      lt.size,
      lt.tags,
      lt.is_pro_only,
      lt.rotation_week,
      lt.is_active
    FROM public.library_tracks lt
    WHERE lt.is_active = true
    ORDER BY lt.rotation_week DESC, lt.name;
    
  ELSIF user_tier = 'free' THEN
    -- Free users get tracks from current rotation week (limited to 10)
    RETURN QUERY
    SELECT 
      lt.track_id,
      lt.name,
      lt.artist,
      CASE WHEN lt.genre IS NOT NULL THEN ARRAY[lt.genre]::TEXT[] ELSE ARRAY[]::TEXT[] END,
      lt.bpm,
      lt.key,
      lt.duration,
      lt.file_key,
      lt.preview_key,
      lt.type,
      lt.size,
      lt.tags,
      lt.is_pro_only,
      lt.rotation_week,
      lt.is_active
    FROM public.library_tracks lt
    WHERE lt.is_active = true 
      AND lt.rotation_week = public.get_current_rotation_week()
      AND lt.is_pro_only = false
    ORDER BY lt.name
    LIMIT 10;
    
  ELSE
    -- Unknown tier or guest users get no tracks (they use bundled tracks)
    RETURN;
  END IF;
END;
$$;

-- Fix extract_track_id_from_file_key function
CREATE OR REPLACE FUNCTION public.extract_track_id_from_file_key(file_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
    filename TEXT;
    parts TEXT[];
    i INTEGER;
    track_id TEXT;
BEGIN
    -- Handle null or empty file_key
    IF file_key IS NULL OR file_key = '' THEN
        RETURN NULL;
    END IF;
    
    -- Get filename from path
    filename := split_part(file_key, '/', -1);
    
    -- Remove file extension
    filename := split_part(filename, '.', 1);
    
    -- Split by '-' to find the hash
    parts := string_to_array(filename, '-');
    track_id := '';
    
    -- Build track_id by stopping before the 10-character hash
    FOR i IN 1..array_length(parts, 1) LOOP
        -- Check if this part is a 10-character hex hash
        IF length(parts[i]) = 10 AND parts[i] ~ '^[a-f0-9]+$' THEN
            -- Found the hash, stop here
            EXIT;
        ELSE
            -- This is part of the track_id
            IF track_id = '' THEN
                track_id := parts[i];
            ELSE
                track_id := track_id || '-' || parts[i];
            END IF;
        END IF;
    END LOOP;
    
    RETURN track_id;
END;
$$;

-- Fix get_current_rotation_week function
CREATE OR REPLACE FUNCTION public.get_current_rotation_week()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RETURN FLOOR(EXTRACT(EPOCH FROM (CURRENT_DATE - DATE '2024-01-01')) / (7 * 24 * 60 * 60));
END;
$$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Fix validate_schema_changes function
CREATE OR REPLACE FUNCTION public.validate_schema_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    -- This function can be used in future migrations to validate changes
    -- For now, it just logs that the schema is protected
    RAISE NOTICE 'Schema validation: % table structure is protected', TG_TABLE_NAME;
    RETURN NEW;
END;
$$;

-- Fix get_free_user_tracks function
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
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
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
    AND lt.rotation_week = public.get_current_rotation_week()
    ORDER BY lt.name;
END;
$$;

-- Fix get_pro_user_tracks function
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
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
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
$$;

-- Fix get_user_library_track_count function
CREATE OR REPLACE FUNCTION public.get_user_library_track_count(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM public.library_usage lu
        WHERE lu.user_id = user_uuid 
        AND lu.is_active = true
        AND lu.rotation_week = public.get_current_rotation_week()
    );
END;
$$;

-- Fix get_user_analytics_summary function
CREATE OR REPLACE FUNCTION public.get_user_analytics_summary(p_user_id UUID)
RETURNS TABLE (
  total_events BIGINT,
  unique_sessions BIGINT,
  events_by_type JSONB,
  first_event_at TIMESTAMPTZ,
  last_event_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_events,
    COUNT(DISTINCT session_id) as unique_sessions,
    jsonb_object_agg(event, event_count) as events_by_type,
    MIN(timestamp) as first_event_at,
    MAX(timestamp) as last_event_at
  FROM (
    SELECT 
      event,
      COUNT(*) as event_count
    FROM public.analytics_events 
    WHERE user_id = p_user_id
    GROUP BY event
  ) event_counts;
END;
$$;

-- Fix get_funnel_conversion_rates function
CREATE OR REPLACE FUNCTION public.get_funnel_conversion_rates()
RETURNS TABLE (
  stage TEXT,
  total_users BIGINT,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH funnel_stages AS (
    SELECT unnest(ARRAY[
      'demo_track_loaded',
      'demo_mode_switched', 
      'feature_gate_clicked',
      'signup_modal_shown',
      'signup_completed',
      'upgrade_clicked',
      'upgrade_completed'
    ]) as stage
  ),
  stage_counts AS (
    SELECT 
      fs.stage,
      COUNT(DISTINCT ae.user_id) as user_count
    FROM funnel_stages fs
    LEFT JOIN public.analytics_events ae ON ae.event = fs.stage
    GROUP BY fs.stage
  )
  SELECT 
    sc.stage,
    sc.user_count as total_users,
    CASE 
      WHEN sc.user_count = 0 THEN 0
      ELSE ROUND((sc.user_count::NUMERIC / (SELECT COUNT(DISTINCT user_id) FROM public.analytics_events)::NUMERIC) * 100, 2)
    END as conversion_rate
  FROM stage_counts sc
  ORDER BY 
    CASE sc.stage
      WHEN 'demo_track_loaded' THEN 1
      WHEN 'demo_mode_switched' THEN 2
      WHEN 'feature_gate_clicked' THEN 3
      WHEN 'signup_modal_shown' THEN 4
      WHEN 'signup_completed' THEN 5
      WHEN 'upgrade_clicked' THEN 6
      WHEN 'upgrade_completed' THEN 7
    END;
END;
$$;

-- Fix add_library_track_to_user function
CREATE OR REPLACE FUNCTION public.add_library_track_to_user(user_uuid UUID, track_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = ''
AS $$
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
        current_count := public.get_user_library_track_count(user_uuid);
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
        AND rotation_week = public.get_current_rotation_week()
    ) THEN
        RETURN false;
    END IF;
    
    -- Add track to user's collection
    INSERT INTO public.library_usage (user_id, track_id, rotation_week, is_active)
    VALUES (user_uuid, track_uuid, public.get_current_rotation_week(), true);
    
    RETURN true;
END;
$$;

-- Fix remove_library_track_from_user function
CREATE OR REPLACE FUNCTION public.remove_library_track_from_user(user_uuid UUID, track_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    UPDATE public.library_usage
    SET is_active = false
    WHERE user_id = user_uuid 
    AND track_id = track_uuid 
    AND is_active = true;
    
    RETURN FOUND;
END;
$$;

-- Fix get_user_library_tracks function
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
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
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
    AND lu.rotation_week = public.get_current_rotation_week()
    ORDER BY lt.name;
END;
$$;

-- Fix rotate_free_user_tracks function
CREATE OR REPLACE FUNCTION public.rotate_free_user_tracks()
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    next_week INTEGER;
    available_tracks UUID[];
BEGIN
    next_week := public.get_current_rotation_week() + 1;
    
    -- Select 3 tracks that haven't been in rotation recently
    SELECT ARRAY_AGG(id) INTO available_tracks
    FROM (
        SELECT id FROM public.library_tracks
        WHERE is_active = true 
        AND is_pro_only = false
        AND (rotation_week IS NULL OR rotation_week < public.get_current_rotation_week() - 4)
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
    WHERE rotation_week < public.get_current_rotation_week() - 8;
END;
$$;

-- Fix get_rotation_info function
CREATE OR REPLACE FUNCTION public.get_rotation_info()
RETURNS TABLE (
    current_week INTEGER,
    next_rotation_date DATE,
    days_until_rotation INTEGER,
    current_tracks_count INTEGER
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
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
        public.get_current_rotation_week() as current_week,
        next_monday as next_rotation_date,
        (next_monday - CURRENT_DATE)::INTEGER as days_until_rotation,
        COUNT(*)::INTEGER as current_tracks_count
    FROM public.library_tracks
    WHERE is_active = true 
    AND is_pro_only = false
    AND rotation_week = public.get_current_rotation_week();
END;
$$;

-- Fix format_track_name function
CREATE OR REPLACE FUNCTION public.format_track_name(track_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
    parts TEXT[];
    i INTEGER;
    part TEXT;
    formatted_name TEXT;
BEGIN
    -- Handle null or empty track_id
    IF track_id IS NULL OR track_id = '' THEN
        RETURN NULL;
    END IF;
    
    -- Split by hyphens
    parts := string_to_array(track_id, '-');
    formatted_name := '';
    
    -- Process each part
    FOR i IN 1..array_length(parts, 1) LOOP
        part := parts[i];
        
        -- Skip empty parts
        IF part = '' THEN
            CONTINUE;
        END IF;
        
        -- Handle version and alternate keywords
        IF part = 'version' THEN
            formatted_name := formatted_name || ' - Version ';
            CONTINUE;
        ELSIF part = 'alt' THEN
            formatted_name := formatted_name || ' - Alternate ';
            CONTINUE;
        END IF;
        
        -- Capitalize first letter
        part := upper(substring(part, 1, 1)) || lower(substring(part, 2));
        
        -- Add to formatted name
        IF formatted_name = '' THEN
            formatted_name := part;
        ELSE
            formatted_name := formatted_name || ' ' || part;
        END IF;
    END LOOP;
    
    RETURN formatted_name;
END;
$$;

-- Grant necessary permissions (preserve existing grants)
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

GRANT EXECUTE ON FUNCTION public.check_user_upload_quota(UUID, BIGINT, BIGINT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_user_upload_quota(UUID, BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_upload_quota(UUID, BIGINT, BIGINT) TO service_role;

GRANT EXECUTE ON FUNCTION public.check_daily_upload_size(UUID, BIGINT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_daily_upload_size(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_daily_upload_size(UUID, BIGINT) TO service_role;

GRANT EXECUTE ON FUNCTION public.check_daily_upload_count(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.check_daily_upload_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_daily_upload_count(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_user_tracks(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_tracks(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tracks(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.extract_track_id_from_file_key(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.extract_track_id_from_file_key(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extract_track_id_from_file_key(TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION public.format_track_name(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.format_track_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.format_track_name(TEXT) TO service_role;

-- Add comments
COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function to create user record when auth.users gets a new entry';
COMMENT ON FUNCTION public.check_user_upload_quota(UUID, BIGINT, BIGINT) IS 'Check if user can upload file based on daily quota limit';
COMMENT ON FUNCTION public.check_daily_upload_size(UUID, BIGINT) IS 'Check daily upload size quota and return status';
COMMENT ON FUNCTION public.check_daily_upload_count(UUID) IS 'Check daily upload count quota and return status';
COMMENT ON FUNCTION public.get_user_tracks(UUID) IS 'Returns tracks based on user tier: pro users get all tracks, free users get 10 tracks from current rotation week';
COMMENT ON FUNCTION public.extract_track_id_from_file_key(TEXT) IS 'Extract track ID from file key path';
COMMENT ON FUNCTION public.format_track_name(TEXT) IS 'Format track name from track ID';

