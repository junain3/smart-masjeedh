
-- Add status column to employees table
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated'));
