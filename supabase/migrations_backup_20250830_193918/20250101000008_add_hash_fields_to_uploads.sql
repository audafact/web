-- Add hash-related fields to uploads table for R2 storage
ALTER TABLE "public"."uploads" 
ADD COLUMN "full_hash" text,
ADD COLUMN "short_hash" text,
ADD COLUMN "server_key" text,
ADD COLUMN "size_bytes" bigint,
ADD COLUMN "content_type" text,
ADD COLUMN "original_name" text;

-- Create index on full_hash for efficient duplicate checking
CREATE INDEX idx_uploads_full_hash ON "public"."uploads" USING btree (full_hash);

-- Create index on server_key for efficient R2 lookups
CREATE INDEX idx_uploads_server_key ON "public"."uploads" USING btree (server_key);

-- Add comment explaining the new fields
COMMENT ON COLUMN "public"."uploads"."full_hash" IS 'SHA-256 hash of the file content for deduplication';
COMMENT ON COLUMN "public"."uploads"."short_hash" IS 'Short version of the hash for display purposes';
COMMENT ON COLUMN "public"."uploads"."server_key" IS 'R2 storage key for the uploaded file';
COMMENT ON COLUMN "public"."uploads"."size_bytes" IS 'File size in bytes';
COMMENT ON COLUMN "public"."uploads"."content_type" IS 'MIME type of the uploaded file';
COMMENT ON COLUMN "public"."uploads"."original_name" IS 'Original filename before upload';
