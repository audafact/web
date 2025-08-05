-- Fix RLS policies to allow service role to manage library tracks
-- This allows the CLI script to insert and update tracks

-- Allow service role to manage library tracks (for CLI operations)
CREATE POLICY "Service role can manage library tracks" ON public.library_tracks
    FOR ALL TO service_role USING (true);

-- Allow service role to manage track rotations
CREATE POLICY "Service role can manage track rotations" ON public.track_rotations
    FOR ALL TO service_role USING (true); 