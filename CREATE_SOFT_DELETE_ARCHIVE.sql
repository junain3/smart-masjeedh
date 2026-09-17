-- Create soft-delete archive table for Masjeedhs
CREATE TABLE IF NOT EXISTS public.deleted_masjeedhs_archive (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  masjid_id UUID,
  masjid_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  owner_user_id UUID,
  backup_data JSONB NOT NULL,
  status TEXT DEFAULT 'pending_deletion' CHECK (status IN ('pending_deletion', 'restored', 'permanently_deleted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  restored_at TIMESTAMPTZ,
  restored_by UUID,
  notes TEXT
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_deleted_masjeedhs_status ON public.deleted_masjeedhs_archive(status);
CREATE INDEX IF NOT EXISTS idx_deleted_masjeedhs_expires_at ON public.deleted_masjeedhs_archive(expires_at);
CREATE INDEX IF NOT EXISTS idx_deleted_masjeedhs_owner_email ON public.deleted_masjeedhs_archive(owner_email);
CREATE INDEX IF NOT EXISTS idx_deleted_masjeedhs_masjid_id ON public.deleted_masjeedhs_archive(masjid_id);

-- Add comments
COMMENT ON TABLE public.deleted_masjeedhs_archive IS 'Archive for soft-deleted masjeedhs with grace period for reactivation';
COMMENT ON COLUMN public.deleted_masjeedhs_archive.backup_data IS 'JSON snapshot of all masjeedh data including user_roles, members, staff, etc.';
COMMENT ON COLUMN public.deleted_masjeedhs_archive.expires_at IS 'Grace period end date (90 days from deletion)';
COMMENT ON COLUMN public.deleted_masjeedhs_archive.status IS 'pending_deletion = in grace period, restored = reactivated, permanently_deleted = expired';

-- Enable RLS
ALTER TABLE public.deleted_masjeedhs_archive ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow service role full access" ON public.deleted_masjeedhs_archive
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated read for admin" ON public.deleted_masjeedhs_archive
  FOR SELECT
  TO authenticated
  USING (true);

-- Function to check if email is in grace period
CREATE OR REPLACE FUNCTION public.is_email_in_grace_period(email_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.deleted_masjeedhs_archive
    WHERE owner_email = email_param
    AND status = 'pending_deletion'
    AND expires_at > NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get grace period info for an email
CREATE OR REPLACE FUNCTION public.get_grace_period_info(email_param TEXT)
RETURNS TABLE (
  masjid_id UUID,
  masjid_name TEXT,
  expires_at TIMESTAMPTZ,
  days_remaining INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dma.masjid_id,
    dma.masjid_name,
    dma.expires_at,
    EXTRACT(DAY FROM dma.expires_at - NOW())::INTEGER as days_remaining
  FROM public.deleted_masjeedhs_archive dma
  WHERE dma.owner_email = email_param
  AND dma.status = 'pending_deletion'
  AND dma.expires_at > NOW()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
