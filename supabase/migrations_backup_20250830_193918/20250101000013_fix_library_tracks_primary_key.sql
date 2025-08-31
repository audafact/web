-- Fix missing primary key on library_tracks table
-- This migration adds the primary key constraint that was missing

-- Add primary key constraint to the id column
ALTER TABLE public.library_tracks 
ADD CONSTRAINT library_tracks_pkey PRIMARY KEY (id);

-- Ensure track_id has a unique constraint (should already exist but making sure)
ALTER TABLE public.library_tracks 
ADD CONSTRAINT library_tracks_track_id_unique UNIQUE (track_id);

-- Add comment explaining the fix
COMMENT ON TABLE public.library_tracks IS 'Library tracks table with proper primary key constraints';
