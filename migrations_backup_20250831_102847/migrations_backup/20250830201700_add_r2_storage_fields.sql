-- Add R2 storage fields to library_tracks table for Cloudflare R2 integration
-- This migration adds the necessary fields to work with R2 files that have short hashes

-- Add new columns for R2 storage
ALTER TABLE "public"."library_tracks" 
ADD COLUMN "file_key" text,
ADD COLUMN "preview_key" text,
ADD COLUMN "short_hash" text,
ADD COLUMN "content_hash" text,
ADD COLUMN "size_bytes" bigint,
ADD COLUMN "content_type" text;

-- Create indexes for efficient lookups
CREATE INDEX idx_library_tracks_file_key ON "public"."library_tracks" USING btree (file_key);
CREATE INDEX idx_library_tracks_preview_key ON "public"."library_tracks" USING btree (preview_key);
CREATE INDEX idx_library_tracks_short_hash ON "public"."library_tracks" USING btree (short_hash);
CREATE INDEX idx_library_tracks_content_hash ON "public"."library_tracks" USING btree (content_hash);
CREATE INDEX idx_library_tracks_size_bytes ON "public"."library_tracks" USING btree (size_bytes);

-- Add comments explaining the new fields
COMMENT ON COLUMN "public"."library_tracks"."file_key" IS 'R2 storage key for the main audio file (e.g., library/originals/trackId-hash.ext)';
COMMENT ON COLUMN "public"."library_tracks"."preview_key" IS 'R2 storage key for the preview file (e.g., library/previews/trackId-hash.mp3)';
COMMENT ON COLUMN "public"."library_tracks"."short_hash" IS 'Short hash identifier for the file (e.g., a1b2c3d4)';
COMMENT ON COLUMN "public"."library_tracks"."content_hash" IS 'SHA-256 hash of the file content for deduplication';
COMMENT ON COLUMN "public"."library_tracks"."size_bytes" IS 'File size in bytes';
COMMENT ON COLUMN "public"."library_tracks"."content_type" IS 'MIME type of the file';

-- Optional: Update existing records with placeholder values
-- This helps maintain backward compatibility while transitioning to R2
UPDATE "public"."library_tracks" 
SET 
  file_key = 'library/originals/' || track_id || '.wav',
  preview_key = 'library/previews/' || track_id || '.mp3',
  short_hash = 'legacy-' || track_id,
  content_type = CASE 
    WHEN type = 'wav' THEN 'audio/wav'
    WHEN type = 'mp3' THEN 'audio/mpeg'
    ELSE 'audio/mpeg'
  END
WHERE file_key IS NULL;
