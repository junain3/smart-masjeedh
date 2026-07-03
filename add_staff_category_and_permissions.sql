-- Add staff categorization and admin-permission controls
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Employee' CHECK (category IN ('Employee', 'Board Member')),
ADD COLUMN IF NOT EXISTS allowances NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS access_permissions JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.employees.category IS 'Staff type used to separate employees from board members';
COMMENT ON COLUMN public.employees.allowances IS 'Additional monthly allowances for employee profiles';
COMMENT ON COLUMN public.employees.access_permissions IS 'Per-staff access controls such as edit_salary and view_reports';
