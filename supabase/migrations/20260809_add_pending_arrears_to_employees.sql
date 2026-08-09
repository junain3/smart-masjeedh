-- Add pending_arrears column to employees table for tracking unpaid salary
-- This migration adds the ability to track how much salary is pending for each staff member

begin;

-- Add pending_arrears column if it doesn't exist
alter table public.employees
add column if not exists pending_arrears numeric(12,2) default 0 check (pending_arrears >= 0);

-- Add index for faster queries on pending arrears
create index if not exists idx_employees_pending_arrears
on public.employees (masjid_id, pending_arrears desc);

-- Comment the column
comment on column public.employees.pending_arrears is 'Total pending salary arrears for the staff member. Deducted when salary payments are made.';

commit;
