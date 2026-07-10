-- Add Board Member specific fields to employees table
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS designation TEXT,
ADD COLUMN IF NOT EXISTS term_start DATE,
ADD COLUMN IF NOT EXISTS term_end DATE;
