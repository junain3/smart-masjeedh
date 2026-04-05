-- CREATE STORAGE BUCKET FOR MASJID LOGOS
-- Run this SQL in your Supabase dashboard

-- Create bucket for masjid logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'masjid-logos', 
  'masjid-logos', 
  true, 
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Set up Row Level Security for the bucket
CREATE POLICY "Public Access for Masjid Logos" ON storage.objects
FOR SELECT USING (bucket_id = 'masjid-logos');

CREATE POLICY "Authenticated users can upload logos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'masjid-logos' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update their logos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'masjid-logos' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete their logos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'masjid-logos' AND 
  auth.role() = 'authenticated'
);
