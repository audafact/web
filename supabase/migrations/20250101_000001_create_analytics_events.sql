-- Create analytics_events table for tracking user interactions and conversion events
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  event TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  user_tier TEXT DEFAULT 'guest',
  timestamp TIMESTAMPTZ NOT NULL,
  version TEXT DEFAULT '1.0.0',
  platform TEXT DEFAULT 'web',
  url TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  screen_size TEXT DEFAULT '',
  viewport_size TEXT DEFAULT '',
  network_status TEXT DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event ON analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_tier ON analytics_events(user_tier);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_event ON analytics_events(user_id, event);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_event ON analytics_events(session_id, event);
CREATE INDEX IF NOT EXISTS idx_analytics_events_tier_event ON analytics_events(user_tier, event);

-- Create GIN index for JSONB properties for efficient property queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_properties ON analytics_events USING GIN(properties);

-- Enable Row Level Security (RLS)
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own analytics events
CREATE POLICY "Users can view own analytics events" ON analytics_events
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own analytics events
CREATE POLICY "Users can insert own analytics events" ON analytics_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for the worker)
CREATE POLICY "Service role full access" ON analytics_events
  FOR ALL USING (auth.role() = 'service_role');

-- Create a function to get analytics summary for a user
CREATE OR REPLACE FUNCTION get_user_analytics_summary(p_user_id UUID)
RETURNS TABLE (
  total_events BIGINT,
  unique_sessions BIGINT,
  events_by_type JSONB,
  first_event_at TIMESTAMPTZ,
  last_event_at TIMESTAMPTZ
) AS $$
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
    FROM analytics_events 
    WHERE user_id = p_user_id
    GROUP BY event
  ) event_counts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get funnel conversion rates
CREATE OR REPLACE FUNCTION get_funnel_conversion_rates()
RETURNS TABLE (
  stage TEXT,
  total_users BIGINT,
  conversion_rate NUMERIC
) AS $$
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
    LEFT JOIN analytics_events ae ON ae.event = fs.stage
    GROUP BY fs.stage
  )
  SELECT 
    sc.stage,
    sc.user_count as total_users,
    CASE 
      WHEN sc.user_count = 0 THEN 0
      ELSE ROUND((sc.user_count::NUMERIC / (SELECT COUNT(DISTINCT user_id) FROM analytics_events)::NUMERIC) * 100, 2)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT, INSERT ON analytics_events TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_analytics_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_funnel_conversion_rates() TO authenticated;
GRANT ALL ON analytics_events TO service_role;
