-- Add full_state column to sessions for complete session restore
-- Stores tracks with fileKey, params, cue points, etc. (excludes zoom, playback position)
-- Date: 2025-03-05

ALTER TABLE "public"."sessions" ADD COLUMN IF NOT EXISTS "full_state" jsonb DEFAULT '{}';

COMMENT ON COLUMN "public"."sessions"."full_state" IS 'Complete session state for full restore: tracks with fileKey, params, cue points, etc.';
