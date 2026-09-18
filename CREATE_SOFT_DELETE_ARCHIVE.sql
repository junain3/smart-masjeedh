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
  deleted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  restored_at TIMESTAMPTZ,
  restored_by UUID,
  notes TEXT
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_deleted_masjeedhs_archive_status ON public.deleted_masjeedhs_archive(status);
CREATE INDEX IF NOT EXISTS idx_deleted_masjeedhs_archive_expires_at ON public.deleted_masjeedhs_archive(expires_at);
CREATE INDEX IF NOT EXISTS idx_deleted_masjeedhs_archive_owner_email ON public.deleted_masjeedhs_archive(owner_email);

-- Enable RLS
ALTER TABLE public.deleted_masjeedhs_archive ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role full access" ON public.deleted_masjeedhs_archive
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can read (for future admin features)
CREATE POLICY "Authenticated read access" ON public.deleted_masjeedhs_archive
  FOR SELECT
  TO authenticated
  USING (true);

-- Function to reactivate a soft-deleted masjeedh (developer use only)
CREATE OR REPLACE FUNCTION public.reactivate_masjeedh(p_masjeedh_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_archive RECORD;
  v_restored_count INTEGER;
BEGIN
  -- Get the archive record
  SELECT * INTO v_archive
  FROM public.deleted_masjeedhs_archive
  WHERE masjid_id = p_masjeedh_id
  AND status = 'pending_deletion'
  AND expires_at > NOW()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No pending deletion archive found for this masjeedh, or grace period has expired'
    );
  END IF;

  -- Check if grace period has expired
  IF v_archive.expires_at <= NOW() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Grace period has expired. Cannot reactivate.'
    );
  END IF;

  -- Restore masjid record
  UPDATE public.masjids
  SET status = 'active',
      deleted_at = NULL,
      deleted_by = NULL,
      deleted_reason = NULL
  WHERE id = p_masjeedh_id;

  -- Restore user_roles
  UPDATE public.user_roles
  SET status = 'active',
      deleted_at = NULL,
      deleted_by = NULL,
      deleted_reason = NULL
  WHERE masjid_id = p_masjeedh_id;

  -- Restore related records (members, staff, events, subscriptions, families)
  UPDATE public.members SET status = 'active', deleted_at = NULL WHERE masjid_id = p_masjeedh_id;
  UPDATE public.staff SET status = 'active', deleted_at = NULL WHERE masjid_id = p_masjeedh_id;
  UPDATE public.events SET status = 'active', deleted_at = NULL WHERE masjid_id = p_masjeedh_id;
  UPDATE public.subscriptions SET status = 'active', deleted_at = NULL WHERE masjid_id = p_masjeedh_id;
  UPDATE public.families SET status = 'active', deleted_at = NULL WHERE masjid_id = p_masjeedh_id;

  -- Update archive status
  UPDATE public.deleted_masjeedhs_archive
  SET status = 'restored',
      restored_at = NOW(),
      notes = 'Manually reactivated by developer'
  WHERE id = v_archive.id;

  GET DIAGNOSTICS v_restored_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'masjid_id', p_masjeedh_id,
    'masjid_name', v_archive.masjid_name,
    'restored_at', NOW(),
    'message', 'Masjeedh reactivated successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.reactivate_masjeedh TO service_role;

-- Function to cleanup expired archives (can be called by cron job)
CREATE OR REPLACE FUNCTION public.cleanup_expired_archives()
RETURNS JSONB AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete expired archives and permanently delete their data
  WITH expired_archives AS (
    SELECT id, masjid_id
    FROM public.deleted_masjeedhs_archive
    WHERE status = 'pending_deletion'
    AND expires_at <= NOW()
  )
  DELETE FROM public.deleted_masjeedhs_archive
  WHERE id IN (SELECT id FROM expired_archives);

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Note: The actual masjid/user_roles data is already soft-deleted with status='deleted'
  -- You may want to add additional cleanup logic here to permanently delete those records

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'message', 'Expired archives cleaned up successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.cleanup_expired_archives TO service_role;

-- Add comments
COMMENT ON TABLE public.deleted_masjeedhs_archive IS 'Archive for soft-deleted masjeedhs with grace period for reactivation';
COMMENT ON COLUMN public.deleted_masjeedhs_archive.backup_data IS 'JSON snapshot of all masjeedh data including user_roles, members, staff, etc.';
COMMENT ON COLUMN public.deleted_masjeedhs_archive.expires_at IS 'Grace period end date (90 days from deletion)';
COMMENT ON FUNCTION public.reactivate_masjeedh IS 'Developer function to reactivate a soft-deleted masjeedh within grace period';
COMMENT ON FUNCTION public.cleanup_expired_archives IS 'Function to cleanup expired archives (call via cron job)';
COMMENT ON COLUMN public.deleted_masjeedhs_archive.status IS 'pending_deletion = in grace period, restored = reactivated, permanently_deleted = expired';
