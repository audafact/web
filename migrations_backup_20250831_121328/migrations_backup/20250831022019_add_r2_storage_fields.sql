-- Add R2 storage fields to library_tracks table for Cloudflare R2 integration
-- This migration adds the necessary fields to work with R2 files that have short hashes
-- Updated to be idempotent - safe to run multiple times

-- Add new columns for R2 storage (only if they don't exist)
DO $$
BEGIN
    -- Add file_key column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'library_tracks' 
        AND column_name = 'file_key'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."library_tracks" ADD COLUMN "file_key" text;
    END IF;
    
    -- Add preview_key column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'library_tracks' 
        AND column_name = 'preview_key'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."library_tracks" ADD COLUMN "preview_key" text;
    END IF;
    
    -- Add short_hash column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'library_tracks' 
        AND column_name = 'short_hash'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."library_tracks" ADD COLUMN "short_hash" text;
    END IF;
    
    -- Add content_hash column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'library_tracks' 
        AND column_name = 'content_hash'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."library_tracks" ADD COLUMN "content_hash" text;
    END IF;
    
    -- Add size_bytes column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'library_tracks' 
        AND column_name = 'size_bytes'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."library_tracks" ADD COLUMN "size_bytes" bigint;
    END IF;
    
    -- Add content_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'library_tracks' 
        AND column_name = 'content_type'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."library_tracks" ADD COLUMN "content_type" text;
    END IF;
END $$;

-- Add comments to document the new columns
COMMENT ON COLUMN public.library_tracks.file_key IS 'R2 storage file key for the main audio file';
COMMENT ON COLUMN public.library_tracks.preview_key IS 'R2 storage file key for the preview audio file';
COMMENT ON COLUMN public.library_tracks.short_hash IS 'Short hash identifier for the audio file';
COMMENT ON COLUMN public.library_tracks.content_hash IS 'Full content hash for file integrity verification';
COMMENT ON COLUMN public.library_tracks.size_bytes IS 'File size in bytes';
COMMENT ON COLUMN public.library_tracks.content_type IS 'MIME type of the audio file';

-- Update any existing records that might need these fields
-- This is safe to run multiple times
UPDATE public.library_tracks 
SET file_key = COALESCE(file_key, ''),
    preview_key = COALESCE(preview_key, ''),
    short_hash = COALESCE(short_hash, ''),
    content_hash = COALESCE(content_hash, ''),
    size_bytes = COALESCE(size_bytes, 0),
    content_type = COALESCE(content_type, 'audio/mpeg')
WHERE file_key IS NULL 
   OR preview_key IS NULL 
   OR short_hash IS NULL 
   OR content_hash IS NULL 
   OR size_bytes IS NULL 
   OR content_type IS NULL;
