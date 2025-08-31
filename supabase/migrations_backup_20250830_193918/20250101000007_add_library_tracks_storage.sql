-- Storage policies for library-tracks bucket
-- These policies allow public read access to library tracks

-- Allow public read access to library tracks (since they're curated content)
CREATE POLICY "Anyone can view library tracks" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'library-tracks'
  );

-- Allow service role to manage library tracks (for CLI operations)
CREATE POLICY "Service role can manage library tracks" ON storage.objects
  FOR ALL TO service_role USING (
    bucket_id = 'library-tracks'
  );

-- Allow authenticated users to upload library tracks (for admin operations)
CREATE POLICY "Authenticated users can upload library tracks" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'library-tracks' AND 
    auth.role() = 'authenticated'
  );

-- Allow authenticated users to update library tracks
CREATE POLICY "Authenticated users can update library tracks" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'library-tracks' AND 
    auth.role() = 'authenticated'
  );

-- Allow authenticated users to delete library tracks
CREATE POLICY "Authenticated users can delete library tracks" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'library-tracks' AND 
    auth.role() = 'authenticated'
  ); 