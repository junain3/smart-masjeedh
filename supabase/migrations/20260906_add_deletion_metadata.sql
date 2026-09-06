-- Migration: Add deletion metadata columns
-- This adds deleted_by and deleted_reason columns to track who performed deletions

-- Add deletion metadata to masjids table
ALTER TABLE public.masjids 
ADD COLUMN IF NOT EXISTS deleted_by UUID,
ADD COLUMN IF NOT EXISTS deleted_reason TEXT;

-- Add deletion metadata to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS deleted_by UUID,
ADD COLUMN IF NOT EXISTS deleted_reason TEXT;

-- Add foreign key constraints (optional - references auth.users)
-- These are commented out as auth.users may not be directly accessible
-- ALTER TABLE public.masjids 
-- ADD CONSTRAINT fk_masjids_deleted_by 
-- FOREIGN KEY (deleted_by) REFERENCES auth.users(id);

-- ALTER TABLE public.user_roles 
-- ADD CONSTRAINT fk_user_roles_deleted_by 
-- FOREIGN KEY (deleted_by) REFERENCES auth.users(id);

-- Add index for efficient querying by deleted_by
CREATE INDEX IF NOT EXISTS idx_masjids_deleted_by ON public.masjids(deleted_by);
CREATE INDEX IF NOT EXISTS idx_user_roles_deleted_by ON public.user_roles(deleted_by);
