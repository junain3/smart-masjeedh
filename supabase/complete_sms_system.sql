-- ========================================================
-- COMPLETE MULTI-TENANT SMS SYSTEM - DATABASE MIGRATION
-- ========================================================
-- Smart Masjeedh Platform
-- ========================================================

-- ========================================================
-- PART 1: ADD SMS COLUMNS TO MASJIDS TABLE
-- ========================================================

-- Add SMS configuration columns to masjids table
ALTER TABLE public.masjids
ADD COLUMN IF NOT EXISTS sms_api_key TEXT,
ADD COLUMN IF NOT EXISTS sms_sender_id TEXT,
ADD COLUMN IF NOT EXISTS sms_provider_url TEXT,
ADD COLUMN IF NOT EXISTS sms_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_masjids_sms_config 
ON public.masjids(id, sms_api_key, sms_sender_id, sms_provider_url);

-- ========================================================
-- PART 2: CREATE SMS_LOGS TABLE (AUDIT & PROCESSING)
-- ========================================================

-- Create table to track all SMS messages (audit log + processing)
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  masjid_id UUID NOT NULL REFERENCES public.masjids(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  provider_response TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sms_logs_masjid_id 
ON public.sms_logs(masjid_id);

CREATE INDEX IF NOT EXISTS idx_sms_logs_status 
ON public.sms_logs(status);

CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at 
ON public.sms_logs(created_at DESC);

-- Enable RLS on sms_logs table
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- ========================================================
-- PART 3: RLS POLICIES - STRONG TENANT ISOLATION
-- ========================================================

-- --------------------------------------------------------
-- MASJIDS TABLE - SMS CONFIGURATION POLICIES
-- --------------------------------------------------------

-- Ensure masjids RLS is enabled (already should be, but just in case)
ALTER TABLE public.masjids ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view masjids they belong to
DROP POLICY IF EXISTS "Users can view their masjids" ON public.masjids;
CREATE POLICY "Users can view their masjids"
ON public.masjids
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.masjid_id = masjids.id
    AND ur.auth_user_id = auth.uid()
  )
);

-- Policy 2: Admins can update SMS settings for their masjids
DROP POLICY IF EXISTS "Admins can update SMS settings" ON public.masjids;
CREATE POLICY "Admins can update SMS settings"
ON public.masjids
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.masjid_id = masjids.id
    AND ur.auth_user_id = auth.uid()
    AND ur.role IN ('super_admin', 'admin', 'co_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.masjid_id = masjids.id
    AND ur.auth_user_id = auth.uid()
    AND ur.role IN ('super_admin', 'admin', 'co_admin')
  )
);

-- --------------------------------------------------------
-- SMS_LOGS TABLE - AUDIT & TENANT ISOLATION
-- --------------------------------------------------------

-- Policy 1: Users can view sms_logs for their masjid only
DROP POLICY IF EXISTS "Users can view SMS logs for their masjid" ON public.sms_logs;
CREATE POLICY "Users can view SMS logs for their masjid"
ON public.sms_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.masjid_id = sms_logs.masjid_id
    AND ur.auth_user_id = auth.uid()
  )
);

-- Policy 2: Users can insert sms_logs for their masjid only
DROP POLICY IF EXISTS "Users can insert SMS logs for their masjid" ON public.sms_logs;
CREATE POLICY "Users can insert SMS logs for their masjid"
ON public.sms_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.masjid_id = sms_logs.masjid_id
    AND ur.auth_user_id = auth.uid()
    AND ur.role IN ('super_admin', 'admin', 'co_admin')
  )
);

-- Policy 3: NO UPDATE/DELETE FROM FRONTEND - only Edge Function can update
-- (Service Role bypasses RLS, so Edge Function can update)
DROP POLICY IF EXISTS "No direct updates to SMS logs" ON public.sms_logs;

-- ========================================================
-- PART 4: HELPER TRIGGERS & UTILITIES
-- ========================================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS update_sms_logs_updated_at ON public.sms_logs;

-- Create trigger for sms_logs
CREATE TRIGGER update_sms_logs_updated_at
BEFORE UPDATE ON public.sms_logs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ========================================================
-- VERIFICATION QUERIES
-- ========================================================

-- Verify new columns in masjids table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'masjids'
AND column_name LIKE 'sms_%'
ORDER BY ordinal_position;

-- Verify sms_logs table exists
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'sms_logs';

-- Verify RLS policies for sms_logs
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('masjids', 'sms_logs')
ORDER BY tablename, policyname;
