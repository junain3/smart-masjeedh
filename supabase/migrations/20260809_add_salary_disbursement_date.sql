-- Add salary disbursement date configuration to masjids table
-- This allows each masjid to set their monthly salary payment date

begin;

-- Add salary_disbursement_date column
alter table public.masjids
add column if not exists salary_disbursement_date integer default 25 check (salary_disbursement_date >= 1 and salary_disbursement_date <= 31);

-- Comment the column
comment on column public.masjids.salary_disbursement_date is 'Day of month when salary is disbursed (1-31). Used for calculating salary cycles and arrears.';

commit;
