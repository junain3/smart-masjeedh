-- ========================================================
-- MULTI-TENANT SMS GATEWAY SYSTEM - SQL MIGRATION
-- ========================================================

-- Step 1: Add SMS configuration columns to masjids table
ALTER TABLE public.masjids 
ADD COLUMN IF NOT EXISTS sms_api_key TEXT,
ADD COLUMN IF NOT EXISTS sms_sender_id TEXT,
ADD COLUMN IF NOT EXISTS sms_provider_url TEXT,
ADD COLUMN IF NOT EXISTS sms_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 2: Create index for performance (though not strictly needed here)
CREATE INDEX IF NOT EXISTS idx_masjids_sms_config ON public.masjids(id, sms_api_key, sms_sender_id, sms_provider_url);

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================

-- Enable RLS (though should already be enabled)
ALTER TABLE public.masjids ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view SMS settings only for their own masjid
-- (based on user_roles membership)
DROP POLICY IF EXISTS "Users can view masjids they belong to" ON public.masjids;
CREATE POLICY "Users can view masjids they belong to"
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

-- Policy 2: Users can update SMS settings only for their own masjid
DROP POLICY IF EXISTS "Users can update their own masjid SMS settings" ON public.masjids;
CREATE POLICY "Users can update their own masjid SMS settings"
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

-- ========================================================
-- HELPER FUNCTION: GET MASJID BY USER
-- ========================================================
CREATE OR REPLACE FUNCTION public.get_masjid_for_user(user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_masjid_id UUID;
BEGIN
    SELECT ur.masjid_id INTO v_masjid_id
    FROM public.user_roles ur
    WHERE ur.auth_user_id = user_id
    LIMIT 1;
    
    RETURN v_masjid_id;
END;
$$;

-- ========================================================
-- VERIFICATION
-- ========================================================
SELECT 
    'SMS columns added successfully!' as status,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'masjids'
AND column_name LIKE 'sms_%'
ORDER BY ordinal_position;

-- Verify RLS policies exist
SELECT 
    'RLS Policies for masjids table:' as section,
    policyname,
    permissive,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'masjids'
ORDER BY policyname;
