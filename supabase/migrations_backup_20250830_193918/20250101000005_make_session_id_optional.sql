-- Make session_id optional in recordings table
-- This allows recordings to exist independently of sessions

-- First, drop the foreign key constraint
ALTER TABLE "public"."recordings" DROP CONSTRAINT IF EXISTS "recordings_session_id_fkey";

-- Modify the session_id column to allow NULL values
ALTER TABLE "public"."recordings" ALTER COLUMN "session_id" DROP NOT NULL;

-- Re-add the foreign key constraint with ON DELETE SET NULL
ALTER TABLE "public"."recordings" ADD CONSTRAINT "recordings_session_id_fkey" 
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL;

-- Update the index to handle NULL values
DROP INDEX IF EXISTS idx_recordings_session_id;
CREATE INDEX idx_recordings_session_id ON public.recordings USING btree (session_id) WHERE session_id IS NOT NULL; 