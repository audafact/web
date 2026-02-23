-- Migration: Load all available tracks for free users (no rotation filter)
-- Description: Free users get all active non-pro tracks instead of 10 from current rotation week
-- Date: 2026-02-22

CREATE OR REPLACE FUNCTION get_user_tracks(user_id UUID)
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
) AS $$
DECLARE
  user_tier TEXT;
BEGIN
  SELECT access_tier INTO user_tier
  FROM public.users
  WHERE id = user_id;

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
      lt.genre,
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
    ORDER BY lt.rotation_week DESC NULLS LAST, lt.name;

  ELSIF user_tier = 'free' THEN
    -- Free users get all active non-pro tracks (no rotation filter or limit)
    RETURN QUERY
    SELECT
      lt.track_id,
      lt.name,
      lt.artist,
      lt.genre,
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
      AND lt.is_pro_only = false
    ORDER BY lt.name;

  ELSE
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_tracks(UUID) IS 'Returns tracks based on user tier: pro users get all tracks, free users get all non-pro tracks (no rotation limit)';
