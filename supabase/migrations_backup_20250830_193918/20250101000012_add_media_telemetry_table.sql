-- Create media telemetry table for Worker API logging
CREATE TABLE IF NOT EXISTS public.media_telemetry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('preview', 'download', 'upload', 'delete', 'stream', 'error')),
  file_key TEXT NOT NULL,
  user_tier TEXT NOT NULL DEFAULT 'free',
  response_time INTEGER NOT NULL, -- in milliseconds
  status INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_telemetry_user_id ON public.media_telemetry(user_id);
CREATE INDEX IF NOT EXISTS idx_media_telemetry_timestamp ON public.media_telemetry(timestamp);
CREATE INDEX IF NOT EXISTS idx_media_telemetry_action ON public.media_telemetry(action);
CREATE INDEX IF NOT EXISTS idx_media_telemetry_status ON public.media_telemetry(status);
CREATE INDEX IF NOT EXISTS idx_media_telemetry_user_tier ON public.media_telemetry(user_tier);

-- Add RLS policies
ALTER TABLE public.media_telemetry ENABLE ROW LEVEL SECURITY;

-- Users can view their own telemetry data
CREATE POLICY "Users can view own telemetry" ON public.media_telemetry
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert telemetry data
CREATE POLICY "Service role can insert telemetry" ON public.media_telemetry
  FOR INSERT WITH CHECK (true);

-- Add comments
COMMENT ON TABLE public.media_telemetry IS 'Telemetry logs from Worker API operations';
COMMENT ON COLUMN public.media_telemetry.action IS 'Type of operation performed';
COMMENT ON COLUMN public.media_telemetry.file_key IS 'R2 object key that was accessed';
COMMENT ON COLUMN public.media_telemetry.user_tier IS 'User access tier at time of operation';
COMMENT ON COLUMN public.media_telemetry.response_time IS 'Response time in milliseconds';
COMMENT ON COLUMN public.media_telemetry.status IS 'HTTP status code returned';
COMMENT ON COLUMN public.media_telemetry.metadata IS 'Additional operation metadata as JSON';
