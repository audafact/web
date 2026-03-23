-- Creative metrics aggregation for PMF tracking
-- SECURITY DEFINER allows reading all analytics_events regardless of RLS

CREATE OR REPLACE FUNCTION get_creative_metrics(p_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days', p_to TIMESTAMPTZ DEFAULT NOW())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  ttfc_avg NUMERIC;
  creations_per_session_avg NUMERIC;
  session_duration_avg NUMERIC;
  export_rate NUMERIC;
  return_rate NUMERIC;
  total_creative_sessions BIGINT;
  total_sessions BIGINT;
  sessions_with_export BIGINT;
  sessions_with_save BIGINT;
  users_with_return BIGINT;
  total_users BIGINT;
BEGIN
  -- TTFC: avg time_since_ready from first_creative_action (creative sessions only)
  SELECT COALESCE(AVG((properties->>'timeSinceReadyMs')::NUMERIC), 0)
  INTO ttfc_avg
  FROM analytics_events
  WHERE event = 'first_creative_action'
    AND timestamp >= p_from AND timestamp <= p_to
    AND properties ? 'timeSinceReadyMs';

  -- Creations per session: count creative events per session, avg
  WITH creative_counts AS (
    SELECT session_id, COUNT(*) AS cnt
    FROM analytics_events
    WHERE timestamp >= p_from AND timestamp <= p_to
      AND event IN ('cue_added','loop_created','track_added','parameter_changed','record_started')
    GROUP BY session_id
  )
  SELECT COALESCE(AVG(cnt)::NUMERIC, 0) INTO creations_per_session_avg FROM creative_counts;

  -- Creative session duration: first to last creative action per session (approximation)
  -- We use MIN and MAX timestamp of creative events per session
  WITH session_bounds AS (
    SELECT session_id,
      MIN(timestamp) AS first_ts,
      MAX(timestamp) AS last_ts
    FROM analytics_events
    WHERE timestamp >= p_from AND timestamp <= p_to
      AND event IN ('cue_added','loop_created','track_added','parameter_changed','record_started','record_stopped')
    GROUP BY session_id
    HAVING COUNT(*) > 0
  )
  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (last_ts - first_ts)) / 60.0)::NUMERIC, 0)
  INTO session_duration_avg
  FROM session_bounds;

  -- Export/Save rate: creative sessions with session_saved OR audio_exported / total creative sessions
  WITH creative_sessions AS (
    SELECT DISTINCT session_id
    FROM analytics_events
    WHERE timestamp >= p_from AND timestamp <= p_to
      AND event IN ('cue_added','loop_created','track_added','parameter_changed','record_started')
  ),
  exported_sessions AS (
    SELECT DISTINCT session_id
    FROM analytics_events e
    WHERE timestamp >= p_from AND timestamp <= p_to
      AND (event = 'session_saved' OR event = 'audio_exported' OR event = 'recording_downloaded')
      AND EXISTS (SELECT 1 FROM creative_sessions cs WHERE cs.session_id = e.session_id)
  )
  SELECT
    (SELECT COUNT(*) FROM creative_sessions) AS total_cs,
    (SELECT COUNT(*) FROM exported_sessions) AS with_export
  INTO total_creative_sessions, sessions_with_export;

  IF total_creative_sessions > 0 THEN
    export_rate := (sessions_with_export::NUMERIC / total_creative_sessions) * 100;
  ELSE
    export_rate := 0;
  END IF;

  -- Return-to-create: users with creative_action_after_return within 7 days / total users
  -- Simplified: count distinct users with creative_action_after_return in period
  SELECT
    COUNT(DISTINCT user_id) FILTER (WHERE event = 'creative_action_after_return') AS ret,
    COUNT(DISTINCT user_id) AS tot
  INTO users_with_return, total_users
  FROM analytics_events
  WHERE timestamp >= p_from AND timestamp <= p_to
    AND user_id IS NOT NULL;

  IF total_users > 0 THEN
    return_rate := (users_with_return::NUMERIC / total_users) * 100;
  ELSE
    return_rate := 0;
  END IF;

  result := jsonb_build_object(
    'ttfcAvgMs', ROUND(ttfc_avg::NUMERIC, 0),
    'ttfcAvgSeconds', ROUND(ttfc_avg / 1000, 1),
    'creationsPerSessionAvg', ROUND(creations_per_session_avg, 2),
    'creativeSessionDurationMinutes', ROUND(session_duration_avg, 2),
    'exportSaveRatePercent', ROUND(export_rate, 2),
    'returnToCreateRatePercent', ROUND(return_rate, 2),
    'totalCreativeSessions', total_creative_sessions,
    'from', p_from,
    'to', p_to
  );
  RETURN result;
END;
$$;

