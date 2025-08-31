-- Quota checking function for user uploads
CREATE OR REPLACE FUNCTION check_user_upload_quota(
  p_user_id UUID,
  p_file_size BIGINT,
  p_quota_limit BIGINT DEFAULT 100000000 -- 100MB default
) RETURNS BOOLEAN AS $$
BEGIN
  -- Check daily upload size
  DECLARE
    daily_total BIGINT;
  BEGIN
    SELECT COALESCE(SUM(size_bytes), 0)
    INTO daily_total
    FROM public.uploads
    WHERE user_id = p_user_id
    AND created_at >= CURRENT_DATE;

    RETURN (daily_total + p_file_size) <= p_quota_limit;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Access control function for library tracks
CREATE OR REPLACE FUNCTION check_library_access(
  p_user_id UUID,
  p_track_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user has access to pro-only tracks
  DECLARE
    track_is_pro BOOLEAN;
    user_tier TEXT;
  BEGIN
    SELECT is_pro_only INTO track_is_pro
    FROM public.library_tracks
    WHERE id = p_track_id;

    IF NOT track_is_pro THEN
      RETURN TRUE; -- Free tracks accessible to all
    END IF;

    -- Check user tier for pro tracks
    SELECT access_tier INTO user_tier
    FROM public.users
    WHERE id = p_user_id;

    RETURN user_tier IN ('pro', 'enterprise');
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's current upload usage
CREATE OR REPLACE FUNCTION get_user_upload_usage(
  p_user_id UUID,
  p_period_days INTEGER DEFAULT 1
) RETURNS TABLE (
  total_size BIGINT,
  file_count BIGINT,
  period_start DATE,
  period_end DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(size_bytes), 0) as total_size,
    COUNT(*) as file_count,
    CURRENT_DATE - (p_period_days - 1) as period_start,
    CURRENT_DATE as period_end
  FROM public.uploads
  WHERE user_id = p_user_id
  AND created_at >= CURRENT_DATE - (p_period_days - 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments explaining the functions
COMMENT ON FUNCTION check_user_upload_quota IS 'Check if user can upload file based on daily quota limit';
COMMENT ON FUNCTION check_library_access IS 'Check if user has access to a specific library track based on tier';
COMMENT ON FUNCTION get_user_upload_usage IS 'Get user upload usage statistics for a specified period';
