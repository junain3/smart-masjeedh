-- ADD PREFERRED_LANGUAGE COLUMN TO MASJIDS TABLE
-- Run this SQL in your Supabase dashboard

ALTER TABLE public.masjids 
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'masjids' 
AND table_schema = 'public'
AND column_name = 'preferred_language';
