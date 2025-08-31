-- Add preview_key column to library_tracks table
ALTER TABLE public.library_tracks ADD COLUMN preview_key TEXT;

-- Update existing tracks to ensure file_key is NOT NULL
-- First, update any NULL file_key values to use file_url as fallback
UPDATE public.library_tracks 
SET file_key = file_url 
WHERE file_key IS NULL AND file_url IS NOT NULL;

-- Now make file_key NOT NULL
ALTER TABLE public.library_tracks ALTER COLUMN file_key SET NOT NULL;

-- Add index for preview_key
CREATE INDEX idx_library_tracks_preview_key ON public.library_tracks(preview_key);

-- Add comment explaining the new field
COMMENT ON COLUMN public.library_tracks.preview_key IS 'R2 storage key for the preview file (if available)';
