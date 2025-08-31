-- Add R2 storage fields to recordings table for Cloudflare R2 integration
-- This migration adds the necessary fields to work with R2 files
-- Updated to be idempotent - safe to run multiple times

-- Add new columns for R2 storage (only if they don't exist)
DO $$
BEGIN
    -- Add file_key column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recordings' 
        AND column_name = 'file_key'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."recordings" ADD COLUMN "file_key" text;
    END IF;
    
    -- Add content_hash column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recordings' 
        AND column_name = 'content_hash'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."recordings" ADD COLUMN "content_hash" text;
    END IF;
    
    -- Add size_bytes column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recordings' 
        AND column_name = 'size_bytes'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."recordings" ADD COLUMN "size_bytes" bigint;
    END IF;
    
    -- Add content_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recordings' 
        AND column_name = 'content_type'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."recordings" ADD COLUMN "content_type" text;
    END IF;
    
    -- Add original_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recordings' 
        AND column_name = 'original_name'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."recordings" ADD COLUMN "original_name" text;
    END IF;
END $$;

-- Make session_id optional (already done in previous migration, but ensuring it's here)
-- This is safe to run multiple times
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recordings' 
        AND column_name = 'session_id'
        AND table_schema = 'public'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "public"."recordings" ALTER COLUMN "session_id" DROP NOT NULL;
    END IF;
END $$;

-- Create indexes for efficient lookups (only if they don't exist)
DO $$
BEGIN
    -- Create file_key index if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'recordings' 
        AND indexname = 'idx_recordings_file_key'
    ) THEN
        CREATE INDEX idx_recordings_file_key ON "public"."recordings" USING btree (file_key);
    END IF;
    
    -- Create content_hash index if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'recordings' 
        AND indexname = 'idx_recordings_content_hash'
    ) THEN
        CREATE INDEX idx_recordings_content_hash ON "public"."recordings" USING btree (content_hash);
    END IF;
    
    -- Create size_bytes index if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'recordings' 
        AND indexname = 'idx_recordings_size_bytes'
    ) THEN
        CREATE INDEX idx_recordings_size_bytes ON "public"."recordings" USING btree (size_bytes);
    END IF;
END $$;

-- Add comments to document the new columns
COMMENT ON COLUMN public.recordings.file_key IS 'R2 storage key for the recording file (e.g., sessions/{userId}/{recordingId}-{hash}.wav)';
COMMENT ON COLUMN public.recordings.content_hash IS 'SHA-256 hash of the recording content for deduplication';
COMMENT ON COLUMN public.recordings.size_bytes IS 'File size in bytes';
COMMENT ON COLUMN public.recordings.content_type IS 'MIME type of the recording file';
COMMENT ON COLUMN public.recordings.original_name IS 'Original filename of the recording';

-- Update existing recordings to have placeholder values for backward compatibility
-- This is safe to run multiple times
UPDATE public.recordings 
SET file_key = COALESCE(file_key, 'legacy/' || id::text || '.wav'),
    content_hash = COALESCE(content_hash, 'legacy-' || id::text),
    size_bytes = COALESCE(size_bytes, 0),
    content_type = COALESCE(content_type, 'audio/wav'),
    original_name = COALESCE(original_name, 'legacy_recording.wav')
WHERE file_key IS NULL 
   OR content_hash IS NULL 
   OR size_bytes IS NULL 
   OR content_type IS NULL 
   OR original_name IS NULL; 
