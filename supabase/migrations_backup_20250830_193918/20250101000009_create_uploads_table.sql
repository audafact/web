-- Create uploads table for user-generated content
CREATE TABLE public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_uploads_user_id ON public.uploads(user_id);
CREATE INDEX idx_uploads_created_at ON public.uploads(created_at);
CREATE INDEX idx_uploads_file_key ON public.uploads(file_key);

-- Constraints
ALTER TABLE public.uploads ADD CONSTRAINT uploads_file_key_unique UNIQUE(file_key);
ALTER TABLE public.uploads ADD CONSTRAINT uploads_size_bytes_positive CHECK(size_bytes > 0);

-- Enable RLS
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own uploads" ON public.uploads
    FOR SELECT TO public USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own uploads" ON public.uploads
    FOR INSERT TO public WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own uploads" ON public.uploads
    FOR UPDATE TO public USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own uploads" ON public.uploads
    FOR DELETE TO public USING (auth.uid() = user_id);

-- Allow service role to manage uploads (for CLI operations)
CREATE POLICY "Service role can manage uploads" ON public.uploads
    FOR ALL TO service_role USING (true);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_uploads_updated_at 
    BEFORE UPDATE ON public.uploads 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
