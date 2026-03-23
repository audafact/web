-- Add mood_themes and ml_analyzed_at to library_tracks for R2 track analysis cron
-- Non-destructive: only adds columns. No data overwritten; genres, tags, and other
-- existing columns are preserved. The analysis job will populate these fields.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'library_tracks'
          AND column_name = 'mood_themes'
    ) THEN
        ALTER TABLE public.library_tracks
        ADD COLUMN mood_themes TEXT[] DEFAULT '{}';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'library_tracks'
          AND column_name = 'ml_analyzed_at'
    ) THEN
        ALTER TABLE public.library_tracks
        ADD COLUMN ml_analyzed_at TIMESTAMPTZ;
    END IF;
END $$;

COMMENT ON COLUMN public.library_tracks.mood_themes IS 'ML-extracted mood/theme labels from mood-themes API';
COMMENT ON COLUMN public.library_tracks.ml_analyzed_at IS 'When this track was last analyzed by the ML cron job';
