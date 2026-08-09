-- Add advances_paid column to employees table
-- This tracks total advances given but not yet deducted from salary

begin;

-- Add advances_paid column
alter table public.employees
add column if not exists advances_paid numeric(12,2) default 0 check (advances_paid >= 0);

-- Add index for faster queries
create index if not exists idx_employees_advances_paid
on public.employees (masjid_id, advances_paid desc);

-- Comment the column
comment on column public.employees.advances_paid is 'Total advance payments given to staff that have not yet been deducted from salary. Decreases when advances are deducted from salary payments.';

commit;
