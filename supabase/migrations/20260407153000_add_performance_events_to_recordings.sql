DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'recordings'
      AND column_name = 'performance_events'
  ) THEN
    ALTER TABLE public.recordings
      ADD COLUMN performance_events jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'recordings'
      AND column_name = 'event_schema_version'
  ) THEN
    ALTER TABLE public.recordings
      ADD COLUMN event_schema_version integer NOT NULL DEFAULT 1;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'recordings'
      AND column_name = 'performance_meta'
  ) THEN
    ALTER TABLE public.recordings
      ADD COLUMN performance_meta jsonb;
  END IF;
END $$;

COMMENT ON COLUMN public.recordings.performance_events IS 'Timestamped event stream captured during performance record-on to record-off window.';
COMMENT ON COLUMN public.recordings.event_schema_version IS 'Schema version for performance_events payload.';
COMMENT ON COLUMN public.recordings.performance_meta IS 'Optional metadata for performance capture (e.g. tempo, feature flags).';