-- Creative funnel: % reaching each stage
CREATE OR REPLACE FUNCTION get_creative_funnel(p_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days', p_to TIMESTAMPTZ DEFAULT NOW())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  total_sessions BIGINT;
  sampler_opened_count BIGINT;
  track_loaded_count BIGINT;
  sampler_ready_count BIGINT;
  first_creative_count BIGINT;
BEGIN
  SELECT COUNT(DISTINCT session_id) INTO total_sessions
  FROM analytics_events
  WHERE timestamp >= p_from AND timestamp <= p_to;

  SELECT COUNT(DISTINCT session_id) INTO sampler_opened_count
  FROM analytics_events WHERE event = 'sampler_opened' AND timestamp >= p_from AND timestamp <= p_to;

  SELECT COUNT(DISTINCT session_id) INTO track_loaded_count
  FROM analytics_events WHERE event = 'track_loaded' AND timestamp >= p_from AND timestamp <= p_to;

  SELECT COUNT(DISTINCT session_id) INTO sampler_ready_count
  FROM analytics_events WHERE event = 'sampler_ready' AND timestamp >= p_from AND timestamp <= p_to;

  SELECT COUNT(DISTINCT session_id) INTO first_creative_count
  FROM analytics_events WHERE event = 'first_creative_action' AND timestamp >= p_from AND timestamp <= p_to;

  result := jsonb_build_object(
    'totalSessions', total_sessions,
    'samplerOpened', sampler_opened_count,
    'trackLoaded', track_loaded_count,
    'samplerReady', sampler_ready_count,
    'firstCreativeAction', first_creative_count,
    'pctTrackLoaded', CASE WHEN sampler_opened_count > 0 THEN ROUND((track_loaded_count::NUMERIC / sampler_opened_count) * 100, 2) ELSE 0 END,
    'pctSamplerReady', CASE WHEN track_loaded_count > 0 THEN ROUND((sampler_ready_count::NUMERIC / track_loaded_count) * 100, 2) ELSE 0 END,
    'pctFirstCreative', CASE WHEN sampler_ready_count > 0 THEN ROUND((first_creative_count::NUMERIC / sampler_ready_count) * 100, 2) ELSE 0 END,
    'from', p_from,
    'to', p_to
  );
  RETURN result;
END;
$$;

-- Early warning signals
CREATE OR REPLACE FUNCTION get_creative_early_warnings(p_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days', p_to TIMESTAMPTZ DEFAULT NOW())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  metrics JSONB;
  warnings JSONB := '[]'::JSONB;
BEGIN
  metrics := get_creative_metrics(p_from, p_to);

  -- TTFC > 3 min (180000 ms)
  IF (metrics->>'ttfcAvgMs')::NUMERIC > 180000 THEN
    warnings := warnings || jsonb_build_object('signal', 'ttfc_high', 'message', 'TTFC > 3 min: onboarding or UX friction', 'value', metrics->>'ttfcAvgMs');
  END IF;

  -- Creations per session < 3
  IF (metrics->>'creationsPerSessionAvg')::NUMERIC < 3 AND (metrics->>'totalCreativeSessions')::BIGINT > 0 THEN
    warnings := warnings || jsonb_build_object('signal', 'creations_low', 'message', 'Creations/session < 3: low engagement', 'value', metrics->>'creationsPerSessionAvg');
  END IF;

  -- Session duration < 5 min
  IF (metrics->>'creativeSessionDurationMinutes')::NUMERIC < 5 AND (metrics->>'totalCreativeSessions')::BIGINT > 0 THEN
    warnings := warnings || jsonb_build_object('signal', 'duration_low', 'message', 'Session duration < 5 min: no flow state', 'value', metrics->>'creativeSessionDurationMinutes');
  END IF;

  -- Export rate < 5%
  IF (metrics->>'exportSaveRatePercent')::NUMERIC < 5 AND (metrics->>'totalCreativeSessions')::BIGINT > 0 THEN
    warnings := warnings || jsonb_build_object('signal', 'export_low', 'message', 'Export rate < 5%: not valuable output', 'value', metrics->>'exportSaveRatePercent');
  END IF;

  -- Return-to-create < 10%
  IF (metrics->>'returnToCreateRatePercent')::NUMERIC < 10 THEN
    warnings := warnings || jsonb_build_object('signal', 'return_low', 'message', 'Return-to-create < 10%: weak retention', 'value', metrics->>'returnToCreateRatePercent');
  END IF;

  RETURN jsonb_build_object('metrics', metrics, 'warnings', warnings);
END;
$$;

GRANT EXECUTE ON FUNCTION get_creative_metrics(TIMESTAMPTZ, TIMESTAMPTZ) TO anon;
GRANT EXECUTE ON FUNCTION get_creative_funnel(TIMESTAMPTZ, TIMESTAMPTZ) TO anon;
GRANT EXECUTE ON FUNCTION get_creative_early_warnings(TIMESTAMPTZ, TIMESTAMPTZ) TO anon;
