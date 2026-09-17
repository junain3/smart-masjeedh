-- Create email_verifications table for OTP storage
CREATE TABLE IF NOT EXISTS public.email_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  temp_password TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_verifications_email_code ON public.email_verifications(email, code);
CREATE INDEX IF NOT EXISTS idx_email_verifications_email_used ON public.email_verifications(email, used);

-- Add comment
COMMENT ON TABLE public.email_verifications IS 'Stores OTP codes for email verification during signup';

-- Enable RLS
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow service role full access" ON public.email_verifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow insert for signup" ON public.email_verifications
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow select for verification" ON public.email_verifications
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow update for verification" ON public.email_verifications
  FOR UPDATE
  TO anon
  USING (true);
