-- Add hash-related fields to library_tracks table for R2 storage
ALTER TABLE "public"."library_tracks" 
ADD COLUMN "content_hash" text,
ADD COLUMN "size_bytes" bigint,
ADD COLUMN "content_type" text;

-- Create index on content_hash for efficient duplicate checking
CREATE INDEX idx_library_tracks_content_hash ON "public"."library_tracks" USING btree (content_hash);

-- Create index on size_bytes for efficient size-based queries
CREATE INDEX idx_library_tracks_size_bytes ON "public"."library_tracks" USING btree (size_bytes);

-- Add comments explaining the new fields
COMMENT ON COLUMN "public"."library_tracks"."content_hash" IS 'SHA-256 hash of the file content for deduplication';
COMMENT ON COLUMN "public"."library_tracks"."size_bytes" IS 'File size in bytes';
COMMENT ON COLUMN "public"."library_tracks"."content_type" IS 'MIME type of the file';
