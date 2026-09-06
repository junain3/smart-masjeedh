-- Add Soft Delete Columns for Grace Period Deletion
-- This adds status and deleted_at columns to enable soft delete with 3-month restoration period

-- Add soft delete columns to masjids table
ALTER TABLE public.masjids 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add soft delete columns to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add index for efficient querying of deleted records
CREATE INDEX IF NOT EXISTS idx_masjids_status ON public.masjids(status);
CREATE INDEX IF NOT EXISTS idx_masjids_deleted_at ON public.masjids(deleted_at);
CREATE INDEX IF NOT EXISTS idx_user_roles_status ON public.user_roles(status);
CREATE INDEX IF NOT EXISTS idx_user_roles_deleted_at ON public.user_roles(deleted_at);

-- Add check constraint for status values
ALTER TABLE public.masjids 
ADD CONSTRAINT check_masjids_status 
CHECK (status IN ('active', 'deleted'));

ALTER TABLE public.user_roles 
ADD CONSTRAINT check_user_roles_status 
CHECK (status IN ('active', 'deleted'));
